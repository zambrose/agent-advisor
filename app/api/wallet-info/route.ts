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
  const chainId = network.chainId;

  const tokens = [];
  for (const tokenAddress of knownTokenAddresses) {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        provider
      );
      const balance = await tokenContract.balanceOf(walletAddress);
      const decimals = await tokenContract.decimals();
      const symbol = await tokenContract.symbol();
      if (balance.gt(0)) {
        tokens.push({
          address: tokenAddress,
          symbol,
          balance: ethers.formatUnits(balance, decimals),
          decimals,
        });
      }
    } catch (error) {
      console.error(`Error processing token ${tokenAddress}:`, error);
    }
  }

  const nativeBalance = await provider.getBalance(walletAddress);
  tokens.unshift({
    address: "native",
    symbol: "ETH",
    balance: ethers.formatEther(nativeBalance),
    decimals: 18,
  });

  return { chainId: chainId.toString(), rpcUrl, tokens };
}

export async function GET(request: Request) {
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

  const tokensList = process.env.ERC20_TOKEN_ADDRESSES
    ? process.env.ERC20_TOKEN_ADDRESSES.split(",").map((s) => s.trim())
    : [];

  const walletInfo = await getWalletTokens(walletAddress, rpcUrl, tokensList);

  return NextResponse.json({
    walletAddress,
    chainId: walletInfo.chainId,
    rpcUrl: walletInfo.rpcUrl,
    walletTokens: walletInfo.tokens,
  });
}
