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
    public: { http: ['https://mainnet.evm.nodes.flow.com'] },
    default: { http: ['https://mainnet.evm.nodes.flow.com'] },
  },
  blockExplorers: {
    default: { name: 'Flowdiver', url: 'https://flowdiver.io' },
  }
} as const;

export const evmFlowTestnet = {
  id: 646,
  name: 'Flow EVM Testnet',
  network: 'evmFlowTestnet',
  nativeCurrency: {
    decimals: 18,
    name: 'FLOW',
    symbol: 'FLOW',
  },
  rpcUrls: {
    public: { http: ['https://testnet.evm.nodes.flow.com'] },
    default: { http: ['https://testnet.evm.nodes.flow.com'] },
  },
  blockExplorers: {
    default: { name: 'Flowdiver', url: 'https://testnet.flowdiver.io' },
  }
} as const; 