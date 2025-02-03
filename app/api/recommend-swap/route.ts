import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { http } from "viem";

import { createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mode } from "viem/chains"; // This is your active chain (e.g., mode)

import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { allora } from "@goat-sdk/plugin-allora";
import { coingecko } from "@goat-sdk/plugin-coingecko";
import { erc20 } from "@goat-sdk/plugin-erc20";
import { viem } from "@goat-sdk/wallet-viem";

export async function POST(request: Request) {
  const body = await request.json();
  // Expecting timeHorizon to be either "5m" or "8h" (we restrict input on the client)
  const { timeHorizon } = body;
  const validTimeframes = ["5m", "8h"];
  const chosenTimeframe = validTimeframes.includes(timeHorizon)
    ? timeHorizon
    : "8h";

  // Define the allowed tokens (ERC20 symbols) on the mode network.
  const allowedTokensList = [
    {
      decimals: 18,
      symbol: "MODE",
      name: "Mode",
      chains: {
        "34443": {
          contractAddress:
            "0xDfc7C877a950e49D2610114102175A06C2e3167a" as `0x${string}`,
        },
      },
    },
  ];

  const allowedTokens = allowedTokensList;

  // Set up the wallet.
  const account = privateKeyToAccount(
    process.env.WALLET_PRIVATE_KEY as `0x${string}`
  );
  const walletClient = createWalletClient({
    account,
    transport: http(process.env.RPC_PROVIDER_URL),
    chain: mode,
  });

  // Initialize on-chain tools with allora, coingecko, and erc20 plugins.
  const tools = await getOnChainTools({
    wallet: viem(walletClient),
    plugins: [
      allora({ apiKey: process.env.ALLORA_API_KEY }),
      coingecko({ apiKey: process.env.COINGECKO_API_KEY as string }),
      erc20({ tokens: allowedTokensList }),
    ],
  });

  // Retrieve on-chain balances for each allowed token.
  if (!tools.erc20) {
    throw new Error("ERC20 tool not initialized");
  }

const erc20Tool = tools.erc20 as unknown as {
execute: (
    args: {
    token: `0x${string}`,
    function: string,
    args: unknown[]
    },
    options?: { messages?: unknown[]; abortSignal?: AbortSignal }
) => Promise<bigint>
};

const CHAIN_ID = 34443; // Mode network chain ID

const walletTokensRaw = await Promise.all(
allowedTokensList.map(async (token) => {
    try {
    const balance = await erc20Tool.execute({
        token: token.chains[CHAIN_ID].contractAddress,
        function: "balanceOf",
        args: [account.address]
    }, {});
    return { symbol: token.symbol, balance: Number(balance) };
    } catch (error) {
    console.error(error);
    return null;
    }
})
);
  const filteredWalletTokens = walletTokensRaw.filter(
    (t): t is { symbol: string; balance: number } => t !== null && t.balance > 0
  );

  // Get the active network name from the chain object.
  const activeNetwork = mode.name || "Unknown Network";

  // Build the prompt for the swap recommendation.
  const prompt = `User's wallet address: ${account.address}.
User's wallet tokens (on-chain): ${filteredWalletTokens
    .map((t) => `${t.symbol} (balance: ${t.balance})`)
    .join(", ")}.
Allowed tokens for swaps: ${allowedTokens}.
Time horizon for prediction: ${chosenTimeframe} (only "5m" and "8h" are allowed).
Please recommend a swap that maximizes potential profit. The recommendation must be in the format: "Swap <FROM> to <TO>", where <FROM> is one of the tokens the user holds and <TO> is one of the allowed tokens.
Use the allora plugin for any predictive functionality if needed, and do NOT call any premium Coingecko endpoints.
Provide only the final recommendation as your answer.`;

  // Generate the swap recommendation.
  const result = await generateText({
    model: openai("gpt-4o-mini"),
    tools,
    maxSteps: 5,
    prompt,
  });

  return NextResponse.json({
    recommendation: result.text,
    walletAddress: account.address,
    walletTokens: filteredWalletTokens,
    activeNetwork,
  });
}
