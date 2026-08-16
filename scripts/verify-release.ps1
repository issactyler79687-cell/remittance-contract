$ErrorActionPreference = "Stop"

function Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "=== $Message ==="
}

function Assert-Native {
  param([string]$Message)

  if ($LASTEXITCODE -ne 0) {
    throw "$Message Exit code: $LASTEXITCODE"
  }
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$ExpectedContractId = "CAQCTQQM7HAJEGGMUJ3EHZ2XFDOUOBOBRDMFOCC4S3XFXYEOL5VSSLSI"
$ExpectedDeployer = "GAHMY42DAKF4XBJMSVOK63LETPAUHAM2D6XQS764JBFL57N25FMYW42N"
$ExpectedWasmHash = "65c6aa5c986a146fab07009156b5578e9cc5a6d8df70c6a1d1060fd86bdf2697"
$ExpectedUploadTx = "61320fb0f9f1b095a3a9adc2199d386f8d04cc3e5c1576f6f44f05be69a2300e"
$ExpectedDeployTx = "bc9a5d63bfe8ca48d2ca69f8197b2c539475107a77c124377452b9400aeaa46d"
$ExpectedRpc = "https://soroban-rpc.mainnet.stellar.gateway.fm"
$ExpectedPassphrase = "Public Global Stellar Network ; September 2015"

Step "Check required files"

$RequiredFiles = @(
  "Cargo.toml",
  "Cargo.lock",
  "contracts/remittance-contract/Cargo.toml",
  "contracts/remittance-contract/src/lib.rs",
  "contracts/remittance-contract/src/test.rs",
  "frontend/package.json",
  "frontend/package-lock.json",
  "frontend/src/App.tsx",
  "frontend/src/App.css",
  "frontend/src/services/contract.ts",
  "frontend/src/services/wallet.ts",
  "frontend/src/contractConfig.ts",
  "frontend/src/vite-env.d.ts",
  "docs/ARCHITECTURE.md",
  "docs/QUALITY_AND_DEPLOYMENT.md",
  "docs/MAINNET_DEPLOYMENT.md",
  "scripts/verify-release.ps1",
  ".github/workflows/ci.yml",
  "README.md"
)

foreach ($File in $RequiredFiles) {
  if (-not (Test-Path $File)) {
    throw "Missing required file: $File"
  }

  Write-Host "OK: $File"
}


if (Test-Path "scripts/verify-level3.ps1") {
  throw "Stale script still exists: scripts/verify-level3.ps1"
}

if (Test-Path "scripts/deploy-and-save.ps1") {
  throw "Stale script still exists: scripts/deploy-and-save.ps1"
}

Step "Check contract formatting"

& cargo fmt --all -- --check
Assert-Native "Contract formatting check failed."

Step "Run contract tests"

& cargo test --workspace
Assert-Native "Contract tests failed."

Step "Build production WASM"

if (Get-Command stellar -ErrorAction SilentlyContinue) {
  & stellar contract build
  Assert-Native "Stellar contract build failed."
} else {
  & cargo build --workspace --target wasm32v1-none --release
  Assert-Native "Cargo WASM build failed."
}

$WasmPath = Join-Path `
  $RepoRoot `
  "target\wasm32v1-none\release\remittance_contract.wasm"

if (-not (Test-Path $WasmPath)) {
  throw "Production WASM not found: $WasmPath"
}

$ActualWasmHash = (
  Get-FileHash $WasmPath -Algorithm SHA256
).Hash.ToLowerInvariant()

if ($ActualWasmHash -ne $ExpectedWasmHash) {
  throw "WASM hash mismatch. Expected $ExpectedWasmHash but built $ActualWasmHash"
}

Write-Host "WASM hash verified: $ActualWasmHash"

Step "Check frontend"

Push-Location (Join-Path $RepoRoot "frontend")

try {
  & npm ci
  Assert-Native "npm ci failed."

  & npm run type-check
  Assert-Native "Frontend type-check failed."

  & npm run build
  Assert-Native "Frontend production build failed."
}
finally {
  Pop-Location
}

Step "Check Mainnet configuration"

$Config = Get-Content `
  "frontend/src/contractConfig.ts" `
  -Raw

foreach ($Expected in @(
  $ExpectedContractId,
  $ExpectedRpc,
  $ExpectedPassphrase
)) {
  if (-not $Config.Contains($Expected)) {
    throw "Missing Mainnet config value: $Expected"
  }
}

$Deployment = Get-Content `
  "docs/MAINNET_DEPLOYMENT.md" `
  -Raw

foreach ($Expected in @(
  $ExpectedContractId,
  $ExpectedDeployer,
  $ExpectedWasmHash,
  $ExpectedUploadTx,
  $ExpectedDeployTx
)) {
  if (-not $Deployment.Contains($Expected)) {
    throw "Missing Mainnet deployment evidence: $Expected"
  }
}

Step "Reject stale project references"

$ScanFiles = @(
  "README.md",
  "docs/ARCHITECTURE.md",
  "docs/QUALITY_AND_DEPLOYMENT.md",
  "docs/MAINNET_DEPLOYMENT.md",
  "frontend/src/App.tsx",
  "frontend/src/contractConfig.ts",
  "frontend/src/services/contract.ts",
  "frontend/src/services/wallet.ts"
)

$StalePattern = @(
  "Level 3",
  "Level3",
  "edenphann99",
  "CC4VBT3IZWXDWH56L2MOJZSKHQIHVW7VEB55J33VFOARTESV2OY7VDAS",
  "ae636d55ab2443c74aec9f21c25d75a2008823ac742a7983090ae28c9372b6ef",
  "create_transfer",
  "claim_transfer",
  "cancel_transfer",
  "verify-level3",
  "REPLACE_AFTER_DEPLOY"
) -join "|"

$Matches = Select-String `
  -Path $ScanFiles `
  -Pattern $StalePattern `
  -CaseSensitive:$false `
  -ErrorAction SilentlyContinue

if ($Matches) {
  $Matches
  throw "Stale project reference detected."
}

Step "Check sensitive artifacts are not tracked"

$Tracked = git ls-files

$Forbidden = $Tracked | Select-String `
  -Pattern "\.env$|\.env\.local$|\.xdr$|\.log$|node_modules|(^|/)target/" `
  -CaseSensitive:$false

if ($Forbidden) {
  $Forbidden
  throw "Sensitive or generated artifact is tracked."
}

Step "Remit Mainnet release verification passed"

git status
