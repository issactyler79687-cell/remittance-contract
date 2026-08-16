export const CONTRACT_CONFIG = {
  network: "testnet",
  networkPassphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://soroban-testnet.stellar.org",
  explorerBaseUrl: "https://stellar.expert/explorer/testnet",
  contractId: "CC4VBT3IZWXDWH56L2MOJZSKHQIHVW7VEB55J33VFOARTESV2OY7VDAS",
  wasmPath: "target/wasm32v1-none/release/remittance_contract.wasm"
};

export function getContractExplorerUrl(contractId = CONTRACT_CONFIG.contractId): string {
  return `${CONTRACT_CONFIG.explorerBaseUrl}/contract/${contractId}`;
}

export function getTransactionExplorerUrl(hash: string): string {
  return `${CONTRACT_CONFIG.explorerBaseUrl}/tx/${hash}`;
}