import { useMemo, useState } from "react";
import {
  CONTRACT_CONFIG,
  getContractExplorerUrl,
  getTransactionExplorerUrl
} from "./contractConfig";
import {
  claimRemittance,
  createRemittance,
  getRemittance,
  getStats,
  refundRemittance,
  stroopsToXlm,
  type ContractResult,
  type RemittanceRecord,
  type RemittanceStats
} from "./services/contract";
import { connectFreighterWallet } from "./services/wallet";

type Notice = {
  type: "success" | "error" | "info";
  text: string;
  hash?: string;
};

const emptyStats: RemittanceStats = {
  total_remittances: "0",
  pending_remittances: "0",
  claimed_remittances: "0",
  refunded_remittances: "0",
  active_amount: "0",
  total_amount_created: "0",
  total_amount_claimed: "0",
  total_amount_refunded: "0"
};

function shorten(value: string): string {
  if (!value) return "Not connected";
  if (value.length <= 18) return value;

  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

function formatDate(timestamp: string): string {
  const value = Number(timestamp);

  if (!value) return "—";

  return new Date(value * 1000).toLocaleString();
}

function App() {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const [receiver, setReceiver] = useState("");
  const [amountXlm, setAmountXlm] = useState("1");
  const [memo, setMemo] = useState("");
  const [expirySeconds, setExpirySeconds] = useState("3600");

  const [remittanceId, setRemittanceId] = useState("1");
  const [selected, setSelected] =
    useState<RemittanceRecord | null>(null);

  const [stats, setStats] =
    useState<RemittanceStats>(emptyStats);

  const contractReady = useMemo(
    () =>
      Boolean(CONTRACT_CONFIG.contractId) &&
      CONTRACT_CONFIG.contractId !== "REPLACE_AFTER_DEPLOY",
    []
  );

  const connected = Boolean(walletAddress);

  function requireWallet(): string {
    if (!walletAddress) {
      throw new Error("Connect your Freighter wallet first.");
    }

    return walletAddress;
  }

  function handleError(error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Something went wrong.";

    setNotice({
      type: "error",
      text: message
    });
  }

  function handleTransaction(
    label: string,
    result: ContractResult
  ) {
    setNotice({
      type: result.status === "SUCCESS" ? "success" : "info",
      text:
        result.status === "SUCCESS"
          ? `${label} confirmed on Stellar.`
          : `${label} submitted. Status: ${result.status}`,
      hash: result.hash
    });
  }

  async function connectWallet() {
    setLoading("Connecting wallet");
    setNotice(null);

    try {
      const result = await connectFreighterWallet();

      if (!result.connected) {
        throw new Error(result.error);
      }

      setWalletAddress(result.address);

      setNotice({
        type: "success",
        text: "Freighter connected."
      });

      if (contractReady) {
        const nextStats = await getStats(result.address);
        setStats(nextStats);
      }
    } catch (error) {
      handleError(error);
    } finally {
      setLoading("");
    }
  }

  function disconnectWallet() {
    setWalletAddress("");
    setSelected(null);
    setStats(emptyStats);

    setNotice({
      type: "info",
      text: "Wallet disconnected."
    });
  }

  async function refreshStats() {
    try {
      const address = requireWallet();
      const nextStats = await getStats(address);
      setStats(nextStats);
    } catch (error) {
      handleError(error);
    }
  }

  async function handleSend() {
    setLoading("Preparing remittance");
    setNotice(null);

    try {
      const sender = requireWallet();

      if (!receiver.trim()) {
        throw new Error("Enter the receiver wallet address.");
      }

      const duration = Number(expirySeconds);

      if (!Number.isFinite(duration) || duration < 60) {
        throw new Error("Choose a valid expiry period.");
      }

      const expiresAt =
        Math.floor(Date.now() / 1000) + duration;

      const result = await createRemittance({
        sender,
        receiver: receiver.trim(),
        amountXlm,
        memo: memo.trim(),
        expiresAt
      });

      handleTransaction("Remittance", result);

      if (result.status === "SUCCESS") {
        setReceiver("");
        setMemo("");
        await refreshStats();
      }
    } catch (error) {
      handleError(error);
    } finally {
      setLoading("");
    }
  }

  async function handleClaim() {
    setLoading("Claiming remittance");
    setNotice(null);

    try {
      const receiverAddress = requireWallet();

      const result = await claimRemittance({
        receiver: receiverAddress,
        remittanceId
      });

      handleTransaction("Claim", result);

      if (result.status === "SUCCESS") {
        await refreshStats();
        await handleLookup(false);
      }
    } catch (error) {
      handleError(error);
    } finally {
      setLoading("");
    }
  }

  async function handleRefund() {
    setLoading("Refunding remittance");
    setNotice(null);

    try {
      const sender = requireWallet();

      const result = await refundRemittance({
        sender,
        remittanceId
      });

      handleTransaction("Refund", result);

      if (result.status === "SUCCESS") {
        await refreshStats();
        await handleLookup(false);
      }
    } catch (error) {
      handleError(error);
    } finally {
      setLoading("");
    }
  }

  async function handleLookup(showNotice = true) {
    try {
      const address = requireWallet();

      if (!remittanceId.trim()) {
        throw new Error("Enter a remittance ID.");
      }

      const record = await getRemittance(
        address,
        remittanceId
      );

      setSelected(record);

      if (showNotice) {
        setNotice({
          type: "success",
          text: `Remittance #${record.id} loaded.`
        });
      }
    } catch (error) {
      setSelected(null);

      if (showNotice) {
        handleError(error);
      }
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">R</div>

          <div>
            <strong>Remit</strong>
            <span>Stellar escrow remittance</span>
          </div>
        </div>

        <div className="wallet-area">
          <span className="network-badge">
            {CONTRACT_CONFIG.network}
          </span>

          {connected ? (
            <>
              <span className="wallet-address">
                {shorten(walletAddress)}
              </span>

              <button
                className="ghost-button"
                onClick={disconnectWallet}
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              className="primary-button"
              onClick={connectWallet}
              disabled={Boolean(loading)}
            >
              Connect Freighter
            </button>
          )}
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">
            SEND WITH A SAFETY WINDOW
          </p>

          <h1>
            Send XLM.
            <br />
            Claim when ready.
          </h1>

          <p className="hero-copy">
            XLM is locked on Stellar until the receiver
            claims it. If the transfer expires first,
            the sender can recover the funds.
          </p>
        </div>

        <div className="hero-proof">
          <span>Powered by Stellar</span>
          <strong>Non-custodial escrow</strong>

          {contractReady ? (
            <a
              href={getContractExplorerUrl()}
              target="_blank"
              rel="noreferrer"
            >
              View contract ↗
            </a>
          ) : (
            <small>Contract deployment pending</small>
          )}
        </div>
      </section>

      {!contractReady && (
        <div className="notice info">
          Contract is not deployed yet. The interface is
          ready for Testnet configuration.
        </div>
      )}

      {notice && (
        <div className={`notice ${notice.type}`}>
          <span>{notice.text}</span>

          {notice.hash && (
            <a
              href={getTransactionExplorerUrl(notice.hash)}
              target="_blank"
              rel="noreferrer"
            >
              View transaction ↗
            </a>
          )}
        </div>
      )}

      <section className="metrics">
        <article>
          <span>Pending</span>
          <strong>{stats.pending_remittances}</strong>
        </article>

        <article>
          <span>Locked</span>
          <strong>
            {stroopsToXlm(stats.active_amount)} XLM
          </strong>
        </article>

        <article>
          <span>Claimed</span>
          <strong>{stats.claimed_remittances}</strong>
        </article>

        <article>
          <span>Refunded</span>
          <strong>{stats.refunded_remittances}</strong>
        </article>
      </section>

      <section className="workspace">
        <article className="send-card">
          <div className="section-heading">
            <div>
              <p className="step-label">01</p>
              <h2>Send XLM</h2>
            </div>

            <span>Escrow transfer</span>
          </div>

          <label>
            Receiver
            <input
              value={receiver}
              onChange={(event) =>
                setReceiver(event.target.value)
              }
              placeholder="G..."
            />
          </label>

          <div className="field-grid">
            <label>
              Amount
              <div className="amount-input">
                <input
                  value={amountXlm}
                  onChange={(event) =>
                    setAmountXlm(event.target.value)
                  }
                  inputMode="decimal"
                  placeholder="1"
                />
                <span>XLM</span>
              </div>
            </label>

            <label>
              Claim window
              <select
                value={expirySeconds}
                onChange={(event) =>
                  setExpirySeconds(event.target.value)
                }
              >
                <option value="3600">1 hour</option>
                <option value="21600">6 hours</option>
                <option value="86400">24 hours</option>
                <option value="259200">3 days</option>
                <option value="604800">7 days</option>
              </select>
            </label>
          </div>

          <label>
            Note
            <input
              value={memo}
              maxLength={120}
              onChange={(event) =>
                setMemo(event.target.value)
              }
              placeholder="Optional message"
            />
          </label>

          <button
            className="send-button"
            onClick={handleSend}
            disabled={
              Boolean(loading) ||
              !connected ||
              !contractReady
            }
          >
            {loading === "Preparing remittance"
              ? "Preparing..."
              : "Lock & send XLM"}
          </button>

          <p className="helper-text">
            Your wallet signs the transaction. Remit never
            asks for your private key or recovery phrase.
          </p>
        </article>

        <article className="manage-card">
          <div className="section-heading">
            <div>
              <p className="step-label">02</p>
              <h2>Manage transfer</h2>
            </div>
          </div>

          <label>
            Remittance ID
            <input
              value={remittanceId}
              onChange={(event) =>
                setRemittanceId(event.target.value)
              }
              inputMode="numeric"
              placeholder="1"
            />
          </label>

          <button
            className="lookup-button"
            onClick={() => handleLookup()}
            disabled={
              Boolean(loading) ||
              !connected ||
              !contractReady
            }
          >
            Find remittance
          </button>

          {selected ? (
            <div className="remittance-detail">
              <div className="detail-top">
                <strong>#{selected.id}</strong>
                <span
                  className={`status ${selected.status.toLowerCase()}`}
                >
                  {selected.status}
                </span>
              </div>

              <dl>
                <div>
                  <dt>Amount</dt>
                  <dd>
                    {stroopsToXlm(selected.amount)} XLM
                  </dd>
                </div>

                <div>
                  <dt>Sender</dt>
                  <dd>{shorten(selected.sender)}</dd>
                </div>

                <div>
                  <dt>Receiver</dt>
                  <dd>{shorten(selected.receiver)}</dd>
                </div>

                <div>
                  <dt>Expires</dt>
                  <dd>
                    {formatDate(selected.expires_at)}
                  </dd>
                </div>

                {selected.memo && (
                  <div>
                    <dt>Note</dt>
                    <dd>{selected.memo}</dd>
                  </div>
                )}
              </dl>

              {selected.status === "Pending" && (
                <div className="action-row">
                  <button
                    className="claim-button"
                    onClick={handleClaim}
                    disabled={Boolean(loading)}
                  >
                    Claim XLM
                  </button>

                  <button
                    className="refund-button"
                    onClick={handleRefund}
                    disabled={Boolean(loading)}
                  >
                    Refund after expiry
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <span>↗</span>
              <p>
                Enter an ID to view its sender, receiver,
                amount and status.
              </p>
            </div>
          )}
        </article>
      </section>

      <footer>
        <span>
          Stellar • {CONTRACT_CONFIG.network}
        </span>

        <button
          className="text-button"
          onClick={refreshStats}
          disabled={!connected || !contractReady}
        >
          Refresh stats
        </button>
      </footer>
    </main>
  );
}

export default App;