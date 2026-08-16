export const CONTRACT_CONFIG = {
  network: "Mainnet",
  freighterNetwork: "PUBLIC",
  networkPassphrase:
    "Public Global Stellar Network ; September 2015",
  rpcUrl:
    "https://soroban-rpc.mainnet.stellar.gateway.fm",
  explorerBaseUrl:
    "https://stellar.expert/explorer/public",
  contractId:
    "CAQCTQQM7HAJEGGMUJ3EHZ2XFDOUOBOBRDMFOCC4S3XFXYEOL5VSSLSI",
  wasmPath:
    "target/wasm32v1-none/release/remittance_contract.wasm"
} as const;

export function getContractExplorerUrl(
  contractId = CONTRACT_CONFIG.contractId
): string {
  return `${CONTRACT_CONFIG.explorerBaseUrl}/contract/${contractId}`;
}

export function getTransactionExplorerUrl(hash: string): string {
  return `${CONTRACT_CONFIG.explorerBaseUrl}/tx/${hash}`;
}
