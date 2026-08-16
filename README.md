# Remit â€” XLM Escrow Remittance on Stellar

Remit is a Mainnet Stellar application for sending XLM through a time-bounded smart-contract escrow.

A sender locks XLM for a receiver. The receiver can claim the funds before expiry. If the claim window expires first, the sender can refund the locked XLM.

## Mainnet Status

- Network: Stellar Mainnet
- Contract ID: `CAQCTQQM7HAJEGGMUJ3EHZ2XFDOUOBOBRDMFOCC4S3XFXYEOL5VSSLSI`
- Deploy wallet: `GAHMY42DAKF4XBJMSVOK63LETPAUHAM2D6XQS764JBFL57N25FMYW42N`
- WASM hash: `65c6aa5c986a146fab07009156b5578e9cc5a6d8df70c6a1d1060fd86bdf2697`
- Upload transaction: `61320fb0f9f1b095a3a9adc2199d386f8d04cc3e5c1576f6f44f05be69a2300e`
- Deploy transaction: `bc9a5d63bfe8ca48d2ca69f8197b2c539475107a77c124377452b9400aeaa46d`

Deployment evidence is documented in [`docs/MAINNET_DEPLOYMENT.md`](docs/MAINNET_DEPLOYMENT.md).

## Why Remit

A normal wallet transfer is final as soon as it is sent. Remit adds a simple coordination window:

1. The sender chooses a receiver, XLM amount, memo, and claim window.
2. The contract transfers the XLM from the sender into contract escrow.
3. The receiver claims the escrow before expiry.
4. If the remittance expires first, only the sender can refund it.

This provides an on-chain state that both parties can inspect without giving a third party custody of a private key.

## Contract Lifecycle

`Pending -> Claimed`

or

`Pending -> Refunded`

A closed remittance cannot be claimed or refunded again.

## Smart Contract

Location:

```text
contracts/remittance-contract
```

Public contract functions:

- `__constructor(deployer)`
- `create_remittance(sender, receiver, amount, memo, expires_at)`
- `claim_remittance(remittance_id, receiver)`
- `refund_remittance(remittance_id, sender)`
- `get_remittance(remittance_id)`
- `list_remittances(start_id, limit)`
- `get_stats()`
- `get_counter()`
- `get_token()`
- `get_deployer()`

The contract includes:

- sender and receiver authorization
- real XLM balance movement through the Stellar Asset Contract
- amount and expiry validation
- duplicate-close protection
- persistent remittance state
- aggregate statistics
- contract events
- TTL extension
- checked arithmetic
- pagination
- Mainnet/Testnet native-XLM network resolution
- rejection of unsupported networks

The deployer address is recorded for provenance. It has no privileged fund-transfer method.

## Contract Tests

The contract test suite covers:

- constructor state
- deployer recording
- XLM locking on creation
- receiver claim and balance movement
- sender refund after expiry
- expired-claim rejection
- duplicate claim rejection
- sender authorization
- invalid inputs
- wrong-party rejection
- pagination

Run:

```powershell
cargo fmt --all -- --check
cargo test --workspace
stellar contract build
```

## Frontend

Location:

```text
frontend
```

The frontend uses React, Vite, Stellar SDK, and Freighter.

Features:

- Freighter connection
- Mainnet network guard
- send XLM into escrow
- claim pending remittance
- refund expired remittance
- remittance lookup
- contract statistics
- transaction signing in the user's wallet
- transaction status polling
- transaction and contract explorer links
- loading, success, pending, and error states

The application never asks the user for a secret key or recovery phrase.

### Mainnet configuration

`frontend/src/contractConfig.ts` is pinned to the deployed Mainnet contract:

```text
RPC: https://soroban-rpc.mainnet.stellar.gateway.fm
Contract ID: CAQCTQQM7HAJEGGMUJ3EHZ2XFDOUOBOBRDMFOCC4S3XFXYEOL5VSSLSI
Network passphrase: Public Global Stellar Network ; September 2015
```

These are public network configuration values, not wallet secrets.

## Local Setup

```powershell
git clone https://github.com/issactyler79687-cell/remittance-contract.git
cd remittance-contract

cd frontend
npm ci
npm run type-check
npm run build
npm run dev
```

Freighter must be connected to Mainnet before the app accepts the wallet connection.

## Full Release Verification

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-release.ps1
```

The verification script checks contract formatting/tests/build, frontend type-check/build, Mainnet configuration, deployment evidence, and stale Testnet/Level-3 wording.

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Mainnet Deployment

See [`docs/MAINNET_DEPLOYMENT.md`](docs/MAINNET_DEPLOYMENT.md).

## Security Notes

- The sender authorizes creation and the XLM transfer into escrow.
- Only the designated receiver can claim a pending remittance.
- Only the original sender can refund after expiry.
- No private key is stored in the repository or frontend.
- Signed XDR files and local `.env` files are ignored by Git.
- Mainnet uses real XLM. Review every Freighter transaction before signing.

## Repository

```text
https://github.com/issactyler79687-cell/remittance-contract
```
