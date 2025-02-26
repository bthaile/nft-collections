import './styles/index.css'
import { createPublicClient, http, decodeEventLog } from 'viem';
import { evmFlowMainnet, evmFlowTestnet } from './lib/chains';
import { 
  connectWallet, 
  handleAccountChange, 
  getCurrentAccount,
  getCurrentNetwork,
  getWalletClient,
  initAccountListeners,
  CHAIN_ID_TO_NETWORK,
  AccountState as State
} from './lib/accounts';
import { MyNFTAbi } from './contracts/abi';
import deployedAddresses from './lib/deployed-addresses.json';
import { fetchContractTransactions } from './lib/transactions'; 