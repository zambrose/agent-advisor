import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { http } from "viem";
import { createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mode } from "viem/chains";

import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { coingecko } from "@goat-sdk/plugin-coingecko";
import { viem } from "@goat-sdk/wallet-viem";

// This route does not require any input from the client.
export async function POST(request: Request) {
  const account = privateKeyToAccount(
    process.env.WALLET_PRIVATE_KEY as `0x${string}`
  );

  const walletClient = createWalletClient({
    account: account,
    transport: http(process.env.RPC_PROVIDER_URL),
    chain: mode,
  });

  const tools = await getOnChainTools({
    plugins: [coingecko({ apiKey: process.env.COINGECKO_API_KEY as string })],
    wallet: viem(walletClient),
  });

  // Use a prompt that asks for trending cryptocurrencies and their prices.
  const result = await generateText({
    model: openai("gpt-4o-mini"),
    tools: tools,
    maxSteps: 5,
    prompt: `Can you list the current trending cryptocurrencies along with their prices?`,
  });

  return NextResponse.json({
    fullText: result.text,
  });
}
