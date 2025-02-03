"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

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

// --- Price Checker (if needed) state ---
export default function ToolsPage() {
  // --- Price Checker State ---
  const [ticker, setTicker] = useState("");
  const [priceResult, setPriceResult] = useState<string>("");
  const [loadingPrice, setLoadingPrice] = useState(false);

  // --- Trending State ---
  const [trendingResult, setTrendingResult] = useState<string>("");
  const [loadingTrending, setLoadingTrending] = useState(false);
  const parsedTrending = useMemo(() => {
    if (!trendingResult) return [];
    return parseTrendingResponse(trendingResult);
  }, [trendingResult]);

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

  return (
    <main className="p-8">
      <h1 className="text-xl font-bold mb-4">Additional Tools</h1>

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

      {/* Crypto Price Checker Section */}
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

      {/* Trending Cryptocurrencies Section */}
      <section className="mb-12">
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

      {/* NOTE: Swap Recommendation Section removed */}

      {/* Navigation Link: Back to Home */}
      <section className="mt-8">
        <Link href="/" className="text-blue-500 underline">
          &larr; Home
        </Link>
      </section>
    </main>
  );
}
