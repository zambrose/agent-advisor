"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";

// --- Trending helper types and parser ---
interface TrendingItem {
  name: string;
  symbol: string;
  price: string;
  icon: string;
}

function parseTrendingResponse(text: string): TrendingItem[] {
  const parts = text
    .trim()
    .split(/\d+\.\s+/)
    .filter((item) => item.trim() !== "");

  const items = parts.map((item) => {
    const boldMatch = item.match(/\*\*(.*?)\*\*/);
    let name = "";
    let symbol = "";
    if (boldMatch) {
      const fullName = boldMatch[1].trim();
      const matchNameSymbol = fullName.match(/^(.*?)\s*\((.*?)\)$/);
      if (matchNameSymbol) {
        name = matchNameSymbol[1].trim();
        symbol = matchNameSymbol[2].trim();
      } else {
        name = fullName;
      }
    }
    const priceMatch = item.match(/Price:\s*\$([\d,\.]+)/i);
    const price = priceMatch ? priceMatch[1].trim() : "";
    const iconMatch = item.match(/!\[.*?\]\((.*?)\)/);
    const icon = iconMatch ? iconMatch[1].trim() : "";
    return { name, symbol, price, icon };
  });
  return items.filter((item) => item.name && item.symbol && item.price);
}

// --- Swap recommendation types and parser ---
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

export default function ToolsPage() {
  // --- Section 1: Price Checker State ---
  const [ticker, setTicker] = useState("");
  const [priceResult, setPriceResult] = useState<string>("");
  const [loadingPrice, setLoadingPrice] = useState(false);

  // --- Section 2: Trending State ---
  const [trendingResult, setTrendingResult] = useState<string>("");
  const [loadingTrending, setLoadingTrending] = useState(false);
  const parsedTrending = useMemo(() => {
    if (!trendingResult) return [];
    return parseTrendingResponse(trendingResult);
  }, [trendingResult]);

  // --- Section 3: Swap Recommendation State ---
  const [timeHorizon, setTimeHorizon] = useState("5 min");
  const [swapRecommendation, setSwapRecommendation] =
    useState<SwapRecommendation | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [walletTokens, setWalletTokens] = useState<
    { symbol: string; balance: number }[]
  >([]);
  // Instead of activeNetwork, we now show chainId and rpcUrl.
  const [chainId, setChainId] = useState<string>("");
  const [rpcUrl, setRpcUrl] = useState<string>("");
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [performingSwap, setPerformingSwap] = useState(false);
  const [swapExecutionResult, setSwapExecutionResult] = useState<string>("");

  // --- Handler: Load Wallet Info Independently ---
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
    }
  }

  // Load wallet info on component mount.
  useEffect(() => {
    loadWalletInfo();
  }, []);

  // --- Handler: Price Checker ---
  async function handlePriceSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoadingPrice(true);
    setPriceResult("");
    try {
      const response = await fetch("/api/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      if (!response.ok) throw new Error("Failed to fetch price");
      const data = await response.json();
      setPriceResult(data.fullText);
    } catch (error) {
      console.error(error);
      setPriceResult("Error fetching price");
    } finally {
      setLoadingPrice(false);
    }
  }

  // --- Handler: Trending Data ---
  async function handleTrending() {
    setLoadingTrending(true);
    setTrendingResult("");
    try {
      const response = await fetch("/api/trending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error("Failed to fetch trending data");
      const data = await response.json();
      setTrendingResult(data.fullText);
    } catch (error) {
      console.error(error);
      setTrendingResult("Error fetching trending data");
    } finally {
      setLoadingTrending(false);
    }
  }

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
      if (!response.ok) throw new Error("Failed to fetch swap recommendation");
      const data = await response.json();
      const recommendation = parseSwapRecommendation(data.recommendation);
      setSwapRecommendation(recommendation);
    } catch (error) {
      console.error(error);
      setSwapRecommendation(null);
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
      if (!response.ok) throw new Error("Failed to perform swap");
      const data = await response.json();
      setSwapExecutionResult(data.message || "Swap executed successfully.");
    } catch (error) {
      console.error(error);
      setSwapExecutionResult("Error performing swap");
    } finally {
      setPerformingSwap(false);
    }
  }

  // --- Handler: Cancel Swap Recommendation ---
  function handleCancelSwap() {
    setSwapRecommendation(null);
    setSwapExecutionResult("");
  }

  return (
    <main className="p-8">
      <h1 className="text-xl font-bold mb-4">Tools Page</h1>

      {/* SECTION: Wallet Info */}
      <section className="mb-12 border-b pb-4">
        <h2 className="text-lg font-semibold mb-2">Wallet Info</h2>
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
                  <th className="border border-gray-300 px-4 py-2">Token</th>
                  <th className="border border-gray-300 px-4 py-2">Balance</th>
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
      </section>

      {/* SECTION 1: Crypto Price Checker */}
      <section className="mb-12 border-b pb-4">
        <h2 className="text-lg font-semibold mb-2">Crypto Price Checker</h2>
        <form
          onSubmit={handlePriceSubmit}
          className="flex flex-col gap-2 max-w-sm"
        >
          <label className="flex flex-col">
            <span className="mb-1">Enter Ticker Symbol (e.g. BTC):</span>
            <input
              className="border p-2"
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="BTC"
              required
            />
          </label>
          <button
            type="submit"
            className="bg-black text-white py-2 hover:bg-gray-800"
          >
            Submit
          </button>
        </form>
        {loadingPrice && <p className="mt-2 text-gray-500">Loading...</p>}
        {!loadingPrice && priceResult && (
          <p className="mt-2">
            <strong>Response:</strong> {priceResult}
          </p>
        )}
      </section>

      {/* SECTION 2: Trending Cryptocurrencies */}
      <section className="mb-12 border-b pb-4">
        <h2 className="text-lg font-semibold mb-2">
          Trending Cryptocurrencies
        </h2>
        <button
          onClick={handleTrending}
          className="bg-black text-white py-2 px-4 hover:bg-gray-800"
        >
          Get Trending Data
        </button>
        {loadingTrending && (
          <p className="mt-2 text-gray-500">Loading trending data...</p>
        )}
        {!loadingTrending && trendingResult && parsedTrending.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2">Symbol</th>
                  <th className="border border-gray-300 px-4 py-2">Name</th>
                  <th className="border border-gray-300 px-4 py-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {parsedTrending.map((item, index) => (
                  <tr key={index} className="text-center">
                    <td className="border border-gray-300 px-4 py-2">
                      <div className="flex items-center justify-center gap-2">
                        {item.icon && (
                          <Image
                            src={item.icon}
                            alt={item.symbol}
                            width={32}
                            height={32}
                            className="object-contain"
                            priority
                          />
                        )}
                        <span>{item.symbol}</span>
                      </div>
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {item.name}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      ${item.price}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECTION 3: Swap Recommendation */}
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
              {/* Allowed predictive tool timeframes */}
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
              <p className="mt-2">
                <strong>Swap Result:</strong> {swapExecutionResult}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
