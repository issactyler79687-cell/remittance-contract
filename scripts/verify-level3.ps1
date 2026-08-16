$ErrorActionPreference = "Stop"

function Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "=== $Message ==="
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

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
  "scripts/deploy-and-save.ps1",
  "CONTRACT_ID.txt",
  "TX_HASH.txt",
  "DEPLOYMENT.md",
  ".github/workflows/ci.yml"
)

foreach ($File in $RequiredFiles) {
  if (-not (Test-Path $File)) {
    throw "Missing required file: $File"
  }

  Write-Host "OK: $File"
}

Step "Check contract formatting"

cargo fmt --all -- --check

Step "Run contract tests"

cargo test --workspace

Step "Build contract WASM"

cargo build --workspace --target wasm32v1-none --release

Step "Check frontend"

Set-Location (Join-Path $RepoRoot "frontend")

npm ci
npm run type-check
npm run build
npm test

Set-Location $RepoRoot

Step "Check public docs do not contain unsafe internal terms"

$SensitivePattern = "AI Review|AI_REVIEW|leak|judge|ban giám khảo|hidden|internal review"

$DocsToScan = @(
  "README.md",
  "DEPLOYMENT.md",
  ".github/workflows/ci.yml",
  "frontend/src/App.tsx",
  "frontend/src/services/contract.ts",
  "scripts/deploy-and-save.ps1"
)

$Matches = Select-String -Path $DocsToScan -Pattern $SensitivePattern -CaseSensitive:$false -ErrorAction SilentlyContinue

if ($Matches) {
  $Matches
  throw "Unsafe public wording detected."
}

Step "Level 3 local verification passed"

git status