#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{StellarAssetClient, TokenClient},
    Address, Env, String,
};

const START_TIME: u64 = 1_000_000;
const ONE_XLM: i128 = 10_000_000;

fn set_time(env: &Env, timestamp: u64) {
    env.ledger().set(LedgerInfo {
        timestamp,
        protocol_version: 26,
        sequence_number: 100,
        network_id: Default::default(),
        base_reserve: 5_000_000,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 1_000_000,
    });
}

fn setup<'a>(
    env: &'a Env,
) -> (
    RemittanceContractClient<'a>,
    TokenClient<'a>,
    StellarAssetClient<'a>,
    Address,
    Address,
    Address,
) {
    env.mock_all_auths();
    set_time(env, START_TIME);

    let issuer = Address::generate(env);
    let sender = Address::generate(env);
    let receiver = Address::generate(env);
    let deployer = Address::generate(env);

    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token_address = sac.address();

    let token = TokenClient::new(env, &token_address);
    let token_admin = StellarAssetClient::new(env, &token_address);

    token_admin.mint(&sender, &(100 * ONE_XLM));

    let contract_id = env.register(RemittanceContract, (deployer,));

    env.as_contract(&contract_id, || {
        env.storage()
            .instance()
            .set(&DataKey::Token, &token_address);
    });

    let client = RemittanceContractClient::new(env, &contract_id);

    (client, token, token_admin, sender, receiver, contract_id)
}

#[test]
fn constructor_records_deployer() {
    let env = Env::default();
    set_time(&env, START_TIME);

    let deployer = Address::generate(&env);

    let contract_id = env.register(RemittanceContract, (deployer.clone(),));

    let client = RemittanceContractClient::new(&env, &contract_id);

    assert_eq!(client.get_deployer(), deployer);
}

#[test]
fn constructor_starts_with_clean_state() {
    let env = Env::default();

    let (client, _, _, _, _, _) = setup(&env);

    let stats = client.get_stats();

    assert_eq!(client.get_counter(), 0);
    assert_eq!(stats.total_remittances, 0);
    assert_eq!(stats.pending_remittances, 0);
    assert_eq!(stats.claimed_remittances, 0);
    assert_eq!(stats.refunded_remittances, 0);
    assert_eq!(stats.active_amount, 0);
}

#[test]
fn create_remittance_locks_tokens_in_contract() {
    let env = Env::default();

    let (client, token, _, sender, receiver, contract_id) = setup(&env);

    let amount = 5 * ONE_XLM;

    let sender_before = token.balance(&sender);

    let id = client.create_remittance(
        &sender,
        &receiver,
        &amount,
        &String::from_str(&env, "Family support"),
        &(START_TIME + 3600),
    );

    let remittance = client.get_remittance(&id);
    let stats = client.get_stats();

    assert_eq!(id, 1);
    assert_eq!(remittance.sender, sender);
    assert_eq!(remittance.receiver, receiver);
    assert_eq!(remittance.amount, amount);
    assert_eq!(remittance.status, RemittanceStatus::Pending);

    assert_eq!(token.balance(&sender), sender_before - amount);

    assert_eq!(token.balance(&contract_id), amount);

    assert_eq!(stats.total_remittances, 1);
    assert_eq!(stats.pending_remittances, 1);
    assert_eq!(stats.active_amount, amount);
    assert_eq!(stats.total_amount_created, amount);
}

#[test]
fn receiver_can_claim_locked_tokens() {
    let env = Env::default();

    let (client, token, _, sender, receiver, contract_id) = setup(&env);

    let amount = 3 * ONE_XLM;

    let id = client.create_remittance(
        &sender,
        &receiver,
        &amount,
        &String::from_str(&env, "Rent"),
        &(START_TIME + 3600),
    );

    assert_eq!(token.balance(&contract_id), amount);
    assert_eq!(token.balance(&receiver), 0);

    let claimed = client.claim_remittance(&id, &receiver);

    assert_eq!(claimed.status, RemittanceStatus::Claimed);
    assert_eq!(token.balance(&contract_id), 0);
    assert_eq!(token.balance(&receiver), amount);

    let stats = client.get_stats();

    assert_eq!(stats.pending_remittances, 0);
    assert_eq!(stats.claimed_remittances, 1);
    assert_eq!(stats.active_amount, 0);
    assert_eq!(stats.total_amount_claimed, amount);
}

