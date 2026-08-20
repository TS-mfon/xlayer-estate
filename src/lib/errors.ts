export function friendlyError(error: unknown, fallback = "Something went wrong") {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/user rejected|denied transaction|rejected the request/i.test(message)) return "Request cancelled in your wallet.";
  if (/insufficient funds/i.test(message)) return "Insufficient balance for this transaction and network gas.";
  if (/transfer amount exceeds balance|exceeds balance/i.test(message)) return "Your settlement-token balance is below the amount plus protocol fee required for this action.";
  if (/transaction reverted/i.test(message)) return "The transaction reverted on X Layer. Refresh the current balances and retry.";
  if (/allowance/i.test(message)) return "Token approval is too low. Approve the requested amount and retry.";
  if (/seed below|seed too small/i.test(message)) return "The liquidity seed must be at least 10.00 USDC.";
  if (/insufficient shares/i.test(message)) return "This wallet does not hold enough asset shares for that liquidity action.";
  if (/issuer only|not the issuer/i.test(message)) return "Only the wallet that minted this asset can open its first market.";
  if (/pool exists/i.test(message)) return "This asset already has an active market. Refresh the page to trade it.";
  if (/pool inactive/i.test(message)) return "This market is not active yet. Complete the issuer launch sequence first.";
  if (/asset not active/i.test(message)) return "This asset is not currently active for marketplace actions.";
  if (/trade below fee/i.test(message)) return "The trade must be greater than the fixed 0.20 USDC fee.";
  if (/buy slippage|sell slippage|withdrawal slippage/i.test(message)) return "The market moved before confirmation. Refresh the quote and retry.";
  if (/trade expired|authorization expired/i.test(message)) return "This approval or quote expired. Refresh and try again.";
  if (/paused/i.test(message)) return "Marketplace actions are temporarily paused.";
  if (/authorization expired|evaluation expired/i.test(message)) return "This authorization expired. Run the asset evaluation again.";
  if (/network|chain/i.test(message)) return "Switch your wallet to X Layer Testnet and retry.";
  const short = message.split("\n")[0]?.trim();
  return short && short.length < 220 ? short : fallback;
}

export async function responseError(response: Response, fallback: string) {
  try {
    const data = await response.json() as { error?: { message?: string } };
    return data.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}
