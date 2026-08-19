import type { Address, PublicClient, TransactionReceipt } from "viem";

export async function simulateContractWrite(client: PublicClient, account: Address, request: Record<string, unknown>) {
  await client.simulateContract({ ...request, account } as never);
}

export function assertSuccessfulReceipt(receipt: TransactionReceipt) {
  if (receipt.status !== "success") throw new Error("Transaction reverted on X Layer");
  return receipt;
}
