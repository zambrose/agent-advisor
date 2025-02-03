import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { http } from "viem";

import { createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mode } from "viem/chains";

import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { allora } from "@goat-sdk/plugin-allora";
import { coingecko } from "@goat-sdk/plugin-coingecko";
import { erc20 } from "@goat-sdk/plugin-erc20";
import { viem } from "@goat-sdk/wallet-viem";

export async function POST(request: Request) {
  const body = await request.json();
  // Expecting timeHorizon to be either "5m" or "8h"
  const { timeHorizon } = body;
  const validTimeframes = ["5m", "8h"];
  const chosenTimeframe = validTimeframes.includes(timeHorizon)
    ? timeHorizon
    : "8h";

  // Define the allowed tokens (ERC20 symbols) on the Mode network.
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
    {
      decimals: 6,
      symbol: "USDC",
      name: "USD Coin",
      chains: {
        "34443": {
          contractAddress:
            "0xd988097fb8612cc24eeC14542bC03424c656005f" as `0x${string}`,
        },
      },
    },
  ];

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

  // console.log("tools");
  // console.log(tools);
  console.log("----");
  console.log(Object.keys(tools));
  // if (!tools.erc20) {
  //   throw new Error("ERC20 tool not initialized");
  // }

  const CHAIN_ID = 34443;

  const walletTokensRaw = await Promise.all(
    allowedTokensList.map(async (token) => {
      console.log("reviewing token...");
      console.log(token);
      try {
        if (tools.get_token_balance) {
          // @ts-expect-error: Suppress potential undefined error for get_token_balance
          const balance = await tools.get_token_balance.execute({
            wallet: account.address,
            tokenAddress: token.chains[CHAIN_ID].contractAddress,
          });

          console.log("balance");
          console.log(balance);

          return { symbol: token.symbol, balance };
        } else {
          console.error("get_token_balance is undefined");
          return null;
        }
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

  console.log("filteredWalletTokens");
  console.log(filteredWalletTokens);
  console.log("allowedTokensList");
  console.log(allowedTokensList);

  const tokenNames = allowedTokensList.map((t) => t.symbol);
  console.log("tokenNames");
  console.log(tokenNames);

  // Build the prompt for the swap recommendation.
  const prompt = `User's wallet address: ${account.address}.
User's wallet tokens (on-chain): ${filteredWalletTokens
    .map((t) => `${t.symbol} (balance: ${t.balance})`)
    .join(", ")}.
Allowed tokens for swaps (tokenNames array): ${tokenNames}.
Time horizon for prediction: ${chosenTimeframe}.
Please recommend a swap that maximizes potential profit.
Use allora for the price prediction... only use coingecko to get historial data.
Do not user the coingecko get_price_prediction endpoint.
Look back a max of 30 days for historical data, i.e if using the coingecko 'history' endpoint, ensure the date is no more than 30 days ago.
The current date is ${new Date().toISOString().split("T")[0]}.
The recommendation must be in the format: "Swap <FROM> to <TO>", where <FROM> is one of the tokens the user holds and <TO> is one of the allowed tokens.
Use the allora plugin for any predictive functionality if needed, and do NOT call any premium Coingecko endpoints.
Provide only the final recommendation as your answer.
Ensure that the recommendation is valid.
Ensure that the recommendation is not a swap of the same token.
Ensure that the recommendation is not a swap from a token that the user does not hold.
Ensure that the swap 'to' token is a member of the tokenNames array.
Remember, DO NOT USE the coingecko get_price_prediction endpoint.
FOR NOW, JUST RECOMMEND A SWAP FROM AAVE to USDC and don't perform any predictive analysis.
`;

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
