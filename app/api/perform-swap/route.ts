import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { fromToken, toToken } = body;
  // For simulation, we simply return a simulated response without calling any plugins.
  return NextResponse.json({
    status: "success",
    message: `Simulated swap: Swap 5% of your current ${fromToken} balance to ${toToken}. (Simulation only)`,
  });
}
