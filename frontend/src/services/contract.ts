import * as StellarSdk from "@stellar/stellar-sdk";
import { CONTRACT_CONFIG } from "../contractConfig";
import { signWithFreighter } from "./wallet";

const SDK = StellarSdk as any;

const RpcServer = SDK.rpc?.Server ?? SDK.SorobanRpc?.Server;
const Contract = SDK.Contract;
const TransactionBuilder = SDK.TransactionBuilder;
const Address = SDK.Address;
const nativeToScVal = SDK.nativeToScVal;
const scValToNative = SDK.scValToNative;

const STROOPS_PER_XLM = 10_000_000n;

export type RemittanceStatus =
  | "Pending"
  | "Claimed"
  | "Refunded"
  | string;

export type RemittanceRecord = {
  id: string;
  sender: string;
  receiver: string;
  amount: string;
  memo: string;
  status: RemittanceStatus;
  created_at: string;
  expires_at: string;
  updated_at: string;
};

export type RemittanceStats = {
  total_remittances: string;
  pending_remittances: string;
  claimed_remittances: string;
  refunded_remittances: string;
  active_amount: string;
  total_amount_created: string;
  total_amount_claimed: string;
  total_amount_refunded: string;
};

export type ContractResult<T = unknown> = {
  hash: string;
  status: string;
  result?: T;
};

function ensureContractReady(): void {
  if (!RpcServer || !Contract || !TransactionBuilder) {
    throw new Error("Stellar SDK RPC components are unavailable.");
  }

  if (!CONTRACT_CONFIG.contractId) {
    throw new Error(
      "Mainnet contract configuration is missing."
    );
  }
}

function getServer(): any {
  ensureContractReady();

  return new RpcServer(CONTRACT_CONFIG.rpcUrl, {
    allowHttp: CONTRACT_CONFIG.rpcUrl.startsWith("http://")
  });
}

function getContract(): any {
  ensureContractReady();
  return new Contract(CONTRACT_CONFIG.contractId);
}

function toAddressScVal(value: string): any {
  return new Address(value).toScVal();
}

function toU64ScVal(value: string | number | bigint): any {
  return nativeToScVal(BigInt(value), { type: "u64" });
}

function toI128ScVal(value: bigint): any {
  return nativeToScVal(value, { type: "i128" });
}

function toStringScVal(value: string): any {
  return nativeToScVal(value, { type: "string" });
}

function normalizeNative(value: any): any {
  if (value === undefined || value === null) {
    return undefined;
  }

  try {
    return scValToNative(value);
  } catch {
    return value;
  }
}

function getSimulationReturnValue(simulation: any): any {
  return (
    simulation?.result?.retval ??
    simulation?.result?.returnValue ??
    simulation?.retval ??
    simulation?.returnValue
  );
}