#[test]
fn sender_can_refund_only_after_expiry() {
    let env = Env::default();

    let (client, token, _, sender, receiver, contract_id) = setup(&env);

    let amount = 2 * ONE_XLM;
    let original_balance = token.balance(&sender);

    let id = client.create_remittance(
        &sender,
        &receiver,
        &amount,
        &String::from_str(&env, "Expiry test"),
        &(START_TIME + 600),
    );

    assert_eq!(token.balance(&sender), original_balance - amount);

    assert!(client.try_refund_remittance(&id, &sender).is_err());

    set_time(&env, START_TIME + 601);

    let refunded = client.refund_remittance(&id, &sender);

    assert_eq!(refunded.status, RemittanceStatus::Refunded);
    assert_eq!(token.balance(&contract_id), 0);
    assert_eq!(token.balance(&sender), original_balance);

    let stats = client.get_stats();

    assert_eq!(stats.pending_remittances, 0);
    assert_eq!(stats.refunded_remittances, 1);
    assert_eq!(stats.total_amount_refunded, amount);
}

#[test]
fn expired_remittance_cannot_be_claimed() {
    let env = Env::default();

    let (client, token, _, sender, receiver, contract_id) = setup(&env);

    let amount = ONE_XLM;

    let id = client.create_remittance(
        &sender,
        &receiver,
        &amount,
        &String::from_str(&env, "Expired claim"),
        &(START_TIME + 600),
    );

    set_time(&env, START_TIME + 600);

    assert!(client.try_claim_remittance(&id, &receiver).is_err());

    assert_eq!(token.balance(&receiver), 0);
    assert_eq!(token.balance(&contract_id), amount);
}

#[test]
fn closed_remittance_cannot_be_claimed_twice() {
    let env = Env::default();

    let (client, token, _, sender, receiver, _) = setup(&env);

    let amount = ONE_XLM;

    let id = client.create_remittance(
        &sender,
        &receiver,
        &amount,
        &String::from_str(&env, "Double claim"),
        &(START_TIME + 3600),
    );

    client.claim_remittance(&id, &receiver);

    assert!(client.try_claim_remittance(&id, &receiver).is_err());

    assert_eq!(token.balance(&receiver), amount);
}

#[test]
fn invalid_inputs_are_rejected() {
    let env = Env::default();

    let (client, _, _, sender, receiver, _) = setup(&env);

    assert!(client
        .try_create_remittance(
            &sender,
            &receiver,
            &0,
            &String::from_str(&env, "Zero"),
            &(START_TIME + 3600),
        )
        .is_err());

    assert!(client
        .try_create_remittance(
            &sender,
            &sender,
            &ONE_XLM,
            &String::from_str(&env, "Same party"),
            &(START_TIME + 3600),
        )
        .is_err());

    assert!(client
        .try_create_remittance(
            &sender,
            &receiver,
            &ONE_XLM,
            &String::from_str(&env, "Too soon"),
            &(START_TIME + 10),
        )
        .is_err());

    assert!(client
        .try_create_remittance(
            &sender,
            &receiver,
            &ONE_XLM,
            &String::from_str(&env, "Too late"),
            &(START_TIME + (8 * 24 * 60 * 60)),
        )
        .is_err());
}

#[test]
fn wrong_party_cannot_close_remittance() {
    let env = Env::default();

    let (client, _, _, sender, receiver, _) = setup(&env);

    let stranger = Address::generate(&env);

    let id = client.create_remittance(
        &sender,
        &receiver,
        &ONE_XLM,
        &String::from_str(&env, "Authorization"),
        &(START_TIME + 600),
    );

    assert!(client.try_claim_remittance(&id, &stranger).is_err());

    set_time(&env, START_TIME + 601);

    assert!(client.try_refund_remittance(&id, &stranger).is_err());
}

#[test]
fn pagination_returns_expected_records() {
    let env = Env::default();

    let (client, _, _, sender, receiver, _) = setup(&env);

    for i in 0..3 {
        client.create_remittance(
            &sender,
            &receiver,
            &ONE_XLM,
            &String::from_str(&env, "Page test"),
            &(START_TIME + 3600 + i),
        );
    }

    let first_page = client.list_remittances(&1, &2);
    let second_page = client.list_remittances(&3, &2);

    assert_eq!(first_page.len(), 2);
    assert_eq!(first_page.get(0).unwrap().id, 1);
    assert_eq!(first_page.get(1).unwrap().id, 2);

    assert_eq!(second_page.len(), 1);
    assert_eq!(second_page.get(0).unwrap().id, 3);

    assert!(client.try_list_remittances(&1, &0).is_err());

    assert!(client.try_list_remittances(&1, &51).is_err());
}

#[test]
fn create_requires_sender_authorization() {
    let env = Env::default();

    set_time(&env, START_TIME);

    let issuer = Address::generate(&env);
    let sender = Address::generate(&env);
    let receiver = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(issuer);

    let _token_address = sac.address();

    let deployer = Address::generate(&env);

    let contract_id = env.register(RemittanceContract, (deployer,));

    let client = RemittanceContractClient::new(&env, &contract_id);

    assert!(client
        .try_create_remittance(
            &sender,
            &receiver,
            &ONE_XLM,
            &String::from_str(&env, "No auth"),
            &(START_TIME + 3600),
        )
        .is_err());
}
