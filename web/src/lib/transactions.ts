export async function fetchContractTransactions(address: string, account: string) {
  const response = await fetch(`https://api.flowdiver.io/transactions?contract=${address}&account=${account}`);
  return await response.json();
} 