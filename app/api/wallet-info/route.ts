import { NextResponse } from "next/server";
import { ethers } from "ethers";

// Standard ERC20 ABI for token balance checking
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

async function getWalletTokens(
  walletAddress: string,
  rpcUrl: string,
  knownTokenAddresses: string[] = []
) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  await provider.ready;

  const network = await provider.getNetwork();
  // chainId is a bigint in ethers v6, so we convert to string
  const chainId = network.chainId.toString();

  const tokens = [];

  for (const tokenAddress of knownTokenAddresses) {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        provider
      );
      const balance = await tokenContract.balanceOf(walletAddress);
      // decimals might be a bigint; convert to a normal number
      const decimalsBigint = await tokenContract.decimals();
      const decimals = Number(decimalsBigint);
      const symbol = await tokenContract.symbol();

      // Only add token if there's a nonzero balance (compare bigints via > 0n)
      if (balance > 0n) {
        tokens.push({
          address: tokenAddress,
          symbol,
          balance: ethers.formatUnits(balance, decimals), // => string
          decimals, // => a normal number now
        });
      }
    } catch (error) {
      console.error(`Error processing token ${tokenAddress}:`, error);
    }
  }

  // Always include native chain balance (ETH)
  const nativeBalance = await provider.getBalance(walletAddress);
  tokens.unshift({
    address: "native",
    symbol: "ETH",
    balance: ethers.formatEther(nativeBalance), // => string
    decimals: 18, // => normal number
  });

  return { chainId, rpcUrl, tokens };
}

export async function GET() {
  const privateKey = process.env.WALLET_PRIVATE_KEY;
  if (!privateKey) {
    return NextResponse.json(
      { error: "Wallet private key not provided" },
      { status: 400 }
    );
  }

  const wallet = new ethers.Wallet(privateKey);
  const walletAddress = wallet.address;

  const rpcUrl = process.env.RPC_PROVIDER_URL;
  if (!rpcUrl) {
    return NextResponse.json(
      { error: "RPC_PROVIDER_URL not provided" },
      { status: 400 }
    );
  }

  // Example tokens
  const MODE_ADDRESS = "0xDfc7C877a950e49D2610114102175A06C2e3167a";
  const USDC_ADDRESS = "0xd988097fb8612cc24eeC14542bC03424c656005f";
  const AAVE_ADDRESS = "0x7c6b91D9Be155A6Db01f749217d76fF02A7227F2";

  const knownTokenAddresses = [USDC_ADDRESS, AAVE_ADDRESS, MODE_ADDRESS];
  const walletInfo = await getWalletTokens(
    walletAddress,
    rpcUrl,
    knownTokenAddresses
  );

  console.log("walletInfo", walletInfo);

  return NextResponse.json({
    walletAddress,
    chainId: walletInfo.chainId,
    rpcUrl: walletInfo.rpcUrl,
    walletTokens: walletInfo.tokens,
  });
}
