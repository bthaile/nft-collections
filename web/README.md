# NFT Minter Web Client

The `nft-minter-ui` package is a Vite + TypeScript single-page application that lets creators mint ERC-721 tokens onto Flow EVM mainnet and testnet. It wraps the reusable contract artifacts in a wallet-aware interface so non-technical users can browse deployments, preview collection metadata, and submit mint transactions directly from their browser.

## Features
- **Wallet onboarding with Flow EVM support** using Web3 Onboard (MetaMask, Flow Wallet, Coinbase, WalletConnect).
- **Automatic deployment discovery** by consuming `src/lib/deployed-addresses.json`, which mirrors the addresses tracked by Hardhat tasks.
- **Metadata preview** that resolves IPFS URIs through public gateways before minting.
- **Mint history** fetched from Flowscan APIs, scoped to the connected account.
- **Toast-driven UX** for connection, network, and transaction feedback.

## Requirements
- Node.js 20+ with pnpm installed globally.
- Access to Flow EVM endpoints (public RPCs are pre-configured).
- A deployed `MyNFT` contract (see the root README for deployment steps) and optionally seeded metadata URIs.

## Installation
```shell
pnpm install --dir web
```

## Available Scripts
- `pnpm run dev` – Start the Vite dev server at `http://localhost:5173`.
- `pnpm run build` – Type-check the project, build the Vite bundle, and emit Tailwind CSS into `dist/`.
- `pnpm run preview` – Serve the production build locally.

> You can also run these via the root `package.json` scripts (`pnpm dev`, `pnpm preview`) which handle the `--dir` flag automatically.

## Wallet Flow
1. **Connect** – The Connect button triggers Web3 Onboard. Users pick a wallet; the app validates the returned chain ID (mainnet `0x2eb`, testnet `0x221`). Unsupported networks raise descriptive toasts and guide the user to switch.
2. **Initialize clients** – On successful connection, `src/lib/accounts.ts` stores the viem `walletClient` and network in local state. `src/index.ts` initializes a `publicClient` for contract reads.
3. **Load deployments** – Contracts are read from `src/lib/deployed-addresses.json`. Each tagged deployment becomes a dropdown option. Selecting a tag loads `contractURI`, fetches metadata, and pre-populates the mint form.
4. **Minting** – The mint form takes a token URI (defaults to the contract URI). Submitting calls `walletClient.writeContract` using the shared ABI from `src/lib/abi.ts`. Transaction receipts are awaited via `publicClient.waitForTransactionReceipt`.
5. **History** – After confirmation, the UI polls the Flowscan API (`src/lib/transactions.ts`) to display the user’s mint activity with explorer links.

## Updating Deployment Data
- After each successful Hardhat deployment, copy the new record from the root-level `deployed-addresses.json` into `web/src/lib/deployed-addresses.json`.
- Ensure the `tag` matches the identifier used during deployment (e.g., `VOK`). Tags populate the dropdown and surface mint history per collection.

## Metadata Tips
- Point `contractURI` to a hosted JSON file (GitHub raw, IPFS gateway, etc.). The UI resolves `ipfs://` schemes using `https://ipfs.io/ipfs/{cid}` by default.
- For per-token metadata, pass the desired URI in the mint form. The app previews JSON responses and handles gateway resolution for images.

## Extending the UI
- **New wallet providers** – Register additional Web3 Onboard modules inside `src/lib/accounts.ts`.
- **Custom views** – Reuse the shared account state (`AccountState`) and helper utilities to add dashboards or analytics.
- **Styling** – Tailwind configs live in `tailwind.config.js` with global styles in `src/styles/index.css`. Run `pnpm run build` to regenerate CSS artifacts.
- **Contract upgrades** – When ABI or contract names change, update `src/lib/abi.ts` (a direct export of Hardhat’s ABI) and refresh the types in `src/lib/types.ts` if needed.

## Environment Notes
- The UI assumes Cadence 1.0-compatible Flow EVM deployments (see root documentation). If Cadence or Solidity constraints change, re-run scripts and update ABI references.
- Treat public RPC URLs as shared infrastructure—consider provisioning dedicated endpoints for production deployments.

## Troubleshooting
- **No accounts found** – Flow wallet users must create an EVM account before connecting. The app surfaces a guide when it detects Flow’s injected provider.
- **Unsupported network** – Switch networks in the wallet to Flow EVM mainnet or testnet; the toast includes the required chain IDs.
- **Stale history or metadata** – Confirm `deployed-addresses.json` is current and metadata URIs return valid JSON via your browser.

For broader architecture and tooling context, consult the root `README.md`.

