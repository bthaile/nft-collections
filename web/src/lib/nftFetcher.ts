import type { Address, PublicClient } from "viem";
import { MyNFTAbi } from "./abi";
import type { NftRow } from "./nftTable";

export interface NftDeployment {
  address: string;
  tag?: string;
}

interface FetchUserNftsOptions {
  client: PublicClient;
  account: Address;
  deployments: NftDeployment[];
  resolveUri: (uri: string) => string;
}

type RawMetadata = {
  name?: unknown;
  description?: unknown;
  image?: unknown;
  updated_at?: unknown;
  lastUpdated?: unknown;
};

async function fetchMetadata(uri?: string): Promise<RawMetadata | undefined> {
  if (!uri) return undefined;

  try {
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`Failed to fetch metadata ${response.status}`);
    const json = (await response.json()) as RawMetadata;
    return json;
  } catch (error) {
    console.warn("Unable to fetch metadata for URI:", uri, error);
    return undefined;
  }
}

export async function fetchUserNfts({
  client,
  account,
  deployments,
  resolveUri,
}: FetchUserNftsOptions): Promise<NftRow[]> {
  if (!deployments?.length) return [];

  const rows: NftRow[] = [];

  for (const deployment of deployments) {
    try {
      const contractAddress = deployment.address as Address;

      const tokenIds = await getOwnedTokenIds(client, contractAddress, account);
      if (!tokenIds.length) continue;

      for (const tokenId of tokenIds) {
        const rawTokenUri = await client.readContract({
          address: contractAddress,
          abi: MyNFTAbi,
          functionName: "tokenURI",
          args: [tokenId],
        });

        const resolvedUri =
          typeof rawTokenUri === "string" ? resolveUri(rawTokenUri) : undefined;
        const metadata = await fetchMetadata(resolvedUri);
        const image =
          metadata && typeof metadata.image === "string"
            ? resolveUri(metadata.image)
            : undefined;

        rows.push({
          collection: deployment.tag ?? `${deployment.address.slice(0, 6)}...${deployment.address.slice(-4)}`,
          tokenId: (tokenId as bigint).toString(),
          name:
            metadata && typeof metadata.name === "string" ? metadata.name : undefined,
          description:
            metadata && typeof metadata.description === "string"
              ? metadata.description
              : undefined,
          image,
          tokenUri: resolvedUri,
          lastUpdated:
            metadata && typeof metadata.updated_at === "string"
              ? metadata.updated_at
              : metadata && typeof metadata.lastUpdated === "string"
              ? metadata.lastUpdated
              : undefined,
        });
      }
    } catch (contractError) {
      console.warn(
        `Unable to enumerate NFTs for contract ${deployment.address}`,
        contractError
      );
      continue;
    }
  }

  return rows.sort((a, b) => Number(b.tokenId) - Number(a.tokenId));
}

async function getOwnedTokenIds(
  client: PublicClient,
  contractAddress: Address,
  account: Address
): Promise<bigint[]> {
  const lowerAccount = account.toLowerCase();

  // First, try to rely on ERC721Enumerable helpers if available
  try {
    const balance = (await client.readContract({
      address: contractAddress,
      abi: MyNFTAbi,
      functionName: "balanceOf",
      args: [account],
    })) as bigint;

    if (balance === 0n) {
      console.debug(
        "[nftFetcher] balanceOf indicates zero balance",
        contractAddress,
        account
      );
      return [];
    }

    const ownedViaIndex: bigint[] = [];
    for (let index = 0n; index < balance; index++) {
      try {
        const tokenId = (await client.readContract({
          address: contractAddress,
          abi: MyNFTAbi,
          functionName: "tokenOfOwnerByIndex",
          args: [account, index],
        })) as bigint;
        ownedViaIndex.push(tokenId);
      } catch (error) {
        console.warn(
          `[nftFetcher] tokenOfOwnerByIndex failed for ${contractAddress} at index ${index.toString()}`,
          error
        );
        // Bail out of enumerable path and try fallback scanning
        return await discoverOwnedTokensByOwnerOf(
          client,
          contractAddress,
          lowerAccount
        );
      }
    }

    return dedupeBigints(ownedViaIndex);
  } catch (error) {
    console.warn(
      `[nftFetcher] balanceOf failed for ${contractAddress}, falling back to ownerOf scan`,
      error
    );
  }

  return await discoverOwnedTokensByOwnerOf(client, contractAddress, lowerAccount);
}

const MAX_SEQUENTIAL_MISSES = 25;
const MAX_TOKEN_SCAN = 2000n;

async function discoverOwnedTokensByOwnerOf(
  client: PublicClient,
  contractAddress: Address,
  lowerAccount: string
): Promise<bigint[]> {
  const owned: bigint[] = [];
  let tokenId = 0n;
  let misses = 0;

  console.debug(
    "[nftFetcher] entering ownerOf scan fallback",
    contractAddress,
    "maxScan",
    MAX_TOKEN_SCAN.toString()
  );

  while (misses < MAX_SEQUENTIAL_MISSES && tokenId < MAX_TOKEN_SCAN) {
    try {
      const owner = (await client.readContract({
        address: contractAddress,
        abi: MyNFTAbi,
        functionName: "ownerOf",
        args: [tokenId],
      })) as Address;

      if (owner?.toLowerCase() === lowerAccount) {
        owned.push(tokenId);
        misses = 0;
      } else {
        misses += 1;
      }
    } catch (error) {
      misses += 1;
      console.debug(
        "[nftFetcher] ownerOf scan miss",
        contractAddress,
        "tokenId",
        tokenId.toString(),
        "misses",
        misses,
        error instanceof Error ? error.message : error
      );
    }

    tokenId += 1n;
  }

  console.debug(
    "[nftFetcher] ownerOf scan completed",
    contractAddress,
    "ownedCount",
    owned.length,
    "finalTokenId",
    tokenId.toString(),
    "misses",
    misses
  );

  return dedupeBigints(owned);
}

function dedupeBigints(values: bigint[]): bigint[] {
  const seen = new Set<string>();
  const unique: bigint[] = [];
  values.forEach((value) => {
    const key = value.toString();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(value);
    }
  });
  return unique;
}

