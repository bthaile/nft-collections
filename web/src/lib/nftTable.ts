export interface NftRow {
  collection: string;
  tokenId: string;
  image?: string;
  name?: string;
  description?: string;
  tokenUri?: string;
  lastUpdated?: string;
}

function createEmptyState(): string {
  return `
    <div class="flex flex-col items-center justify-center py-10 text-gray-500">
      <svg class="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M3.75 6.75h16.5m-16.5 10.5h16.5M3.75 6.75v10.5a2.25 2.25 0 002.25 2.25h11.25a2.25 2.25 0 002.25-2.25V6.75m-12 0V5.25A2.25 2.25 0 0111.25 3h1.5A2.25 2.25 0 0115 5.25V6.75" />
      </svg>
      <p class="text-sm font-medium">No NFTs to display yet</p>
      <p class="text-xs text-gray-400 mt-1">Mint or import NFTs to see them here.</p>
    </div>
  `;
}

function createTableHeader(): string {
  return `
    <thead class="bg-gray-50">
      <tr class="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
        <th class="px-3 py-2 w-60">Collection</th>
        <th class="px-3 py-2 w-16">ID</th>
        <th class="px-3 py-2">Name</th>
        <th class="px-3 py-2">Description</th>
      </tr>
    </thead>
  `;
}

function createTableBody(rows: NftRow[]): string {
  return `
    <tbody class="divide-y divide-gray-100 text-sm text-gray-700">
      ${rows
        .map((row) => {
          const truncatedDescription = row.description
            ? row.description.length > 80
              ? `${row.description.slice(0, 77)}...`
              : row.description
            : "—";

          return `
            <tr class="hover:bg-gray-50 transition-colors">
              <td class="px-3 py-2">
                <div class="flex items-center gap-3">
                  ${
                    row.image
                      ? `<img src="${row.image}" alt="${row.collection}" class="w-10 h-10 rounded-lg object-cover border border-gray-200 flex-shrink-0">`
                      : `<div class="w-10 h-10 rounded-lg bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">NFT</div>`
                  }
                  <div class="min-w-0">
                    <p class="font-medium text-gray-900">${row.collection}</p>
                    ${
                      row.tokenUri
                        ? `<a href="${row.tokenUri}" target="_blank"
                              class="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
                              View Metadata
                              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                  d="M5.25 7.5h13.5m-13.5 9h13.5M9 7.5v-1.5A1.5 1.5 0 0110.5 4.5h3A1.5 1.5 0 0115 6v1.5m-9 0h12a1.5 1.5 0 011.5 1.5v7.5a1.5 1.5 0 01-1.5 1.5H6.75A1.5 1.5 0 015.25 16.5V9a1.5 1.5 0 011.5-1.5z" />
                              </svg>
                            </a>`
                        : `<span class="text-xs text-gray-400">No metadata</span>`
                    }
                  </div>
                </div>
              </td>
              <td class="px-3 py-2 font-mono text-xs text-gray-600">${row.tokenId}</td>
              <td class="px-3 py-2">${row.name ?? "—"}</td>
              <td class="px-3 py-2 text-xs text-gray-600">${truncatedDescription}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `;
}

function ensureContainer(): HTMLElement | null {
  const container = document.getElementById("ownedNfts");
  if (!container) {
    console.warn("NFT table container (#ownedNfts) not found");
    return null;
  }
  return container;
}

export function renderNftTable(rows: NftRow[]): void {
  const container = ensureContainer();
  if (!container) return;

  if (!rows.length) {
    renderEmptyNftState();
    return;
  }

  container.innerHTML = `
    <div class="bg-white rounded-lg shadow-sm">
      <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-gray-900">Your NFTs</h3>
          <p class="text-xs text-gray-500 mt-0.5">Connected wallet holdings</p>
        </div>
        <span class="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-600">
          ${rows.length} item${rows.length === 1 ? "" : "s"}
        </span>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-100">
          ${createTableHeader()}
          ${createTableBody(rows)}
        </table>
      </div>
      <div class="px-4 py-6 bg-white border-t border-gray-100 text-center text-xs text-gray-400">
        End of list
      </div>
    </div>
  `;
}

export function renderEmptyNftState(): void {
  const container = ensureContainer();
  if (!container) return;

  container.innerHTML = `
    <div class="bg-white rounded-lg shadow-sm border border-dashed border-gray-200">
      <div class="px-4 py-3 border-b border-gray-100">
        <h3 class="text-sm font-semibold text-gray-900">Your NFTs</h3>
        <p class="text-xs text-gray-500 mt-0.5">Connected wallet holdings</p>
      </div>
      ${createEmptyState()}
      <div class="px-4 py-6 bg-white border-t border-gray-100 text-center text-xs text-gray-400">
        End of list
      </div>
    </div>
  `;
}

export function renderNftLoadingState(): void {
  const container = ensureContainer();
  if (!container) return;

  container.innerHTML = `
    <div class="bg-white rounded-lg shadow-sm border border-gray-100">
      <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-gray-900">Your NFTs</h3>
          <p class="text-xs text-gray-500 mt-0.5">Connected wallet holdings</p>
        </div>
        <span class="inline-flex items-center gap-2 text-xs text-gray-500">
          <svg class="w-4 h-4 animate-spin text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V2a10 10 0 00-8 16.9l2-1.73A7.963 7.963 0 014 12z"></path>
          </svg>
          Loading
        </span>
      </div>
      <div class="px-4 py-10">
        <p class="text-sm text-gray-500 text-center">Fetching NFTs from connected wallet...</p>
      </div>
      <div class="px-4 py-6 bg-white border-t border-gray-100 text-center text-xs text-gray-400">
        Loading complete
      </div>
    </div>
  `;
}

