"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SwapRecommendation {
  fromToken: string;
  toToken: string;
  raw: string;
}

function parseSwapRecommendation(text: string): SwapRecommendation | null {
  const regex = /Swap\s+(\S+)\s+to\s+(\S+)/i;
  const match = text.match(regex);
  if (match) {
    return {
      fromToken: match[1],
      toToken: match[2],
      raw: text,
    };
  }
  return null;
}

export default function Home() {
  // --- Swap Recommendation State ---
  const [timeHorizon, setTimeHorizon] = useState("5 min");
  const [swapRecommendation, setSwapRecommendation] =
    useState<SwapRecommendation | null>(null);
  const [swapExecutionResult, setSwapExecutionResult] = useState<string>("");
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [performingSwap, setPerformingSwap] = useState(false);

  // --- Wallet Info State ---
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [walletTokens, setWalletTokens] = useState<
    { symbol: string; balance: number }[]
  >([]);
  const [chainId, setChainId] = useState<string>("");
  const [rpcUrl, setRpcUrl] = useState<string>("");
  const [loadingWalletInfo, setLoadingWalletInfo] = useState(true);

  // --- Handler: Load Wallet Info ---
  async function loadWalletInfo() {
    try {
      const response = await fetch("/api/wallet-info", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to fetch wallet info");
      const data = await response.json();
      setWalletAddress(data.walletAddress);
      setChainId(data.chainId);
      setRpcUrl(data.rpcUrl);
      setWalletTokens(data.walletTokens || []);
    } catch (error) {
      console.error("Error loading wallet info:", error);
    } finally {
      setLoadingWalletInfo(false);
    }
  }

  useEffect(() => {
    loadWalletInfo();
  }, []);

  // --- Handler: Swap Recommendation ---
  async function handleRecommendSwap() {
    setLoadingRecommendation(true);
    setSwapRecommendation(null);
    setSwapExecutionResult("");
    try {
      const response = await fetch("/api/recommend-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeHorizon }),
      });
      const data = await response.json();

      // If the API returns a field that indicates an error, throw it
      if (data.status === "error" || data.error) {
        throw data;
      }

      const recommendation = parseSwapRecommendation(data.recommendation);
      setSwapRecommendation(recommendation);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Swap recommendation error:", error);
      let errorMsg = "Error fetching swap recommendation";
      if (error && typeof error === "object") {
        if (error.message) errorMsg += `: ${error.message}`;
        if (error.details) errorMsg += ` - ${JSON.stringify(error.details)}`;
      }
      setSwapExecutionResult(errorMsg);
    } finally {
      setLoadingRecommendation(false);
    }
  }

  // --- Handler: Perform Swap ---
  async function handlePerformSwap() {
    if (!swapRecommendation) return;
    setPerformingSwap(true);
    setSwapExecutionResult("");
    try {
      const response = await fetch("/api/perform-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromToken: swapRecommendation.fromToken,
          toToken: swapRecommendation.toToken,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw data;
      }
      setSwapExecutionResult(data.message || "Swap executed successfully.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Swap execution error:", error);
      let errorMsg = "Error performing swap";
      if (error && typeof error === "object") {
        if (error.message) {
          errorMsg += `\nMessage: ${error.message}`;
        }
        if (error.toolName) {
          errorMsg += `\nTool Name: ${error.toolName}`;
        }
        if (error.toolCallId) {
          errorMsg += `\nTool Call ID: ${error.toolCallId}`;
        }
        if (error.cause) {
          const causeStr =
            typeof error.cause === "object"
              ? JSON.stringify(error.cause, null, 2)
              : error.cause;
          errorMsg += `\nCause: ${causeStr}`;
        }
      }
      setSwapExecutionResult(errorMsg);
    } finally {
      setPerformingSwap(false);
    }
  }

  function handleCancelSwap() {
    setSwapRecommendation(null);
    setSwapExecutionResult("");
  }

  return (
    <main className="p-8">
      <h1 className="text-xl font-bold mb-4">Agent Advisor</h1>

      {/* Wallet Info Section */}
      <section className="mb-12 border-b pb-4">
        <h2 className="text-lg font-semibold mb-2">Wallet Info</h2>
        {loadingWalletInfo ? (
          <p>Loading wallet info...</p>
        ) : (
          <>
            {walletAddress && (
              <p>
                <strong>Wallet Address:</strong> {walletAddress}
              </p>
            )}
            {chainId && (
              <p>
                <strong>Chain ID:</strong> {chainId}
              </p>
            )}
            {rpcUrl && (
              <p>
                <strong>RPC URL:</strong> {rpcUrl}
              </p>
            )}
            {walletTokens && walletTokens.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2">
                        Token
                      </th>
                      <th className="border border-gray-300 px-4 py-2">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {walletTokens.map((token, index) => (
                      <tr key={index} className="text-center">
                        <td className="border border-gray-300 px-4 py-2">
                          {token.symbol}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {token.balance}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No tokens found in wallet.</p>
            )}
          </>
        )}
      </section>

      {/* Swap Recommendation Section */}
      <section className="mt-4">
        <h2 className="text-lg font-semibold mb-2">Swap Recommendation</h2>
        <div className="flex items-center gap-4 mb-2">
          <label>
            Time Horizon:
            <select
              value={timeHorizon}
              onChange={(e) => setTimeHorizon(e.target.value)}
              className="ml-2 border p-1"
            >
              <option value="5 min">5 min</option>
              <option value="8 hours">8 hours</option>
            </select>
          </label>
          <button
            onClick={handleRecommendSwap}
            className="bg-black text-white py-2 px-4 hover:bg-gray-800"
          >
            Recommend Swap
          </button>
        </div>
        {loadingRecommendation && (
          <p className="text-gray-500">Loading recommendation...</p>
        )}
        {swapRecommendation && (
          <div className="mt-2 border p-4">
            <p>
              <strong>Recommended Swap:</strong> Swap{" "}
              <span className="font-mono">{swapRecommendation.fromToken}</span>{" "}
              to <span className="font-mono">{swapRecommendation.toToken}</span>
            </p>
            <p>
              <strong>Your Wallet Address:</strong> {walletAddress}
            </p>
            <div className="mt-2 flex items-center gap-4">
              <button
                onClick={handlePerformSwap}
                className="bg-green-600 text-white py-2 px-4 hover:bg-green-700"
                disabled={performingSwap}
              >
                {performingSwap ? "Performing Swap..." : "Perform Swap"}
              </button>
              <button
                onClick={handleCancelSwap}
                className="text-red-600 underline"
              >
                Cancel
              </button>
            </div>
            {swapExecutionResult && (
              <div className="mt-2 p-2 border border-red-400 bg-red-100">
                <strong>Swap Result:</strong>
                <pre className="whitespace-pre-wrap">{swapExecutionResult}</pre>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Additional Tools Link Section */}
      <section className="mt-8">
        <Link href="/tools" className="text-blue-500 underline">
          Additional Tools &rarr;
        </Link>
      </section>
    </main>
  );
}
