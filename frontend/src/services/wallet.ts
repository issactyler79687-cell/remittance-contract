import * as Freighter from "@stellar/freighter-api";

const FREIGHTER = Freighter as any;

export type WalletState = {
  connected: boolean;
  address: string;
  error: string;
};

function pickAddress(value: unknown): string {
  const result = value as any;

  if (typeof result === "string") {
    return result;
  }

  if (result?.address) {
    return String(result.address);
  }

  if (result?.publicKey) {
    return String(result.publicKey);
  }

  if (result?.result?.address) {
    return String(result.result.address);
  }

  return "";
}

function pickError(value: unknown): string {
  const result = value as any;

  if (typeof result?.error === "string") {
    return result.error;
  }

  if (typeof result?.message === "string") {
    return result.message;
  }

  return "";
}

export async function checkFreighterConnection(): Promise<boolean> {
  try {
    const isConnected = FREIGHTER.isConnected;
    const response = typeof isConnected === "function" ? await isConnected() : true;

    if (typeof response === "boolean") {
      return response;
    }

    if (typeof response?.isConnected === "boolean") {
      return response.isConnected;
    }

    return true;
  } catch {
    return false;
  }
}

export async function connectFreighterWallet(): Promise<WalletState> {
  try {
    const connected = await checkFreighterConnection();

    if (!connected) {
      return {
        connected: false,
        address: "",
        error: "Freighter wallet is not available. Please install Freighter and switch to Stellar Testnet."
      };
    }

    const setAllowed = FREIGHTER.setAllowed;
    const requestAccess = FREIGHTER.requestAccess;
    const getAddress = FREIGHTER.getAddress;

    if (typeof setAllowed === "function") {
      await setAllowed();
    }

    let address = "";

    if (typeof requestAccess === "function") {
      const accessResponse = await requestAccess();
      const accessError = pickError(accessResponse);

      if (accessError) {
        return {
          connected: false,
          address: "",
          error: accessError
        };
      }

      address = pickAddress(accessResponse);
    }

    if (!address && typeof getAddress === "function") {
      const addressResponse = await getAddress();
      const addressError = pickError(addressResponse);

      if (addressError) {
        return {
          connected: false,
          address: "",
          error: addressError
        };
      }

      address = pickAddress(addressResponse);
    }

    if (!address) {
      return {
        connected: false,
        address: "",
        error: "Wallet access was approved, but no public address was returned."
      };
    }

    return {
      connected: true,
      address,
      error: ""
    };
  } catch (error) {
    return {
      connected: false,
      address: "",
      error: error instanceof Error ? error.message : "Wallet connection failed."
    };
  }
}

export async function getConnectedAddress(): Promise<string> {
  const getAddress = FREIGHTER.getAddress;

  if (typeof getAddress !== "function") {
    throw new Error("Freighter getAddress is not available.");
  }

  const response = await getAddress();
  const error = pickError(response);

  if (error) {
    throw new Error(error);
  }

  const address = pickAddress(response);

  if (!address) {
    throw new Error("No Freighter address returned.");
  }

  return address;
}

export async function signWithFreighter(xdr: string, address: string, networkPassphrase: string): Promise<string> {
  const signTransaction = FREIGHTER.signTransaction;

  if (typeof signTransaction !== "function") {
    throw new Error("Freighter signTransaction is not available.");
  }

  const response = await signTransaction(xdr, {
    address,
    networkPassphrase
  });

  const result = response as any;

  if (typeof result === "string") {
    return result;
  }

  if (result?.signedTxXdr) {
    return String(result.signedTxXdr);
  }

  if (result?.signedXDR) {
    return String(result.signedXDR);
  }

  if (result?.error) {
    throw new Error(String(result.error));
  }

  throw new Error("Freighter did not return a signed transaction XDR.");
}