function getTransactionReturnValue(response: any): any {
  const direct =
    response?.returnValue ??
    response?.result?.returnValue ??
    response?.result?.retval;

  if (direct) {
    return direct;
  }

  try {
    const resultXdr = response?.resultXdr;

    if (resultXdr?.result) {
      const results = resultXdr.result().results();

      if (results?.length > 0) {
        return results[0]
          .tr()
          .invokeHostFunctionResult()
          .success()
          .returnValue();
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function unwrapValue(value: any): any {
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }

  return value;
}

function normalizeStatus(value: any): string {
  const native = unwrapValue(value);

  if (typeof native === "string") {
    return native;
  }

  if (Array.isArray(native) && native.length > 0) {
    return String(native[0]);
  }

  if (native && typeof native === "object") {
    const keys = Object.keys(native);

    if (keys.length === 1) {
      return keys[0];
    }
  }

  return String(native ?? "Unknown");
}

function normalizeRemittance(value: any): RemittanceRecord {
  const record = unwrapValue(value) ?? {};

  return {
    id: String(record.id ?? ""),
    sender: String(record.sender ?? ""),
    receiver: String(record.receiver ?? ""),
    amount: String(record.amount ?? "0"),
    memo: String(record.memo ?? ""),
    status: normalizeStatus(record.status),
    created_at: String(record.created_at ?? "0"),
    expires_at: String(record.expires_at ?? "0"),
    updated_at: String(record.updated_at ?? "0")
  };
}

function normalizeStats(value: any): RemittanceStats {
  const stats = unwrapValue(value) ?? {};

  return {
    total_remittances: String(stats.total_remittances ?? "0"),
    pending_remittances: String(stats.pending_remittances ?? "0"),
    claimed_remittances: String(stats.claimed_remittances ?? "0"),
    refunded_remittances: String(stats.refunded_remittances ?? "0"),
    active_amount: String(stats.active_amount ?? "0"),
    total_amount_created: String(stats.total_amount_created ?? "0"),
    total_amount_claimed: String(stats.total_amount_claimed ?? "0"),
    total_amount_refunded: String(stats.total_amount_refunded ?? "0")
  };
}

export function xlmToStroops(value: string): bigint {
  const trimmed = value.trim();

  if (!/^\d+(\.\d{1,7})?$/.test(trimmed)) {
    throw new Error(
      "Enter a valid XLM amount with no more than 7 decimal places."
    );
  }

  const [whole, fraction = ""] = trimmed.split(".");
  const paddedFraction = fraction.padEnd(7, "0");

  const result =
    BigInt(whole) * STROOPS_PER_XLM +
    BigInt(paddedFraction || "0");

  if (result <= 0n) {
    throw new Error("Amount must be greater than 0 XLM.");
  }

  return result;
}

export function stroopsToXlm(value: string | bigint): string {
  const amount = BigInt(value);
  const whole = amount / STROOPS_PER_XLM;
  const fraction = (amount % STROOPS_PER_XLM)
    .toString()
    .padStart(7, "0")
    .replace(/0+$/, "");

  return fraction ? `${whole}.${fraction}` : whole.toString();
}

async function buildContractTransaction(
  sourceAddress: string,
  functionName: string,
  args: any[]
): Promise<any> {
  const server = getServer();
  const contract = getContract();
  const sourceAccount = await server.getAccount(sourceAddress);

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: SDK.BASE_FEE,
    networkPassphrase: CONTRACT_CONFIG.networkPassphrase
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(60)
    .build();

  return server.prepareTransaction(transaction);
}

async function submitSignedTransaction(
  preparedTransaction: any,
  signerAddress: string
): Promise<ContractResult> {
  const server = getServer();

  const signedXdr = await signWithFreighter(
    preparedTransaction.toXDR(),
    signerAddress,
    CONTRACT_CONFIG.networkPassphrase
  );

  const signedTransaction = TransactionBuilder.fromXDR(
    signedXdr,
    CONTRACT_CONFIG.networkPassphrase
  );

  const sendResponse = await server.sendTransaction(signedTransaction);
  const hash = String(sendResponse.hash || "");

  if (!hash) {
    throw new Error("Transaction submitted but no transaction hash was returned.");
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await server.getTransaction(hash);
    const status = String(response.status ?? "UNKNOWN");

    if (status === "SUCCESS") {
      return {
        hash,
        status,
        result: normalizeNative(getTransactionReturnValue(response))
      };
    }

    if (status === "FAILED" || status === "ERROR") {
      throw new Error(`Transaction failed with status ${status}.`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return {
    hash,
    status: "PENDING"
  };
}

async function invokeWrite(
  sourceAddress: string,
  functionName: string,
  args: any[]
): Promise<ContractResult> {
  const prepared = await buildContractTransaction(
    sourceAddress,
    functionName,
    args
  );

  return submitSignedTransaction(prepared, sourceAddress);
}

async function invokeRead<T>(
  sourceAddress: string,
  functionName: string,
  args: any[]
): Promise<T> {
  const server = getServer();
  const contract = getContract();
  const sourceAccount = await server.getAccount(sourceAddress);

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: SDK.BASE_FEE,
    networkPassphrase: CONTRACT_CONFIG.networkPassphrase
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(60)
    .build();

  const simulation = await server.simulateTransaction(transaction);

  if (SDK.rpc?.Api?.isSimulationError?.(simulation)) {
    throw new Error(
      simulation.error ?? "Contract simulation failed."
    );
  }

  return normalizeNative(getSimulationReturnValue(simulation)) as T;
}

export async function createRemittance(params: {
  sender: string;
  receiver: string;
  amountXlm: string;
  memo: string;
  expiresAt: number;
}): Promise<ContractResult> {
  const amount = xlmToStroops(params.amountXlm);

  return invokeWrite(params.sender, "create_remittance", [
    toAddressScVal(params.sender),
    toAddressScVal(params.receiver),
    toI128ScVal(amount),
    toStringScVal(params.memo),
    toU64ScVal(params.expiresAt)
  ]);
}

export async function claimRemittance(params: {
  receiver: string;
  remittanceId: string;
}): Promise<ContractResult> {
  return invokeWrite(params.receiver, "claim_remittance", [
    toU64ScVal(params.remittanceId),
    toAddressScVal(params.receiver)
  ]);
}

export async function refundRemittance(params: {
  sender: string;
  remittanceId: string;
}): Promise<ContractResult> {
  return invokeWrite(params.sender, "refund_remittance", [
    toU64ScVal(params.remittanceId),
    toAddressScVal(params.sender)
  ]);
}

export async function getRemittance(
  sourceAddress: string,
  remittanceId: string
): Promise<RemittanceRecord> {
  const value = await invokeRead<any>(
    sourceAddress,
    "get_remittance",
    [toU64ScVal(remittanceId)]
  );

  return normalizeRemittance(value);
}

export async function getStats(
  sourceAddress: string
): Promise<RemittanceStats> {
  const value = await invokeRead<any>(
    sourceAddress,
    "get_stats",
    []
  );

  return normalizeStats(value);
}

export async function getCounter(
  sourceAddress: string
): Promise<string> {
  const value = await invokeRead<any>(
    sourceAddress,
    "get_counter",
    []
  );

  return String(value ?? "0");
}

export async function getToken(
  sourceAddress: string
): Promise<string> {
  const value = await invokeRead<any>(
    sourceAddress,
    "get_token",
    []
  );

  return String(value ?? "");
}