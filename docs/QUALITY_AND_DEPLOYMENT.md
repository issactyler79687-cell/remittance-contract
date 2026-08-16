# Quality and Deployment

## Local Verification

Run:

powershell -ExecutionPolicy Bypass -File scripts/verify-level3.ps1

The verification script checks:

- required project files
- contract formatting
- contract tests
- contract WASM build
- frontend dependencies
- frontend type checking
- frontend production build
- frontend smoke test
- public documentation wording

## Contract Quality

The smart contract includes:

- persistent storage
- transfer lifecycle states
- sender authorization
- receiver authorization
- transfer history
- aggregate stats
- custom errors
- contract events
- 4 tests

Test command:

cargo test --workspace

Build command:

cargo build --workspace --target wasm32v1-none --release

## Frontend Quality

The frontend includes:

- wallet connection
- wallet disconnect
- address display
- transaction signing
- transaction hash display
- handled error states
- loading states
- activity feed

Frontend commands:

cd frontend
npm ci
npm run type-check
npm run build
npm test

## Deployment Evidence

Deployment files:

- CONTRACT_ID.txt
- TX_HASH.txt
- DEPLOYMENT.md

The contract ID is also written into:

frontend/src/contractConfig.ts

## CI/CD

GitHub Actions checks:

- smart contract format
- smart contract tests
- smart contract WASM build
- frontend type check
- frontend production build
- frontend smoke test
- deployment evidence files