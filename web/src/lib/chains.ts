export const evmFlowMainnet = {
  id: 747,
  name: 'Flow EVM Mainnet',
  network: 'evmFlowMainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'FLOW',
    symbol: 'FLOW',
  },
  rpcUrls: {
    public: { 
      http: [
        'https://mainnet.evm.nodes.onflow.org',
      ] 
    },
    default: { 
      http: [
        'https://mainnet.evm.nodes.onflow.org',
      ]
    },
  },
  blockExplorers: {
    default: { name: 'Flowdiver', url: 'https://evm.flowscan.io' },
  }
} as const;

export const evmFlowTestnet = {
  id: 545,
  name: 'Flow EVM Testnet',
  network: 'evmFlowTestnet',
  nativeCurrency: {
    decimals: 18,
    name: 'FLOW',
    symbol: 'FLOW',
  },
  rpcUrls: {
    public: { 
      http: [
        'https://testnet.evm.nodes.onflow.org',
      ]
    },
    default: { 
      http: [
        'https://testnet.evm.nodes.onflow.org',
      ]
    },
  },
  blockExplorers: {
    default: { name: 'Flowdiver', url: 'https://evm-testnet.flowscan.io' },
  }
} as const; 