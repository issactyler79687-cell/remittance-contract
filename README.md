# Remittance Contract

Remittance Contract is a Stellar Testnet dApp for creating, claiming, cancelling, and tracking remittance transfers through a Soroban smart contract and a Freighter wallet dashboard.

The project demonstrates a complete Stellar Level 3 dApp flow with smart contract logic, contract tests, deployment evidence, frontend wallet signing, Soroban RPC integration, CI/CD, and local verification scripts.

## Problem

Cross-border remittance flows are often slow, expensive, and difficult to verify.

Senders and receivers may not have a clear way to check:

- whether a transfer was created
- whether a transfer was claimed
- whether a transfer was cancelled
- which wallet sent the transfer
- which wallet should receive the transfer
- how much value was recorded in the transfer

## Solution

Remittance Contract stores transfer records on Stellar Testnet.

A sender can create a transfer for a receiver wallet.

The receiver can claim the transfer.

The sender can cancel a pending transfer.

The frontend displays wallet state, contract runtime information, transaction hashes, transfer details, and transfer statistics.

## Repository

GitHub repository:

https://github.com/edenphann99/remittance-contract

## Stellar Testnet Deployment

Network:

Stellar Testnet

Contract ID:

CC4VBT3IZWXDWH56L2MOJZSKHQIHVW7VEB55J33VFOARTESV2OY7VDAS

Contract explorer:

https://stellar.expert/explorer/testnet/contract/CC4VBT3IZWXDWH56L2MOJZSKHQIHVW7VEB55J33VFOARTESV2OY7VDAS

## Successful Contract Interaction

Transaction hash:

ae636d55ab2443c74aec9f21c25d75a2008823ac742a7983090ae28c9372b6ef

Transaction explorer:

https://stellar.expert/explorer/testnet/tx/ae636d55ab2443c74aec9f21c25d75a2008823ac742a7983090ae28c9372b6ef

## Features

- Freighter wallet connect
- Freighter wallet disconnect
- connected wallet address display
- create remittance transfer
- claim transfer
- cancel transfer
- transfer detail lookup
- sender transfer history
- receiver transfer history
- contract stats
- transaction signing
- transaction hash display
- loading states
- handled error states
- activity feed
- responsive dashboard layout
- CI/CD workflow
- local verification script
- deployment automation

## Smart Contract

Contract location:

contracts/remittance-contract

The contract includes these public functions:

- initialize
- create_transfer
- claim_transfer
- cancel_transfer
- get_transfer
- get_counter
- get_stats
- get_sender_transfers
- get_receiver_transfers

The contract uses:

- custom transfer data struct
- transfer status enum
- transfer statistics
- sender transfer history
- receiver transfer history
- persistent storage keys
- custom errors
- contract events
- authorization checks
- contract tests

## Frontend

Frontend location:

frontend

Important files:

- frontend/src/App.tsx
- frontend/src/App.css
- frontend/src/contractConfig.ts
- frontend/src/services/wallet.ts
- frontend/src/services/contract.ts
- frontend/src/services/contract.test.ts

The frontend contract service uses:

- Soroban RPC
- TransactionBuilder
- Contract.call
- prepareTransaction
- Freighter signTransaction
- sendTransaction
- nativeToScVal
- scValToNative

Frontend functions map to contract functions:

- initializeContract -> initialize
- createTransfer -> create_transfer
- claimTransfer -> claim_transfer
- cancelTransfer -> cancel_transfer
- getTransfer -> get_transfer
- getCounter -> get_counter
- getStats -> get_stats
- getSenderTransfers -> get_sender_transfers
- getReceiverTransfers -> get_receiver_transfers

## Repository Structure

<pre>
remittance-contract
|-- contracts
|   `-- remittance-contract
|       |-- Cargo.toml
|       `-- src
|           |-- lib.rs
|           `-- test.rs
|-- frontend
|   |-- index.html
|   |-- package.json
|   |-- package-lock.json
|   |-- tsconfig.json
|   |-- vite.config.ts
|   `-- src
|       |-- App.css
|       |-- App.tsx
|       |-- contractConfig.ts
|       |-- main.tsx
|       |-- vite-env.d.ts
|       `-- services
|           |-- contract.test.ts
|           |-- contract.ts
|           `-- wallet.ts
|-- scripts
|   |-- deploy-and-save.ps1
|   `-- verify-level3.ps1
|-- .github
|   `-- workflows
|       `-- ci.yml
|-- docs
|   |-- ARCHITECTURE.md
|   `-- QUALITY_AND_VERIFICATION.md
|-- CONTRACT_ID.txt
|-- TX_HASH.txt
|-- DEPLOYMENT.md
|-- vercel.json
|-- Cargo.toml
|-- Cargo.lock
|-- README.md
`-- .gitignore
</pre>

## Local Setup

Clone the repository:

<pre>
git clone https://github.com/edenphann99/remittance-contract.git

cd remittance-contract
</pre>

Install frontend dependencies:

<pre>
cd frontend

npm install
</pre>

Run frontend locally:

<pre>
npm run dev
</pre>

## Contract Commands

From the repository root:

<pre>
cargo fmt --all

cargo test --workspace

cargo build --workspace --target wasm32v1-none --release
</pre>

## Frontend Commands

From the frontend folder:

<pre>
npm run type-check

npm test

npm run build
</pre>

## Full Local Verification

From the repository root:

<pre>
powershell -ExecutionPolicy Bypass -File scripts/verify-level3.ps1
</pre>

## Deployment

From the repository root:

<pre>
powershell -ExecutionPolicy Bypass -File scripts/deploy-and-save.ps1
</pre>

Deployment evidence is stored in:

- CONTRACT_ID.txt
- TX_HASH.txt
- DEPLOYMENT.md
- frontend/src/contractConfig.ts

## CI/CD

GitHub Actions workflow:

.github/workflows/ci.yml

The CI pipeline runs:

- Rust formatting
- contract tests
- contract WASM build
- frontend dependency install
- frontend type-check
- frontend tests
- frontend production build
- project structure checks

## Current Status

Completed:

- Soroban smart contract
- contract tests
- Freighter wallet service
- frontend contract integration
- responsive dashboard
- frontend tests
- deployment automation
- deployment evidence
- verification automation
- GitHub Actions CI configuration
- Vercel deployment configuration

## Notes

This repository does not include private keys, secret phrases, dependency folders, local build outputs, or local deploy logs.

Generated folders and local logs are ignored by git.