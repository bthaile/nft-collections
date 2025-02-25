interface TransactionItem {
  hash: string;
  method: string;
  timestamp: string;
  status: string;
  decoded_input?: {
    method_call: string;
    parameters: Array<{
      name: string;
      value: string;
    }>;
  };
}

interface TransactionResponse {
  items: TransactionItem[];
  next_page_params: any;
}

export async function fetchContractTransactions(contractAddress: string, userAddress: string): Promise<TransactionItem[]> {
  try {
    const response = await fetch(
      `https://evm-testnet.flowscan.io/api/v2/addresses/${contractAddress}/transactions?filter=to%20%7C%20from${userAddress}`
    );
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data: TransactionResponse = await response.json();
    return data.items;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
} 