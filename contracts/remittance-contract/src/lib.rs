#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, BytesN, Env, String, Vec,
};

const MAX_MEMO_LENGTH: u32 = 120;
const MIN_EXPIRY_SECONDS: u64 = 60;
const MAX_EXPIRY_SECONDS: u64 = 7 * 24 * 60 * 60;

const TTL_THRESHOLD: u32 = 100_000;
const TTL_EXTEND_TO: u32 = 500_000;
const MAX_PAGE_SIZE: u32 = 50;

const MAINNET_XLM_SAC: &str = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";

const TESTNET_XLM_SAC: &str = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const MAINNET_NETWORK_ID: [u8; 32] = [
    0x7a, 0xc3, 0x39, 0x97, 0x54, 0x4e, 0x31, 0x75, 0xd2, 0x66, 0xbd, 0x02, 0x24, 0x39, 0xb2, 0x2c,
    0xdb, 0x16, 0x50, 0x8c, 0x01, 0x16, 0x3f, 0x26, 0xe5, 0xcb, 0x2a, 0x3e, 0x10, 0x45, 0xa9, 0x79,
];

const TESTNET_NETWORK_ID: [u8; 32] = [
    0xce, 0xe0, 0x30, 0x2d, 0x59, 0x84, 0x4d, 0x32, 0xbd, 0xca, 0x91, 0x5c, 0x82, 0x03, 0xdd, 0x44,
    0xb3, 0x3f, 0xbb, 0x7e, 0xdc, 0x19, 0x05, 0x1e, 0xa3, 0x7a, 0xbe, 0xdf, 0x28, 0xec, 0xd4, 0x72,
];

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum RemittanceStatus {
    Pending,
    Claimed,
    Refunded,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Remittance {
    pub id: u64,
    pub sender: Address,
    pub receiver: Address,
    pub amount: i128,
    pub memo: String,
    pub status: RemittanceStatus,
    pub created_at: u64,
    pub expires_at: u64,
    pub updated_at: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct RemittanceStats {
    pub total_remittances: u64,
    pub pending_remittances: u64,
    pub claimed_remittances: u64,
    pub refunded_remittances: u64,
    pub active_amount: i128,
    pub total_amount_created: i128,
    pub total_amount_claimed: i128,
    pub total_amount_refunded: i128,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Token,
    Deployer,
    Counter,
    Stats,
    Remittance(u64),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracterror]
pub enum RemittanceError {
    InvalidAmount = 1,
    SameParty = 2,
    InvalidExpiry = 3,
    RemittanceNotFound = 4,
    NotReceiver = 5,
    NotSender = 6,
    AlreadyClosed = 7,
    Expired = 8,
    NotExpired = 9,
    InvalidLimit = 10,
    ArithmeticOverflow = 11,
    MemoTooLong = 12,
    UnsupportedNetwork = 13,
}

#[contractevent(topics = ["REMIT", "created"])]
pub struct RemittanceCreatedEvent {
    pub id: u64,
    pub sender: Address,
    pub receiver: Address,
    pub amount: i128,
    pub expires_at: u64,
}

#[contractevent(topics = ["REMIT", "claimed"])]
pub struct RemittanceClaimedEvent {
    pub id: u64,
    pub receiver: Address,
    pub amount: i128,
}

#[contractevent(topics = ["REMIT", "refunded"])]
pub struct RemittanceRefundedEvent {
    pub id: u64,
    pub sender: Address,
    pub amount: i128,
}

#[contract]
pub struct RemittanceContract;

#[contractimpl]
impl RemittanceContract {
    pub fn __constructor(env: Env, deployer: Address) {
        env.storage().instance().set(&DataKey::Deployer, &deployer);

        env.storage().instance().set(&DataKey::Counter, &0_u64);

        env.storage()
            .instance()
            .set(&DataKey::Stats, &Self::empty_stats());

        Self::bump_instance(&env);
    }

    pub fn create_remittance(
        env: Env,
        sender: Address,
        receiver: Address,
        amount: i128,
        memo: String,
        expires_at: u64,
    ) -> u64 {
        sender.require_auth();

        if amount <= 0 {
            panic_with_error!(&env, RemittanceError::InvalidAmount);
        }

        if sender == receiver {
            panic_with_error!(&env, RemittanceError::SameParty);
        }

        if memo.len() > MAX_MEMO_LENGTH {
            panic_with_error!(&env, RemittanceError::MemoTooLong);
        }

        let now = env.ledger().timestamp();

        let min_expiry = now
            .checked_add(MIN_EXPIRY_SECONDS)
            .unwrap_or_else(|| panic_with_error!(&env, RemittanceError::ArithmeticOverflow));

        let max_expiry = now
            .checked_add(MAX_EXPIRY_SECONDS)
            .unwrap_or_else(|| panic_with_error!(&env, RemittanceError::ArithmeticOverflow));

        if expires_at < min_expiry || expires_at > max_expiry {
            panic_with_error!(&env, RemittanceError::InvalidExpiry);
        }

        Self::bump_instance(&env);

        let current_counter: u64 = env.storage().instance().get(&DataKey::Counter).unwrap_or(0);

        let id = current_counter
            .checked_add(1)
            .unwrap_or_else(|| panic_with_error!(&env, RemittanceError::ArithmeticOverflow));

        let token_address = Self::token_address(&env);
        let token_client = token::TokenClient::new(&env, &token_address);

        token_client.transfer(&sender, &env.current_contract_address(), &amount);

        let remittance = Remittance {
            id,
            sender: sender.clone(),
            receiver: receiver.clone(),
            amount,
            memo,
            status: RemittanceStatus::Pending,
            created_at: now,
            expires_at,
            updated_at: now,
        };

        Self::write_remittance(&env, &remittance);

        env.storage().instance().set(&DataKey::Counter, &id);

        let mut stats = Self::stats(&env);

        stats.total_remittances = stats
            .total_remittances
            .checked_add(1)
            .unwrap_or_else(|| panic_with_error!(&env, RemittanceError::ArithmeticOverflow));

        stats.pending_remittances = stats
            .pending_remittances
            .checked_add(1)
            .unwrap_or_else(|| panic_with_error!(&env, RemittanceError::ArithmeticOverflow));

        stats.active_amount = stats
            .active_amount
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(&env, RemittanceError::ArithmeticOverflow));

        stats.total_amount_created = stats
            .total_amount_created
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(&env, RemittanceError::ArithmeticOverflow));

        env.storage().instance().set(&DataKey::Stats, &stats);

        RemittanceCreatedEvent {
            id,
            sender,
            receiver,
            amount,
            expires_at,
        }
        .publish(&env);

        id
    }

    pub fn claim_remittance(env: Env, remittance_id: u64, receiver: Address) -> Remittance {
        receiver.require_auth();

        Self::bump_instance(&env);

        let mut remittance = Self::read_remittance(&env, remittance_id);

        if remittance.receiver != receiver {
            panic_with_error!(&env, RemittanceError::NotReceiver);
        }

        if remittance.status != RemittanceStatus::Pending {
            panic_with_error!(&env, RemittanceError::AlreadyClosed);
        }

        let now = env.ledger().timestamp();

        if now >= remittance.expires_at {
            panic_with_error!(&env, RemittanceError::Expired);
        }

        let token_address = Self::token_address(&env);
        let token_client = token::TokenClient::new(&env, &token_address);

        token_client.transfer(
            &env.current_contract_address(),
            &receiver,
            &remittance.amount,
        );

        remittance.status = RemittanceStatus::Claimed;
        remittance.updated_at = now;

        Self::write_remittance(&env, &remittance);

        let mut stats = Self::stats(&env);

        stats.pending_remittances = stats
            .pending_remittances
            .checked_sub(1)
            .unwrap_or_else(|| panic_with_error!(&env, RemittanceError::ArithmeticOverflow));

        stats.claimed_remittances = stats
            .claimed_remittances
            .checked_add(1)
            .unwrap_or_else(|| panic_with_error!(&env, RemittanceError::ArithmeticOverflow));

        stats.active_amount = stats
            .active_amount
            .checked_sub(remittance.amount)
            .unwrap_or_else(|| panic_with_error!(&env, RemittanceError::ArithmeticOverflow));

        stats.total_amount_claimed = stats
            .total_amount_claimed
            .checked_add(remittance.amount)
            .unwrap_or_else(|| panic_with_error!(&env, RemittanceError::ArithmeticOverflow));

        env.storage().instance().set(&DataKey::Stats, &stats);

        RemittanceClaimedEvent {
            id: remittance.id,
            receiver,
            amount: remittance.amount,
        }
        .publish(&env);

        remittance
    }

    pub fn refund_remittance(env: Env, remittance_id: u64, sender: Address) -> Remittance {
        sender.require_auth();

        Self::bump_instance(&env);

        let mut remittance = Self::read_remittance(&env, remittance_id);

        if remittance.sender != sender {
            panic_with_error!(&env, RemittanceError::NotSender);
        }

        if remittance.status != RemittanceStatus::Pending {
            panic_with_error!(&env, RemittanceError::AlreadyClosed);
        }

        let now = env.ledger().timestamp();

        if now < remittance.expires_at {
            panic_with_error!(&env, RemittanceError::NotExpired);
        }

        let token_address = Self::token_address(&env);
        let token_client = token::TokenClient::new(&env, &token_address);

        token_client.transfer(&env.current_contract_address(), &sender, &remittance.amount);

        remittance.status = RemittanceStatus::Refunded;
        remittance.updated_at = now;

        Self::write_remittance(&env, &remittance);

        let mut stats = Self::stats(&env);

        stats.pending_remittances = stats
            .pending_remittances
            .checked_sub(1)
            .unwrap_or_else(|| panic_with_error!(&env, RemittanceError::ArithmeticOverflow));

        stats.refunded_remittances = stats
            .refunded_remittances
            .checked_add(1)
            .unwrap_or_else(|| panic_with_error!(&env, RemittanceError::ArithmeticOverflow));

        stats.active_amount = stats
            .active_amount
            .checked_sub(remittance.amount)
            .unwrap_or_else(|| panic_with_error!(&env, RemittanceError::ArithmeticOverflow));

        stats.total_amount_refunded = stats
            .total_amount_refunded
            .checked_add(remittance.amount)
            .unwrap_or_else(|| panic_with_error!(&env, RemittanceError::ArithmeticOverflow));

        env.storage().instance().set(&DataKey::Stats, &stats);

        RemittanceRefundedEvent {
            id: remittance.id,
            sender,
            amount: remittance.amount,
        }
        .publish(&env);

        remittance
    }

    pub fn get_remittance(env: Env, remittance_id: u64) -> Remittance {
        Self::read_remittance(&env, remittance_id)
    }

    pub fn list_remittances(env: Env, start_id: u64, limit: u32) -> Vec<Remittance> {
        if limit == 0 || limit > MAX_PAGE_SIZE {
            panic_with_error!(&env, RemittanceError::InvalidLimit);
        }

        let counter: u64 = env.storage().instance().get(&DataKey::Counter).unwrap_or(0);

        let mut results = Vec::new(&env);
        let mut id = if start_id == 0 { 1 } else { start_id };

        while id <= counter && results.len() < limit {
            let key = DataKey::Remittance(id);

            if let Some(remittance) = env.storage().persistent().get::<DataKey, Remittance>(&key) {
                results.push_back(remittance);
            }

            id = match id.checked_add(1) {
                Some(next) => next,
                None => break,
            };
        }

        results
    }

    pub fn get_stats(env: Env) -> RemittanceStats {
        Self::stats(&env)
    }

    pub fn get_counter(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Counter).unwrap_or(0)
    }

    pub fn get_token(env: Env) -> Address {
        Self::token_address(&env)
    }

    pub fn get_deployer(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Deployer).unwrap()
    }

    fn empty_stats() -> RemittanceStats {
        RemittanceStats {
            total_remittances: 0,
            pending_remittances: 0,
            claimed_remittances: 0,
            refunded_remittances: 0,
            active_amount: 0,
            total_amount_created: 0,
            total_amount_claimed: 0,
            total_amount_refunded: 0,
        }
    }

    fn token_address(env: &Env) -> Address {
        // Tests may inject a SAC directly into contract storage.
        if let Some(token) = env
            .storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::Token)
        {
            return token;
        }

        Self::native_xlm_token(env)
    }

    fn native_xlm_token(env: &Env) -> Address {
        let network_id = env.ledger().network_id();

        let mainnet_id = BytesN::from_array(env, &MAINNET_NETWORK_ID);

        if network_id == mainnet_id {
            return Address::from_str(env, MAINNET_XLM_SAC);
        }

        let testnet_id = BytesN::from_array(env, &TESTNET_NETWORK_ID);

        if network_id == testnet_id {
            return Address::from_str(env, TESTNET_XLM_SAC);
        }

        panic_with_error!(env, RemittanceError::UnsupportedNetwork);
    }

    fn stats(env: &Env) -> RemittanceStats {
        env.storage()
            .instance()
            .get(&DataKey::Stats)
            .unwrap_or_else(Self::empty_stats)
    }

    fn read_remittance(env: &Env, remittance_id: u64) -> Remittance {
        let key = DataKey::Remittance(remittance_id);

        let remittance = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(env, RemittanceError::RemittanceNotFound));

        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);

        remittance
    }

    fn write_remittance(env: &Env, remittance: &Remittance) {
        let key = DataKey::Remittance(remittance.id);

        env.storage().persistent().set(&key, remittance);

        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }

    fn bump_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
    }
}

#[cfg(test)]
mod test;
