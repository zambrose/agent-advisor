import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { http } from "viem";
import { createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mode } from "viem/chains";

import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { MODE, USDC, erc20 } from "@goat-sdk/plugin-erc20";
import { kim } from "@goat-sdk/plugin-kim";
import { allora } from "@goat-sdk/plugin-allora";

import { sendETH } from "@goat-sdk/wallet-evm";
import { viem } from "@goat-sdk/wallet-viem";
import { coingecko } from "@goat-sdk/plugin-coingecko";

// This route expects a POST request with { ticker: string } in the body.
export async function POST(request: Request) {
  const account = privateKeyToAccount(
    process.env.WALLET_PRIVATE_KEY as `0x${string}`
  );

  const walletClient = createWalletClient({
    account: account,
    transport: http(process.env.RPC_PROVIDER_URL),
    chain: mode,
  });

  // 1. Parse the request body (e.g., { ticker: "BTC" }).
  const body = await request.json();
  const { ticker } = body;

  const tools = await getOnChainTools({
    plugins: [coingecko({ apiKey: process.env.COINGECKO_API_KEY as string })],
    wallet: viem(walletClient),
  });

  // 2. Generate text via OpenAI using your tools.
  const result = await generateText({
    model: openai("gpt-4o-mini"),
    tools: tools,
    maxSteps: 5,
    prompt: `Can you fetch the current price of ${ticker}`,
  });

  // 3. Return the full response text back to the UI.
  return NextResponse.json({
    fullText: result.text,
    ticker,
  });
}
