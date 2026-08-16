# Remittance Contract Architecture

remittance-contract is an end-to-end Stellar Testnet dApp for recording transparent remittance commitments through a Soroban smart contract and a Freighter wallet dashboard.

## Product Problem

Cross-border remittance coordination is often handled through private chats, screenshots, or manual notes. This makes it difficult for senders and receivers to verify whether a transfer promise was created, claimed, or cancelled.

This dApp stores remittance records on Stellar Testnet so both sides can inspect transfer status through a public contract interaction.

## System Components

### Smart Contract

Location:

contracts/remittance-contract

The contract provides:

- initialize
- create_transfer
- claim_transfer
- cancel_transfer
- get_transfer
- get_counter
- get_stats
- get_sender_transfers
- get_receiver_transfers

The contract stores:

- transfer records
- sender transfer history
- receiver transfer history
- aggregate transfer stats

The contract includes:

- custom structs
- custom errors
- persistent storage
- contract events
- 4 passing tests

### Frontend

Location:

frontend

The frontend is a React and Vite dashboard with:

- Freighter wallet connection
- wallet disconnect
- connected address display
- contract runtime card
- create transfer form
- claim transfer action
- cancel transfer action
- transfer lookup
- transaction monitor
- activity feed
- error and loading states

### Contract Service Layer

Location:

frontend/src/services/contract.ts

The frontend contract service handles:

- RPC server setup
- contract method mapping
- argument conversion to ScVal
- read simulation
- transaction preparation
- Freighter signing
- transaction submission
- transaction status polling
- transaction hash output

### Wallet Service Layer

Location:

frontend/src/services/wallet.ts

The wallet service handles:

- Freighter availability check
- setAllowed
- requestAccess
- getAddress
- signTransaction
- wallet error handling

## Data Flow

1. User connects Freighter.
2. Frontend retrieves the public address.
3. User fills a remittance action.
4. Frontend builds a Soroban contract transaction.
5. RPC prepares the transaction.
6. Freighter signs the transaction.
7. Frontend submits the signed transaction.
8. Dashboard displays status and transaction hash.
9. Read actions simulate contract calls through RPC.

## Deployment

The contract is deployed on Stellar Testnet.

Contract ID:

CC4VBT3IZWXDWH56L2MOJZSKHQIHVW7VEB55J33VFOARTESV2OY7VDAS

Sample transaction hash:

ae636d55ab2443c74aec9f21c25d75a2008823ac742a7983090ae28c9372b6ef

The deployment script saves:

- CONTRACT_ID.txt
- TX_HASH.txt
- DEPLOYMENT.md
- frontend/src/contractConfig.ts