
export interface AccountState {
  currentNetwork?: string;
  currentAccount?: string;
}

export const CHAIN_ID_TO_NETWORK: Record<string, string> = {
  '747': 'evmFlowMainnet',
  '646': 'evmFlowTestnet'
};

let walletClient: any;

export function getWalletClient() {
  return walletClient;
}

export function getCurrentAccount() {
  return window.ethereum?.selectedAddress;
}

export function getCurrentNetwork() {
  return CHAIN_ID_TO_NETWORK[window.ethereum?.chainId];
}

export function connectWallet(options: {
  onConnect: (account: string) => void;
  onDisconnect: () => void;
  onError: (error: Error) => void;
  updateUI: () => void;
}) {
  // Implementation here
}

export function handleAccountChange(accounts: string[]) {
  // Implementation here
}

export function initAccountListeners(options: {
  onNetworkChange: (chainId: string) => void;
  onAccountChange: (accounts: string[]) => void;
}) {
  // Implementation here
}

// Add other account functions... 