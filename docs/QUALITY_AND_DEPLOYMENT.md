# Quality and Release Verification

## Release Gate

Run from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-release.ps1
```

The release gate verifies:

- required source and documentation files
- Rust formatting
- contract tests
- production WASM build
- frontend dependency installation
- TypeScript type checking
- frontend production build
- Mainnet contract configuration
- Mainnet deployment evidence
- absence of stale Level-3 and old Testnet deployment references

## Contract Quality

The contract test suite validates:

- clean constructor state
- deployer recording
- XLM escrow balance movement
- successful receiver claim
- refund only after expiry
- expired claim rejection
- duplicate close rejection
- sender authorization
- invalid input rejection
- wrong-party rejection
- pagination

Commands:

```powershell
cargo fmt --all -- --check
cargo test --workspace
stellar contract build
```

## Frontend Quality

Commands:

```powershell
cd frontend
npm ci
npm run type-check
npm run build
```

The frontend additionally checks the Freighter network before treating a wallet as connected. Production transactions use the Mainnet network passphrase.

## Deployment Evidence

Mainnet deployment details are stored in:

```text
docs/MAINNET_DEPLOYMENT.md
```

The repository intentionally does not commit signed XDR, wallet secrets, recovery phrases, or local environment files.

## CI

GitHub Actions runs:

- Rust formatting
- contract tests
- WASM release build
- frontend dependency installation
- frontend type check
- frontend production build
- Mainnet configuration/evidence checks
- stale-reference scan
