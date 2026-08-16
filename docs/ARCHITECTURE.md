# Remit Architecture

Remit is a Stellar Mainnet application that uses a Soroban smart contract as a time-bounded XLM escrow between a sender and a receiver.

## Product Flow

### Create

1. A sender connects Freighter on Mainnet.
2. The sender enters a receiver, XLM amount, memo, and claim window.
3. The frontend builds `create_remittance`.
4. Freighter signs the prepared transaction.
5. The native XLM Stellar Asset Contract transfers XLM from the sender to the Remit contract.
6. Remit stores the remittance as `Pending`.

### Claim

1. The designated receiver loads the remittance.
2. The receiver signs `claim_remittance`.
3. The contract verifies receiver authorization and that the remittance is still pending and unexpired.
4. XLM moves from contract escrow to the receiver.
5. Status becomes `Claimed`.

### Refund

1. The sender loads an expired pending remittance.
2. The sender signs `refund_remittance`.
3. The contract verifies sender authorization and expiry.
4. XLM moves from contract escrow back to the sender.
5. Status becomes `Refunded`.

## Smart Contract

Location:

```text
contracts/remittance-contract/src/lib.rs
```

Public functions:

- `__constructor`
- `create_remittance`
- `claim_remittance`
- `refund_remittance`
- `get_remittance`
- `list_remittances`
- `get_stats`
- `get_counter`
- `get_token`
- `get_deployer`

### Authorization

`create_remittance` requires the sender's authorization.

`claim_remittance` requires the receiver's authorization and verifies that the signer is the receiver stored in the remittance.

`refund_remittance` requires the sender's authorization and verifies that the signer is the original sender.

### XLM integration

Production does not accept an arbitrary token address in the constructor.

The contract resolves native XLM from the current Stellar network ID:

- Mainnet -> native XLM SAC `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA`
- Testnet -> the native Testnet XLM SAC
- other network -> `UnsupportedNetwork`

The Testnet path remains in the contract so the same WASM logic can be regression-tested without changing production semantics.

### Deployer

The constructor records the deployer address as provenance.

The deployer is not an administrator and receives no privileged claim, refund, or token-transfer capability.

### Storage

Instance storage:

- deployer
- counter
- aggregate statistics

Persistent storage:

- remittance records

The contract extends TTL for active instance and remittance entries.

### Events

Lifecycle actions publish contract events so external indexers can follow creation, claim, and refund activity.

## Frontend

Location:

```text
frontend/src
```

`App.tsx` handles product state and user actions.

`services/wallet.ts` handles Freighter access, verifies Mainnet, and signs XDR.

`services/contract.ts` handles:

- RPC connection
- Soroban contract calls
- argument encoding
- read simulation
- transaction preparation
- Freighter signing
- transaction submission
- status polling
- result normalization

`contractConfig.ts` pins the frontend to the production Mainnet RPC, passphrase, and deployed contract.

## Mainnet Configuration

- Network: Stellar Mainnet
- Passphrase: `Public Global Stellar Network ; September 2015`
- RPC: `https://soroban-rpc.mainnet.stellar.gateway.fm`
- Contract: `CAQCTQQM7HAJEGGMUJ3EHZ2XFDOUOBOBRDMFOCC4S3XFXYEOL5VSSLSI`

## Trust Model

Remit does not operate a custodial backend.

The smart contract temporarily controls XLM that the sender explicitly authorizes into escrow. Contract rules determine whether the receiver can claim or the sender can refund.

The frontend cannot move a user's XLM without a wallet signature.
