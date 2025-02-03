import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { http } from "viem";
import { createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mode } from "viem/chains";

import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { kim } from "@goat-sdk/plugin-kim";
import { viem } from "@goat-sdk/wallet-viem";

export async function POST(request: Request) {
  const body = await request.json();
  const { fromToken, toToken } = body;
  // For this example, we assume that fromToken and toToken are provided
  // as token addresses or symbols that the kim plugin understands.
  // The swap should only swap 5% of the current balance of fromToken.

  // Initialize wallet and on-chain client.
  const account = privateKeyToAccount(
    process.env.WALLET_PRIVATE_KEY as `0x${string}`
  );
  const walletClient = createWalletClient({
    account,
    transport: http(process.env.RPC_PROVIDER_URL),
    chain: mode,
  });

  // Set up the on-chain tools with the kim plugin.
  const tools = await getOnChainTools({
    wallet: viem(walletClient),
    plugins: [kim()],
  });

  // Build a prompt that instructs the LLM (via generateText) to execute a swap.
  // We specify that it should swap exactly 5% of the current balance of fromToken to toToken.
  // The kim plugin is expected to handle the transaction.
  const prompt = `Please perform a token swap using the kim plugin as follows:
- Swap exactly 5% of my current ${fromToken} balance to ${toToken}.
- Use my on-chain wallet (with the private key already configured) to execute the swap.
- Return a confirmation message when the swap is complete.
Only swap 2% at a time.`;

  // Call generateText so that the LLM (using the available tools) performs the swap.
  const result = await generateText({
    model: openai("gpt-4o-mini"),
    tools,
    maxSteps: 5,
    prompt,
  });

  return NextResponse.json({
    status: "success",
    message: result.text,
  });
}
