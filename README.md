# NFT Collections on Flow EVM

This repository contains a full stack workflow for creating, deploying, and operating ERC-721 collections on the Flow EVM networks. It combines a Solidity contract suite, Hardhat automation, reusable metadata assets, and a wallet-aware front-end that lets creators mint tokens and monitor activity without touching the command line.

## Highlights
- **Single source of truth for Flow EVM deployments** – includes repeatable Hardhat tasks, deployment history tracking, and metadata verification helpers.
- **Wallet-ready UI** – Vite + TypeScript client that connects through MetaMask, Flow wallet, WalletConnect, and other injected providers using Web3 Onboard.
- **Production-friendly defaults** – uses OpenZeppelin Contracts 5.x, viem-based tooling, Tailwind styling, and deployment metadata shared across back-end and front-end.

## Architecture Overview
- **On-chain layer (`contracts/`)**
  - `nft-contract.sol` implements the `MyNFT` collection using OpenZeppelin ERC721 + enumerable/burnable extensions. Tokens store pre-resolved URIs and expose a configurable `contractURI`.
  - Solidity version 0.8.28 with Cadence 1.0 alignment considerations (per project standards) and Ownable access control for metadata administration.

- **Hardhat layer (root project)**
  - Configured in `hardhat.config.ts` with Flow EVM mainnet/testnet RPC settings, @nomicfoundation viem integration, Sourcify verification, and custom deployments.
  - Custom tasks in `scripts/` orchestrate deployment (`deploy.ts`), minting (`mint.ts`), contract URI updates, batch transfers, and Flowscan verification.
  - `deployed-addresses.json` persists every deployment (address, timestamp, tag). Utility helpers expose both latest and tagged deployments, and the file is mirrored in the web client for discovery.

- **Metadata layer (`metadata/`, `nft_metadata.json`, `nft.json`)**
  - JSON metadata assets that map to the default collections showcased in the UI. Useful for seeding IPFS or maintaining on-chain references.
  - `verify-metadata.ts` task ensures hosted metadata matches expectations before contract updates.

- **Front-end layer (`web/`)**
  - Vite + TypeScript application with modular entry point `src/index.ts`.
  - viem powers RPC reads, event decoding, and transaction receipts while sharing ABI definitions from `src/lib/abi.ts`.
  - State management for accounts lives in `src/lib/accounts.ts` where Web3 Onboard handles wallet discovery, connection, network syncing, and error messaging tailored for Flow EVM.
  - UI uses Tailwind CSS for layout and components, and surfaces mint history by querying Flowscan APIs (`src/lib/transactions.ts`).

## Wallet Integration
- Wallet discovery is handled through `@web3-onboard/core` with injected wallets and WalletConnect modules. MetaMask, Coinbase Wallet, and Flow wallet extensions are supported out of the box.
- When users connect:
  - Web3 Onboard returns provider + account info which is wrapped by viem’s `createWalletClient` (kept in `AccountState`).
  - Flow EVM mainnet (`0x2eb`) and testnet (`0x221`) are recognized via `CHAIN_ID_TO_NETWORK`; unsupported networks trigger descriptive errors and UI prompts.
  - The UI mirrors connection status, provides copy-to-clipboard helpers, and issues toasts for success/error states.
- Disconnect flow tears down viem clients and hides minting components, ensuring the UI always reflects the wallet state.

## Repository Layout
- `contracts/` – Solidity sources.
- `scripts/` – Hardhat tasks for deployment, minting, verification, batch transfers, and metadata operations.
- `metadata/` – Collection JSONs ready for IPFS or Git-hosted URIs.
- `web/` – Vite front-end with `src/lib` utilities, ABI, chain definitions, and Flow deployment history (`deployed-addresses.json`). See the [web client README](web/README.md) for minting workflow details and developer instructions.
- `vercel-build.js` / `vercel.json` – build pipeline utilities for hosting.

## Getting Started
1. **Install dependencies**
   ```shell
   pnpm install
   pnpm install --dir web
   ```
2. **Compile the contract stack**
   ```shell
   pnpm compile
   ```
3. **Run scripts**
   - Deploy to Flow EVM testnet: `pnpm deploy:testnet:NFT`
   - Set collection metadata: `pnpm set-uri:testnet`
   - Batch transfers, verification, and other targets are defined in `package.json`.
4. **Launch the web client**
   ```shell
   pnpm dev
   # or run directly inside web/
   pnpm --dir web run dev
   ```
5. **Build the front-end for production**
   ```shell
   pnpm --dir web run build
   ```

## Deployment Metadata Workflow
- Every Hardhat deployment appends to `deployed-addresses.json` at the repository root.
- After deployments, copy or merge the latest JSON into `web/src/lib/deployed-addresses.json` so the UI immediately exposes new collections.
- Tags (e.g., `MNFT`, `VOK`) become the selector labels in the UI; maintain consistent naming to keep mint history and metadata previews readable.

## Extending the System
- **Add new contract features**: extend `MyNFT` with additional modules (royalties, access control) and regenerate ABI via Hardhat compile. Update `web/src/lib/abi.ts` to match.
- **Introduce new scripts**: reference `scripts/deploy.ts` for patterning tasks. Use `task` definitions to expose CLI entry points and maintain `deployed-addresses.json`.
- **Wallet connectors**: add more Web3 Onboard modules in `web/src/lib/accounts.ts` if additional wallets or custom networks are needed.
- **Metadata automation**: supplement `verify-metadata.ts` with IPFS pinning or CDN uploads before calling `set-contract-uri`.

## Maintenance Notes
- Keep `viem` versions aligned between root and `web/` packages. When upgrading, test both Hardhat tasks and the front-end client because ABI encoding/decoding changes can impact writes.
- Update `@web3-onboard/*` packages periodically to inherit new wallet adapters; re-test Flow wallet account creation flows after upgrades.
- Hardhat plugins (`@nomicfoundation/*`, `hardhat-gas-reporter`, `solidity-coverage`) follow semantic versions—pin upgrades, re-run `pnpm compile`, and verify custom tasks still resolve networks.
- When refreshing OpenZeppelin Contracts, recompile and review `flattened-nft-contract.sol` if auditors rely on it.
- Document new deployment tags and ensure the mirrored front-end JSON stays in sync to avoid stale addresses for users.

## References
- Flow EVM explorer: `https://evm.flowscan.io`
- viem documentation: `https://viem.sh`
- Web3 Onboard docs: `https://onboard.blocknative.com/docs/`
