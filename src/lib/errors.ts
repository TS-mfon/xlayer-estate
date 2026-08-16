export function friendlyError(error: unknown, fallback = "Something went wrong") {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/user rejected|denied transaction|rejected the request/i.test(message)) return "Request cancelled in your wallet.";
  if (/insufficient funds/i.test(message)) return "Insufficient balance for this transaction and network gas.";
  if (/allowance/i.test(message)) return "Token approval is too low. Approve the requested amount and retry.";
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
