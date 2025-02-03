import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

import { http } from "viem";
import { createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mode } from "viem/chains";

import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { erc20 } from "@goat-sdk/plugin-erc20";
import { kim } from "@goat-sdk/plugin-kim";
import { viem } from "@goat-sdk/wallet-viem";

export async function POST(request: Request) {
  console.log("perform swap: ", request);
  // Set up the wallet.
  const account = privateKeyToAccount(
    process.env.WALLET_PRIVATE_KEY as `0x${string}`
  );

  const walletClient = createWalletClient({
    account,
    transport: http(process.env.RPC_PROVIDER_URL),
    chain: mode,
  });

  // For Mode (chainId 34443), override token addresses and ensure correct checksums.
  const tokensList = [
    {
      decimals: 6,
      symbol: "USDC",
      name: "USDC",
      chains: {
        "34443": {
          // Make sure you’re using the Mode USDC address with proper checksum:
          contractAddress:
            "0xd988097fB8612cC24eeC14542bC03424c656005f" as `0x${string}`,
        },
      },
    },
    {
      decimals: 18,
      symbol: "AAVE",
      name: "Aave",
      chains: {
        "34443": {
          // Ensure proper checksum and that this token exists on Mode.
          contractAddress:
            "0x7c6b91D9Be155A6Db01f749217d76fF02A7227F2" as `0x${string}`,
        },
      },
    },
  ];

  // Initialize the on-chain tools with the ERC20 and other plugins.
  const tools = await getOnChainTools({
    wallet: viem(walletClient),
    plugins: [erc20({ tokens: tokensList }), kim()],
  });

  // const body = await request.json();
  // const { fromToken, toToken } = body;

  // Build a prompt that instructs the agent to perform a swap.
  const prompt = `User's wallet address: ${account.address}.
Perform a swap of 0.01 AAVE TO USDC via kim. Ensure the swap takes place on the Mode chain with chain ID 34443. Ensure that we swap AAVE 0x7c6b91D9Be155A6Db01f749217d76fF02A7227F2 to USDC 0xd988097fB8612cC24eeC14542bC03424c656005f.
USDC should be sent to the user's wallet address. Wallet address: ${account.address}.
For the swap, please provide if available:
  - The transaction hash,
  - The transaction receipt,
  - Detailed transaction parameters,
  - The status and any error messages if present.

Return the full details of the swap.`;

  try {
    const result = await generateText({
      model: openai("gpt-4o-mini"),
      tools,
      maxSteps: 10,
      prompt,
    });

    console.log("result ⭐⭐⭐");
    console.log(result);

    // Return the result text along with the raw tool call logs (if available)
    return NextResponse.json({
      status: "success",
      message: result.text,
      toolCalls: result.toolCalls || [], // if your library provides this
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Swap execution failed:", error);
    console.log("error 👆⭐");
    console.log(error.cause);
    console.log("----");
    // Build a more complete error object to return to the UI.
    const errorResponse = {
      status: "error",
      message:
        error.message || "An unknown error occurred during swap execution.",
      // If available, include details from the error's cause or any tool logs.
      details: error.cause || error,
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
