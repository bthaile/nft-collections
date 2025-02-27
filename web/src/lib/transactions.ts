import { getCurrentNetwork } from './accounts';

interface TransactionItem {
  hash: string;
  method: string;
  timestamp: string;
  status: string;
  from: {
    hash: string;
  };
  decoded_input?: {
    method_call: string;
    parameters: Array<{
      name: string;
      value: string;
    }>;
  };
  topics: string[];
}

interface TransactionResponse {
  items: TransactionItem[];
  next_page_params: any;
}

export async function fetchContractTransactions(contractAddress: string, userAddress: string): Promise<TransactionItem[]> {
  try {
    const baseUrl = getCurrentNetwork() === 'evmFlowMainnet' 
      ? 'https://evm.flowscan.io'
      : 'https://evm-testnet.flowscan.io';

    const response = await fetch(
      `${baseUrl}/api/v2/addresses/${contractAddress}/transactions?filter=to%20%7C%20from${userAddress}`
    );
    
    if (!response.ok) {
      console.error('API Response:', await response.text());
      throw new Error('Network response was not ok');
    }

    const data: TransactionResponse = await response.json();
    console.log('Transaction data:', data.items[0]); // Log first transaction for debugging
    return data?.items || [];
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
} 