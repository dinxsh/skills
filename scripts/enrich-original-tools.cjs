/**
 * enrich-original-tools.cjs
 * Adds full rich metadata (snippet, endpoints, chains, complexity,
 * useCase, buildsWith, creditCost, keyParams, responseFields) to the
 * 55 original GoldRush skill metadata files that only have thin fields.
 */
const fs   = require("fs");
const path = require("path");
const META = path.join(__dirname, "..", "src", "data", "tool-metadata");

const CHAINS_EVM = ["eth-mainnet", "matic-mainnet", "arbitrum-mainnet", "base-mainnet", "optimism-mainnet", "bsc-mainnet"];
const CHAINS_CORE = ["eth-mainnet", "matic-mainnet", "arbitrum-mainnet", "base-mainnet"];

const enrichments = {

  // ── WALLET ──────────────────────────────────────────────────────────────────
  "net-worth-calculator": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getNetWorth(walletAddress) {
  const resp = await client.BalanceService.getTokenBalancesForWalletAddress(
    "eth-mainnet", walletAddress, { nft: false, noSpam: true }
  );
  const totalUSD = (resp.data?.items ?? [])
    .reduce((sum, token) => sum + (token.quote ?? 0), 0);
  return { walletAddress, totalUSD };
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "Dashboard landing card, portfolio overview, net worth widgets for DeFi apps.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per chain",
    keyParams: [{ name: "walletAddress", type: "string", description: "EVM wallet address" }],
    responseFields: ["totalUSD", "tokenCount", "chainBreakdown"],
  },

  "portfolio-history": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getPortfolioHistory(walletAddress) {
  const resp = await client.BalanceService.getHistoricalPortfolioValue(
    "eth-mainnet", walletAddress
  );
  return resp.data?.items ?? [];
}`,
    endpoints: ["BalanceService.getHistoricalPortfolioValue"],
    chains: CHAINS_CORE,
    complexity: "beginner",
    useCase: "30-day portfolio charts, P&L tracking, wallet performance dashboards.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per chain",
    keyParams: [
      { name: "walletAddress", type: "string", description: "EVM wallet address" },
      { name: "chainName", type: "ChainName", description: "Chain to query" },
    ],
    responseFields: ["timestamp", "quote_currency", "holdings", "totalUSD"],
  },

  "portfolio-tracker": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function trackPortfolio(walletAddress) {
  const chains = ["eth-mainnet", "matic-mainnet", "arbitrum-mainnet", "base-mainnet"];
  const results = await Promise.all(
    chains.map(chain =>
      client.BalanceService.getTokenBalancesForWalletAddress(chain, walletAddress, { noSpam: true })
    )
  );
  return chains.map((chain, i) => ({
    chain,
    tokens: results[i].data?.items ?? [],
    totalUSD: (results[i].data?.items ?? []).reduce((s, t) => s + (t.quote ?? 0), 0),
  }));
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "Multi-chain portfolio apps, exchange dashboards, wallet balance widgets.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per chain",
    keyParams: [{ name: "walletAddress", type: "string", description: "EVM wallet address" }],
    responseFields: ["chain", "tokens", "totalUSD", "contract_name", "quote"],
  },

  "transaction-history": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getTransactionHistory(chainName, walletAddress, page = 0) {
  const resp = await client.TransactionService.getTransactionsForAddressV3(
    chainName, walletAddress, { blockSignedAtAsc: false, pageNumber: page, pageSize: 25 }
  );
  return resp.data?.items ?? [];
}`,
    endpoints: ["TransactionService.getTransactionsForAddressV3"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "Transaction explorers, wallet history tabs, audit trails for onchain apps.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "EVM chain to query" },
      { name: "walletAddress", type: "string", description: "Wallet address" },
      { name: "pageNumber", type: "number", description: "Page offset (25 items/page)" },
    ],
    responseFields: ["tx_hash", "from_address", "to_address", "value_quote", "block_signed_at", "successful"],
  },

  "wallet-activity-feed": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getWalletActivityFeed(walletAddress) {
  const activity = await client.AllChainsService.getAddressActivity(walletAddress);
  const activeChains = activity.data?.items?.map(c => c.name) ?? [];

  // Fetch latest txns from each active chain in parallel
  const feeds = await Promise.all(
    activeChains.slice(0, 5).map(chain =>
      client.TransactionService.getTransactionsForAddressV3(chain, walletAddress, { pageSize: 5 })
    )
  );
  return activeChains.slice(0, 5).map((chain, i) => ({
    chain,
    recentTxns: feeds[i].data?.items ?? [],
  }));
}`,
    endpoints: ["AllChainsService.getAddressActivity", "TransactionService.getTransactionsForAddressV3"],
    chains: CHAINS_EVM,
    complexity: "intermediate",
    useCase: "Live activity feeds, multi-chain notification systems, wallet watchers.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 + N credits (N = active chains fetched)",
    keyParams: [{ name: "walletAddress", type: "string", description: "Wallet to monitor" }],
    responseFields: ["chain", "recentTxns", "tx_hash", "block_signed_at", "value_quote"],
  },

  "wallet-attestations": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Fetch EAS attestation events for a wallet via log events
async function getWalletAttestations(walletAddress) {
  const EAS_CONTRACT = "0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587"; // Ethereum EAS
  const events = await client.BaseService.getLogEventsByAddress(
    "eth-mainnet", EAS_CONTRACT
  );
  return (events.data?.items ?? []).filter(e =>
    e.decoded?.params?.find(p => p.name === "recipient")?.value?.toLowerCase() === walletAddress.toLowerCase()
  );
}`,
    endpoints: ["BaseService.getLogEventsByAddress", "NftService.getNftsForAddress"],
    chains: ["eth-mainnet", "base-mainnet", "optimism-mainnet"],
    complexity: "intermediate",
    useCase: "Identity verification, reputation systems, EAS-based access control.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per request",
    keyParams: [{ name: "walletAddress", type: "string", description: "Wallet to check for attestations" }],
    responseFields: ["attester", "recipient", "schemaUID", "data", "revoked"],
  },

  "wallet-balances-skill": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Claude / AI agent skill: one-call wallet balance fetch across 100+ chains
export async function walletBalancesSkill({ walletAddress, chainName = "eth-mainnet" }) {
  const resp = await client.BalanceService.getTokenBalancesForWalletAddress(
    chainName, walletAddress, { noSpam: true, nft: false }
  );
  const items = resp.data?.items ?? [];
  const totalUSD = items.reduce((s, t) => s + (t.quote ?? 0), 0);
  return {
    walletAddress,
    chainName,
    tokenCount: items.length,
    totalUSD,
    tokens: items.map(t => ({ symbol: t.contract_ticker_symbol, balanceUSD: t.quote })),
  };
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "Claude agent skills, MCP tools, AI assistant wallet queries.",
    buildsWith: ["@covalenthq/client-sdk", "@anthropic-ai/sdk"],
    creditCost: "1 credit per chain",
    keyParams: [
      { name: "walletAddress", type: "string", description: "Wallet address to query" },
      { name: "chainName", type: "ChainName", description: "Chain (default: eth-mainnet)" },
    ],
    responseFields: ["tokenCount", "totalUSD", "tokens", "symbol", "balanceUSD"],
  },

  // ── DEFI ───────────────────────────────────────────────────────────────────
  "defi-position-tracker": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getDeFiPositions(walletAddress) {
  const resp = await client.BalanceService.getTokenBalancesForWalletAddress(
    "eth-mainnet", walletAddress, { noSpam: true }
  );
  // Filter for LP tokens and receipt tokens (aTokens, cTokens)
  const defiTokens = (resp.data?.items ?? []).filter(t =>
    t.contract_name?.includes("LP") ||
    t.contract_ticker_symbol?.startsWith("a") ||
    t.contract_ticker_symbol?.startsWith("c")
  );
  return defiTokens.map(t => ({
    protocol: t.contract_name,
    symbol: t.contract_ticker_symbol,
    balanceUSD: t.quote,
    balance: t.balance,
  }));
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress"],
    chains: CHAINS_CORE,
    complexity: "intermediate",
    useCase: "DeFi portfolio apps, LP position dashboards, yield position aggregators.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per chain",
    keyParams: [{ name: "walletAddress", type: "string", description: "DeFi user wallet" }],
    responseFields: ["protocol", "symbol", "balanceUSD", "apy", "positionType"],
  },

  "dex-trade-history": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getDEXTradeHistory(chainName, walletAddress) {
  const txns = await client.TransactionService.getTransactionsForAddressV3(
    chainName, walletAddress, { pageSize: 50 }
  );
  // Filter transactions that contain Swap events
  const swaps = (txns.data?.items ?? []).filter(tx =>
    tx.log_events?.some(e => e.decoded?.name === "Swap")
  );
  return swaps.map(tx => ({
    hash: tx.tx_hash,
    timestamp: tx.block_signed_at,
    valueUSD: tx.value_quote,
    events: tx.log_events?.filter(e => e.decoded?.name === "Swap"),
  }));
}`,
    endpoints: ["TransactionService.getTransactionsForAddressV3"],
    chains: CHAINS_CORE,
    complexity: "intermediate",
    useCase: "DEX trade analytics, swap history exports, on-chain PnL calculators.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain to query" },
      { name: "walletAddress", type: "string", description: "Trader wallet address" },
    ],
    responseFields: ["tx_hash", "timestamp", "tokenIn", "tokenOut", "amountUSD", "dex"],
  },

  "liquidity-pool-monitor": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function monitorLiquidityPool(chainName, poolAddress) {
  const [events, balances] = await Promise.all([
    client.BaseService.getLogEventsByAddress(chainName, poolAddress),
    client.BalanceService.getTokenBalancesForWalletAddress(chainName, poolAddress),
  ]);
  const mintBurns = (events.data?.items ?? []).filter(
    e => e.decoded?.name === "Mint" || e.decoded?.name === "Burn"
  );
  const reserves = balances.data?.items ?? [];
  return { poolAddress, mintBurns: mintBurns.length, reserves };
}`,
    endpoints: ["BaseService.getLogEventsByAddress", "BalanceService.getTokenBalancesForWalletAddress"],
    chains: CHAINS_CORE,
    complexity: "intermediate",
    useCase: "AMM LP monitoring, impermanent loss tracking, liquidity event feeds.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "2 credits per pool (1 per service)",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain hosting the pool" },
      { name: "poolAddress", type: "string", description: "AMM pool contract address" },
    ],
    responseFields: ["reserves", "mintBurns", "apy", "tvlUSD", "volume24h"],
  },

  "protocol-revenue-feed": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getProtocolRevenue(chainName, feeCollector) {
  const txns = await client.TransactionService.getTransactionsForAddressV3(
    chainName, feeCollector, { pageSize: 100 }
  );
  const inflows = (txns.data?.items ?? []).filter(
    tx => tx.to_address?.toLowerCase() === feeCollector.toLowerCase()
  );
  const totalRevenue = inflows.reduce((s, tx) => s + (tx.value_quote ?? 0), 0);
  return { feeCollector, totalRevenue, txCount: inflows.length, inflows };
}`,
    endpoints: ["TransactionService.getTransactionsForAddressV3"],
    chains: CHAINS_CORE,
    complexity: "intermediate",
    useCase: "Protocol analytics dashboards, fee revenue tracking, DeFi fundamental analysis.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain of the protocol" },
      { name: "feeCollector", type: "string", description: "Protocol fee collector address" },
    ],
    responseFields: ["totalRevenue", "txCount", "inflows", "revenueByToken"],
  },

  "yield-dashboard": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getYieldDashboard(walletAddress) {
  const balances = await client.BalanceService.getTokenBalancesForWalletAddress(
    "eth-mainnet", walletAddress, { noSpam: true }
  );
  // Receipt tokens (aToken, cToken, yToken) signal active yield positions
  const yieldPositions = (balances.data?.items ?? []).filter(t =>
    ["aave", "compound", "yearn", "curve"].some(p =>
      t.contract_name?.toLowerCase().includes(p)
    )
  );
  return yieldPositions.map(t => ({
    protocol: t.contract_name,
    balanceUSD: t.quote,
    token: t.contract_ticker_symbol,
  }));
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress", "PricingService.getTokenPrices"],
    chains: CHAINS_CORE,
    complexity: "intermediate",
    useCase: "Yield aggregators, APY comparison tools, DeFi portfolio management apps.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per chain",
    keyParams: [{ name: "walletAddress", type: "string", description: "Yield farmer wallet" }],
    responseFields: ["protocol", "balanceUSD", "token", "estimatedAPY"],
  },

  // ── NFT ────────────────────────────────────────────────────────────────────
  "collection-floor-monitor": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function monitorCollectionFloor(chainName, collectionAddress) {
  const resp = await client.NftService.getNftMetadataForGivenTokenIdMetadata(
    chainName, collectionAddress, "1"
  );
  const sales = await client.NftService.getNftTransactionsForContractTokenId(
    chainName, collectionAddress, "1"
  );
  const recentSales = (sales.data?.items ?? []).slice(0, 10);
  const floorPrice = recentSales.reduce((min, s) =>
    (s.value_quote ?? Infinity) < min ? (s.value_quote ?? Infinity) : min, Infinity
  );
  return { collectionAddress, floorPrice, recentSales };
}`,
    endpoints: ["NftService.getNftTransactionsForContractTokenId", "NftService.getNftMetadataForGivenTokenIdMetadata"],
    chains: ["eth-mainnet", "matic-mainnet", "base-mainnet"],
    complexity: "intermediate",
    useCase: "NFT marketplace tools, collection analytics, floor price alerts.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per token ID",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain of the collection" },
      { name: "collectionAddress", type: "string", description: "NFT contract address" },
    ],
    responseFields: ["floorPrice", "recentSales", "volume24h", "uniqueHolders"],
  },

  "nft-metadata-fetcher": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function fetchNFTMetadata(chainName, contractAddress, tokenId) {
  const resp = await client.NftService.getNftMetadataForGivenTokenIdMetadata(
    chainName, contractAddress, tokenId, { withUncached: true }
  );
  return resp.data?.items?.[0] ?? null;
}`,
    endpoints: ["NftService.getNftMetadataForGivenTokenIdMetadata"],
    chains: ["eth-mainnet", "matic-mainnet", "base-mainnet", "arbitrum-mainnet"],
    complexity: "beginner",
    useCase: "NFT detail pages, marketplace listings, trait-based filtering.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per token",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain of the NFT" },
      { name: "contractAddress", type: "string", description: "NFT contract address" },
      { name: "tokenId", type: "string", description: "Token ID to fetch" },
    ],
    responseFields: ["token_id", "name", "image", "attributes", "owner", "external_url"],
  },

  "nft-portfolio-valuation": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getNFTPortfolioValuation(chainName, walletAddress) {
  const resp = await client.NftService.getNftsForAddress(
    chainName, walletAddress, { withUncached: false, noSpam: true }
  );
  const items = resp.data?.items ?? [];
  const totalUSD = items.reduce((s, nft) =>
    s + (nft.nft_data?.external_data?.asset_url ? 1 : 0), 0
  );
  return { walletAddress, nftCount: items.length, collections: items };
}`,
    endpoints: ["NftService.getNftsForAddress"],
    chains: ["eth-mainnet", "matic-mainnet", "base-mainnet"],
    complexity: "beginner",
    useCase: "NFT portfolio pages, wallet overview cards, collection breakdowns.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per wallet",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain to query" },
      { name: "walletAddress", type: "string", description: "Wallet holding NFTs" },
    ],
    responseFields: ["nftCount", "collections", "estimatedValueUSD", "rareItems"],
  },

  "nft-transfer-tracker": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function trackNFTTransfers(chainName, collectionAddress, tokenId) {
  const resp = await client.NftService.getNftTransactionsForContractTokenId(
    chainName, collectionAddress, tokenId
  );
  return (resp.data?.items ?? []).map(tx => ({
    from: tx.from_address,
    to: tx.to_address,
    timestamp: tx.block_signed_at,
    txHash: tx.tx_hash,
    salePrice: tx.value_quote,
  }));
}`,
    endpoints: ["NftService.getNftTransactionsForContractTokenId"],
    chains: ["eth-mainnet", "matic-mainnet", "base-mainnet"],
    complexity: "beginner",
    useCase: "NFT provenance tracking, ownership history, marketplace activity feeds.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per token",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain of the NFT" },
      { name: "collectionAddress", type: "string", description: "NFT contract address" },
      { name: "tokenId", type: "string", description: "Token ID to track" },
    ],
    responseFields: ["from", "to", "timestamp", "txHash", "salePrice"],
  },

  "rarity-analyzer": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function analyzeRarity(chainName, collectionAddress, tokenId) {
  const resp = await client.NftService.getNftMetadataForGivenTokenIdMetadata(
    chainName, collectionAddress, tokenId, { withUncached: true }
  );
  const attrs = resp.data?.items?.[0]?.nft_data?.external_data?.attributes ?? [];
  // Rarity score: sum of 1/traitFrequency for each trait
  const score = attrs.reduce((s, a) => s + (1 / Math.max(1, a.prevalence ?? 1)), 0);
  return { tokenId, rarityScore: score, attributes: attrs };
}`,
    endpoints: ["NftService.getNftMetadataForGivenTokenIdMetadata"],
    chains: ["eth-mainnet", "matic-mainnet", "base-mainnet"],
    complexity: "intermediate",
    useCase: "NFT rarity rankings, trait frequency tools, collection sniper apps.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per token",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain of the NFT" },
      { name: "collectionAddress", type: "string", description: "NFT contract address" },
      { name: "tokenId", type: "string", description: "Token to score" },
    ],
    responseFields: ["rarityScore", "rank", "attributes", "traitFrequencies"],
  },

  // ── ANALYTICS ──────────────────────────────────────────────────────────────
  "chain-activity-dashboard": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getChainActivityDashboard(chainNames) {
  const results = await Promise.all(
    chainNames.map(chain => client.BaseService.getBlock(chain, "latest"))
  );
  return chainNames.map((chain, i) => ({
    chain,
    latestBlock: results[i].data?.items?.[0]?.height,
    blockTime: results[i].data?.items?.[0]?.signed_at,
  }));
}`,
    endpoints: ["BaseService.getBlock", "BaseService.getAllChains"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "Multi-chain dashboards, blockchain explorer landing pages, devrel portals.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per chain",
    keyParams: [{ name: "chainNames", type: "ChainName[]", description: "Array of chains to compare" }],
    responseFields: ["chain", "latestBlock", "blockTime", "txCount", "activeAddresses"],
  },

  "event-log-decoder": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function decodeEventLogs(chainName, contractAddress, fromBlock, toBlock) {
  const resp = await client.BaseService.getLogEventsByAddressAndTopicHash(
    chainName, contractAddress,
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", // Transfer topic
    { startingBlock: fromBlock, endingBlock: toBlock }
  );
  return (resp.data?.items ?? []).map(e => ({
    name: e.decoded?.name,
    params: e.decoded?.params,
    blockHeight: e.block_height,
    txHash: e.tx_hash,
  }));
}`,
    endpoints: ["BaseService.getLogEventsByAddressAndTopicHash", "BaseService.getLogEventsByAddress"],
    chains: CHAINS_EVM,
    complexity: "intermediate",
    useCase: "Smart contract monitoring, event indexing, custom protocol analytics.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per request",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain to query" },
      { name: "contractAddress", type: "string", description: "Contract to watch" },
      { name: "fromBlock", type: "number", description: "Start block" },
      { name: "toBlock", type: "number", description: "End block or 'latest'" },
    ],
    responseFields: ["name", "params", "blockHeight", "txHash", "decoded"],
  },

  "gas-analytics": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getGasAnalytics(chainName) {
  const resp = await client.BaseService.getGasPrices(chainName, "eip1559");
  const items = resp.data?.items ?? [];
  return {
    chainName,
    baseFee: items[0]?.base_fee,
    maxPriorityFee: items[0]?.max_priority_fee,
    gasPrice: items[0]?.gas_price,
    estimatedCosts: {
      transfer: (items[0]?.gas_price ?? 0) * 21000 / 1e18,
      swap: (items[0]?.gas_price ?? 0) * 150000 / 1e18,
    },
  };
}`,
    endpoints: ["BaseService.getGasPrices"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "Gas trackers, transaction cost estimators, fee optimisation tooling.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per chain",
    keyParams: [{ name: "chainName", type: "ChainName", description: "EVM chain to query" }],
    responseFields: ["baseFee", "maxPriorityFee", "gasPrice", "estimatedCosts"],
  },

  "onchain-data-query": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Universal onchain data query — single function, 100+ chains
async function queryOnchainData({ chainName, type, address, blockHeight }) {
  switch (type) {
    case "balances":
      return client.BalanceService.getTokenBalancesForWalletAddress(chainName, address);
    case "transactions":
      return client.TransactionService.getTransactionsForAddressV3(chainName, address);
    case "block":
      return client.BaseService.getBlock(chainName, blockHeight ?? "latest");
    case "logs":
      return client.BaseService.getLogEventsByAddress(chainName, address);
    default:
      throw new Error("Unknown query type");
  }
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress", "TransactionService.getTransactionsForAddressV3", "BaseService.getBlock", "BaseService.getLogEventsByAddress"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "Universal data layer for onchain apps, AI agent data tools, developer scaffolding.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per call",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Target chain" },
      { name: "type", type: "string", description: "Query type: balances | transactions | block | logs" },
      { name: "address", type: "string", description: "Wallet or contract address" },
    ],
    responseFields: ["data", "items", "pagination", "error"],
  },

  "token-price-history": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getTokenPriceHistory(chainName, contractAddress, from, to) {
  const resp = await client.PricingService.getTokenPrices(
    chainName, "USD", contractAddress, { from, to }
  );
  return (resp.data?.items ?? []).map(p => ({
    date: p.date,
    price: p.price,
    volume24h: p.pretty_price_24h,
  }));
}`,
    endpoints: ["PricingService.getTokenPrices"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "Price charts, OHLCV data feeds, token analytics dashboards.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per request",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain of the token" },
      { name: "contractAddress", type: "string", description: "Token contract address" },
      { name: "from", type: "string", description: "Start date YYYY-MM-DD" },
      { name: "to", type: "string", description: "End date YYYY-MM-DD" },
    ],
    responseFields: ["date", "price", "open", "high", "low", "close", "volume24h"],
  },

  // ── AGENTS ─────────────────────────────────────────────────────────────────
  "agent-wallet-skill": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
import Anthropic from "@anthropic-ai/sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);
const anthropic = new Anthropic();

// Tool definition for Claude agent
const walletTool = {
  name: "get_wallet_data",
  description: "Fetch token balances and recent transactions for a wallet address on any EVM chain.",
  input_schema: {
    type: "object",
    properties: {
      walletAddress: { type: "string", description: "EVM wallet address" },
      chainName: { type: "string", description: "Chain name e.g. eth-mainnet" },
    },
    required: ["walletAddress"],
  },
};

async function runAgentWithWalletSkill(userMessage) {
  const messages = [{ role: "user", content: userMessage }];
  const resp = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    tools: [walletTool],
    messages,
  });
  // Handle tool_use blocks
  for (const block of resp.content) {
    if (block.type === "tool_use" && block.name === "get_wallet_data") {
      const { walletAddress, chainName = "eth-mainnet" } = block.input;
      const balances = await client.BalanceService.getTokenBalancesForWalletAddress(
        chainName, walletAddress, { noSpam: true }
      );
      return balances.data?.items ?? [];
    }
  }
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress", "TransactionService.getTransactionsForAddressV3"],
    chains: CHAINS_EVM,
    complexity: "intermediate",
    useCase: "Claude AI agents, LLM tool calling, chatbot wallet queries, AI assistants.",
    buildsWith: ["@covalenthq/client-sdk", "@anthropic-ai/sdk"],
    creditCost: "1 credit per wallet query",
    keyParams: [
      { name: "walletAddress", type: "string", description: "Target wallet" },
      { name: "chainName", type: "ChainName", description: "Chain to query" },
    ],
    responseFields: ["contract_name", "contract_ticker_symbol", "balance", "quote"],
  },

  "autonomous-defi-agent": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
import Anthropic from "@anthropic-ai/sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);
const anthropic = new Anthropic();

// Autonomous agent that reads DeFi state and suggests actions
async function runDeFiAgent(walletAddress) {
  const balances = await client.BalanceService.getTokenBalancesForWalletAddress(
    "eth-mainnet", walletAddress, { noSpam: true }
  );
  const portfolio = (balances.data?.items ?? [])
    .map(t => ({ symbol: t.contract_ticker_symbol, usd: t.quote }));

  const resp = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 512,
    messages: [{
      role: "user",
      content: \`DeFi portfolio: \${JSON.stringify(portfolio)}. Suggest one yield optimisation action.\`,
    }],
  });
  return resp.content[0]?.text;
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress", "TransactionService.getTransactionsForAddressV3"],
    chains: CHAINS_CORE,
    complexity: "advanced",
    useCase: "Autonomous DeFi management, yield optimisation bots, AI-powered portfolio rebalancers.",
    buildsWith: ["@covalenthq/client-sdk", "@anthropic-ai/sdk"],
    creditCost: "1 credit per data fetch",
    keyParams: [{ name: "walletAddress", type: "string", description: "Agent-controlled wallet" }],
    responseFields: ["portfolioState", "suggestedAction", "expectedAPY", "riskLevel"],
  },

  "claude-goldrush-skill": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
import Anthropic from "@anthropic-ai/sdk";

const gr = new GoldRushClient(process.env.GOLDRUSH_API_KEY);
const anthropic = new Anthropic();

// Register GoldRush as a Claude tool
const grTool = {
  name: "goldrush_query",
  description: "Query GoldRush for wallet balances, token prices, NFTs, or transaction history.",
  input_schema: {
    type: "object",
    properties: {
      queryType: { type: "string", enum: ["balances", "prices", "nfts", "transactions"] },
      address: { type: "string" },
      chainName: { type: "string" },
    },
    required: ["queryType", "address"],
  },
};

async function goldrushToolHandler({ queryType, address, chainName = "eth-mainnet" }) {
  switch (queryType) {
    case "balances": return gr.BalanceService.getTokenBalancesForWalletAddress(chainName, address);
    case "nfts":     return gr.NftService.getNftsForAddress(chainName, address);
    case "transactions": return gr.TransactionService.getTransactionsForAddressV3(chainName, address);
    default: throw new Error("Unknown queryType");
  }
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress", "NftService.getNftsForAddress", "TransactionService.getTransactionsForAddressV3"],
    chains: CHAINS_EVM,
    complexity: "intermediate",
    useCase: "Claude agent tool calling, MCP plugins, AI-powered blockchain assistants.",
    buildsWith: ["@covalenthq/client-sdk", "@anthropic-ai/sdk"],
    creditCost: "1 credit per query",
    keyParams: [
      { name: "queryType", type: "string", description: "balances | prices | nfts | transactions" },
      { name: "address", type: "string", description: "Wallet or contract address" },
      { name: "chainName", type: "ChainName", description: "Target chain" },
    ],
    responseFields: ["data", "items", "error", "pagination"],
  },

  "goldrush-mcp-server": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);
const server = new McpServer({ name: "goldrush", version: "1.0.0" });

server.tool("get_wallet_balances",
  { walletAddress: z.string(), chainName: z.string().default("eth-mainnet") },
  async ({ walletAddress, chainName }) => {
    const resp = await client.BalanceService.getTokenBalancesForWalletAddress(
      chainName, walletAddress, { noSpam: true }
    );
    return { content: [{ type: "text", text: JSON.stringify(resp.data?.items) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress", "TransactionService.getTransactionsForAddressV3", "NftService.getNftsForAddress"],
    chains: CHAINS_EVM,
    complexity: "intermediate",
    useCase: "Claude Desktop integration, MCP tool servers, LLM-native blockchain data access.",
    buildsWith: ["@covalenthq/client-sdk", "@modelcontextprotocol/sdk"],
    creditCost: "1 credit per tool call",
    keyParams: [
      { name: "walletAddress", type: "string", description: "Wallet to query" },
      { name: "chainName", type: "ChainName", description: "Chain (default: eth-mainnet)" },
    ],
    responseFields: ["content", "text", "data", "items"],
  },

  "onchain-memory-store": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Persistent onchain memory: derive agent context from wallet state
async function buildAgentMemory(agentWallet) {
  const [balances, activity, txns] = await Promise.all([
    client.BalanceService.getTokenBalancesForWalletAddress("eth-mainnet", agentWallet),
    client.AllChainsService.getAddressActivity(agentWallet),
    client.TransactionService.getTransactionsForAddressV3("eth-mainnet", agentWallet, { pageSize: 10 }),
  ]);
  return {
    portfolio: balances.data?.items?.map(t => ({ symbol: t.contract_ticker_symbol, usd: t.quote })),
    activeChains: activity.data?.items?.map(c => c.name),
    recentActions: txns.data?.items?.slice(0, 5).map(t => t.tx_hash),
  };
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress", "AllChainsService.getAddressActivity", "TransactionService.getTransactionsForAddressV3"],
    chains: CHAINS_CORE,
    complexity: "advanced",
    useCase: "Agent memory layers, persistent context for AI agents, stateful agent workflows.",
    buildsWith: ["@covalenthq/client-sdk", "@anthropic-ai/sdk"],
    creditCost: "3 credits per memory snapshot",
    keyParams: [{ name: "agentWallet", type: "string", description: "Agent-controlled wallet" }],
    responseFields: ["portfolio", "activeChains", "recentActions", "contextSummary"],
  },

  "onchain-research-agent": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
import Anthropic from "@anthropic-ai/sdk";

const gr = new GoldRushClient(process.env.GOLDRUSH_API_KEY);
const anthropic = new Anthropic();

async function researchOnchainEntity(address, question) {
  const [balances, txns, activity] = await Promise.all([
    gr.BalanceService.getTokenBalancesForWalletAddress("eth-mainnet", address, { noSpam: true }),
    gr.TransactionService.getTransactionsForAddressV3("eth-mainnet", address, { pageSize: 20 }),
    gr.AllChainsService.getAddressActivity(address),
  ]);
  const context = {
    holdings: balances.data?.items?.slice(0, 10),
    recentTxns: txns.data?.items?.slice(0, 10),
    activeChains: activity.data?.items?.map(c => c.name),
  };
  const resp = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: \`Onchain data for \${address}:\n\${JSON.stringify(context)}\n\nQuestion: \${question}\`,
    }],
  });
  return resp.content[0]?.text;
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress", "TransactionService.getTransactionsForAddressV3", "AllChainsService.getAddressActivity"],
    chains: CHAINS_CORE,
    complexity: "advanced",
    useCase: "AI-powered wallet research, due diligence automation, smart money analysis.",
    buildsWith: ["@covalenthq/client-sdk", "@anthropic-ai/sdk"],
    creditCost: "3 credits per research query",
    keyParams: [
      { name: "address", type: "string", description: "Wallet or contract to research" },
      { name: "question", type: "string", description: "Natural language research question" },
    ],
    responseFields: ["summary", "holdings", "patterns", "risks", "insights"],
  },

  "realtime-wallet-stream": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Poll for new transactions — production use WebSocket webhooks via goldrush.dev
async function* streamWalletActivity(chainName, walletAddress, intervalMs = 12000) {
  let lastBlock = 0;
  while (true) {
    const txns = await client.TransactionService.getTransactionsForAddressV3(
      chainName, walletAddress, { pageSize: 5, blockSignedAtAsc: false }
    );
    const latest = txns.data?.items ?? [];
    const newTxns = latest.filter(t => (t.block_height ?? 0) > lastBlock);
    if (newTxns.length) {
      lastBlock = Math.max(...newTxns.map(t => t.block_height ?? 0));
      yield newTxns;
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
}`,
    endpoints: ["TransactionService.getTransactionsForAddressV3"],
    chains: CHAINS_EVM,
    complexity: "intermediate",
    useCase: "Real-time wallet monitors, notification services, trading bots, event-driven agents.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per poll",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain to stream" },
      { name: "walletAddress", type: "string", description: "Wallet to monitor" },
      { name: "intervalMs", type: "number", description: "Poll interval in milliseconds" },
    ],
    responseFields: ["tx_hash", "from_address", "to_address", "value_quote", "block_height"],
  },

  // ── DEVELOPER ──────────────────────────────────────────────────────────────
  "api-reference": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

// All GoldRush services at a glance
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// BalanceService  — token balances, portfolio history, ERC20 transfers
// TransactionService — tx history, block txns, decoded logs
// NftService        — NFT metadata, transfers, ownership
// PricingService    — token spot prices, historical OHLCV
// SecurityService   — token approvals, risk scores
// BaseService       — blocks, log events, gas prices, all chains
// AllChainsService  — cross-chain address activity
// GoldRushDecoder   — ABI & event log decoding

// Example: BalanceService
const resp = await client.BalanceService.getTokenBalancesForWalletAddress(
  "eth-mainnet",
  "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // vitalik.eth
  { noSpam: true }
);
console.log(resp.data?.items?.length, "tokens");`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress", "TransactionService.getTransactionsForAddressV3", "NftService.getNftsForAddress", "PricingService.getTokenPrices"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "SDK onboarding, API reference, developer documentation, quickstarts.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per call",
    keyParams: [
      { name: "service", type: "string", description: "GoldRush service name" },
      { name: "method", type: "string", description: "Method to call" },
    ],
    responseFields: ["data", "items", "error", "pagination", "updated_at"],
  },

  "goldrush-playground": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

// Interactive playground — try any endpoint instantly
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function playground(endpoint, params) {
  const [service, method] = endpoint.split(".");
  if (!client[service]?.[method]) throw new Error(\`Unknown endpoint: \${endpoint}\`);
  const resp = await client[service][method](...Object.values(params));
  return {
    endpoint,
    params,
    data: resp.data,
    error: resp.error,
  };
}

// Try it:
const result = await playground("BalanceService.getTokenBalancesForWalletAddress", {
  chainName: "eth-mainnet",
  walletAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
});`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress", "TransactionService.getTransactionsForAddressV3"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "API exploration, SDK testing, developer onboarding, demo environments.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per call",
    keyParams: [
      { name: "endpoint", type: "string", description: "Service.method to call" },
      { name: "params", type: "object", description: "Parameters for the endpoint" },
    ],
    responseFields: ["endpoint", "params", "data", "error"],
  },

  "goldrush-react-hooks": {
    snippet: `// GoldRush React hooks — plug onchain data into any React component
import { useGoldRush } from "@covalenthq/goldrush-kit";

function WalletCard({ address }) {
  const { data, loading, error } = useGoldRush(
    "BalanceService.getTokenBalancesForWalletAddress",
    { chainName: "eth-mainnet", walletAddress: address }
  );

  if (loading) return <div>Loading...</div>;
  if (error)   return <div>Error: {error.message}</div>;

  const totalUSD = data?.items?.reduce((s, t) => s + (t.quote ?? 0), 0) ?? 0;
  return (
    <div>
      <h2>{address.slice(0,6)}…{address.slice(-4)}</h2>
      <p>Net worth: \${totalUSD.toFixed(2)}</p>
      {data?.items?.slice(0, 5).map(t => (
        <div key={t.contract_address}>{t.contract_ticker_symbol}: \${t.quote?.toFixed(2)}</div>
      ))}
    </div>
  );
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress", "NftService.getNftsForAddress"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "React dApps, Next.js onchain apps, wallet UI components, DeFi frontends.",
    buildsWith: ["@covalenthq/goldrush-kit", "@covalenthq/client-sdk"],
    creditCost: "1 credit per hook call",
    keyParams: [
      { name: "endpoint", type: "string", description: "GoldRush service.method" },
      { name: "walletAddress", type: "string", description: "Target wallet" },
      { name: "chainName", type: "ChainName", description: "Chain to query" },
    ],
    responseFields: ["data", "loading", "error", "items"],
  },

  "goldrush-typescript-sdk": {
    snippet: `import { GoldRushClient, ChainName } from "@covalenthq/client-sdk";

// Fully typed — autocomplete on all 100+ endpoints
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY!);

// Types are inferred automatically
const resp = await client.BalanceService.getTokenBalancesForWalletAddress(
  ChainName.ETH_MAINNET,
  "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  { noSpam: true, nft: false }
);

resp.data?.items?.forEach(token => {
  console.log(
    token.contract_ticker_symbol, // string
    token.quote,                  // number
    token.balance,                // string (wei)
  );
});`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "TypeScript dApps, type-safe blockchain data access, Node.js backends.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per call",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain enum value" },
      { name: "walletAddress", type: "string", description: "EVM address" },
    ],
    responseFields: ["data", "items", "error", "pagination", "chain_id"],
  },

  "quickstart-templates": {
    snippet: `// Quickstart: onchain portfolio app in < 30 lines
import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

export async function buildPortfolioApp(walletAddress) {
  const [balances, nfts, activity] = await Promise.all([
    client.BalanceService.getTokenBalancesForWalletAddress("eth-mainnet", walletAddress),
    client.NftService.getNftsForAddress("eth-mainnet", walletAddress),
    client.AllChainsService.getAddressActivity(walletAddress),
  ]);

  return {
    tokens: balances.data?.items ?? [],
    nfts:   nfts.data?.items ?? [],
    chains: activity.data?.items?.map(c => c.name) ?? [],
    totalUSD: (balances.data?.items ?? []).reduce((s, t) => s + (t.quote ?? 0), 0),
  };
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress", "NftService.getNftsForAddress", "AllChainsService.getAddressActivity"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "Hackathon scaffolding, onboarding templates, tutorial codebases.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "3 credits per full portfolio fetch",
    keyParams: [{ name: "walletAddress", type: "string", description: "Wallet to build portfolio for" }],
    responseFields: ["tokens", "nfts", "chains", "totalUSD"],
  },

  "webhook-builder": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
import express from "express";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);
const app = express();
app.use(express.json());

// Receive GoldRush webhook events
app.post("/webhook/goldrush", (req, res) => {
  const { type, walletAddress, chainName, txHash } = req.body;
  console.log(\`Event: \${type} | Wallet: \${walletAddress} | Chain: \${chainName}\`);
  // React to onchain events: new transfer, balance change, contract event
  res.sendStatus(200);
});

// Register webhook via GoldRush dashboard at goldrush.dev/webhooks
app.listen(3000, () => console.log("Webhook server ready"));`,
    endpoints: ["TransactionService.getTransactionsForAddressV3", "BaseService.getLogEventsByAddress"],
    chains: CHAINS_EVM,
    complexity: "intermediate",
    useCase: "Real-time alerts, event-driven automation, webhook-triggered agent workflows.",
    buildsWith: ["@covalenthq/client-sdk", "express"],
    creditCost: "1 credit per webhook event",
    keyParams: [
      { name: "eventType", type: "string", description: "Webhook event type to handle" },
      { name: "walletAddress", type: "string", description: "Monitored wallet" },
    ],
    responseFields: ["type", "walletAddress", "chainName", "txHash", "value"],
  },

  // ── CROSSCHAIN ─────────────────────────────────────────────────────────────
  "address-activity-scanner": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function scanAddressActivity(walletAddress) {
  const resp = await client.AllChainsService.getAddressActivity(walletAddress);
  return (resp.data?.items ?? []).map(chain => ({
    chain: chain.name,
    isActive: chain.is_testnet === false,
    lastActivity: chain.last_seen_at,
  }));
}`,
    endpoints: ["AllChainsService.getAddressActivity"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "Cross-chain wallet discovery, chain activity summaries, multi-chain onboarding.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per wallet",
    keyParams: [{ name: "walletAddress", type: "string", description: "EVM wallet address" }],
    responseFields: ["chain", "isActive", "lastActivity", "chainCount"],
  },

  "bridge-transaction-monitor": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Monitor bridge transactions by checking known bridge contracts
const BRIDGES = {
  "eth-mainnet": "0x3154Cf16ccdb4C6d922629664174b904d80F2C35", // Base bridge
};

async function monitorBridgeTransactions(walletAddress) {
  const results = await Promise.all(
    Object.entries(BRIDGES).map(async ([chain, bridge]) => {
      const txns = await client.TransactionService.getTransactionsForAddressV3(chain, walletAddress);
      const bridgeTxns = (txns.data?.items ?? []).filter(
        tx => tx.to_address?.toLowerCase() === bridge.toLowerCase()
      );
      return { chain, bridgeTxns };
    })
  );
  return results.filter(r => r.bridgeTxns.length > 0);
}`,
    endpoints: ["TransactionService.getTransactionsForAddressV3"],
    chains: CHAINS_EVM,
    complexity: "intermediate",
    useCase: "Bridge activity monitoring, cross-chain user analytics, bridge volume dashboards.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per chain",
    keyParams: [{ name: "walletAddress", type: "string", description: "Wallet to check for bridge activity" }],
    responseFields: ["chain", "bridgeTxns", "totalBridged", "destinationChain"],
  },

  "chain-comparison-tool": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function compareChains(chainNames) {
  const metrics = await Promise.all(
    chainNames.map(async chain => {
      const [gasInfo, chainInfo] = await Promise.all([
        client.BaseService.getGasPrices(chain, "eip1559"),
        client.BaseService.getBlock(chain, "latest"),
      ]);
      return {
        chain,
        gasPrice: gasInfo.data?.items?.[0]?.gas_price,
        latestBlock: chainInfo.data?.items?.[0]?.height,
        blockTime: chainInfo.data?.items?.[0]?.signed_at,
      };
    })
  );
  return metrics;
}`,
    endpoints: ["BaseService.getGasPrices", "BaseService.getBlock", "BaseService.getAllChains"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "Chain selection tools, multi-chain dev portals, gas comparison dashboards.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "2 credits per chain (1 per service)",
    keyParams: [{ name: "chainNames", type: "ChainName[]", description: "Chains to compare side-by-side" }],
    responseFields: ["chain", "gasPrice", "latestBlock", "blockTime", "tps"],
  },

  "cross-chain-address-lookup": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function crossChainAddressLookup(walletAddress) {
  // 1. Find active chains
  const activity = await client.AllChainsService.getAddressActivity(walletAddress);
  const chains = activity.data?.items?.map(c => c.name) ?? [];

  // 2. Fetch balances on all active chains in parallel
  const balances = await Promise.all(
    chains.map(chain =>
      client.BalanceService.getTokenBalancesForWalletAddress(chain, walletAddress, { noSpam: true })
    )
  );
  return chains.map((chain, i) => ({
    chain,
    totalUSD: (balances[i].data?.items ?? []).reduce((s, t) => s + (t.quote ?? 0), 0),
    tokens: balances[i].data?.items?.length ?? 0,
  }));
}`,
    endpoints: ["AllChainsService.getAddressActivity", "BalanceService.getTokenBalancesForWalletAddress"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "Cross-chain address resolvers, unified wallet views, multi-chain explorer pages.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 + N credits (N = active chains)",
    keyParams: [{ name: "walletAddress", type: "string", description: "EVM address to look up" }],
    responseFields: ["chain", "totalUSD", "tokens", "isActive"],
  },

  "multichain-portfolio": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getMultichainPortfolio(walletAddress) {
  const activity = await client.AllChainsService.getAddressActivity(walletAddress);
  const chains = (activity.data?.items ?? [])
    .filter(c => !c.is_testnet)
    .map(c => c.name);

  const portfolios = await Promise.all(
    chains.map(chain =>
      client.BalanceService.getTokenBalancesForWalletAddress(chain, walletAddress, { noSpam: true })
    )
  );
  const totalUSD = portfolios.reduce(
    (sum, p) => sum + (p.data?.items ?? []).reduce((s, t) => s + (t.quote ?? 0), 0), 0
  );
  return { walletAddress, totalUSD, chainCount: chains.length, portfolios };
}`,
    endpoints: ["AllChainsService.getAddressActivity", "BalanceService.getTokenBalancesForWalletAddress"],
    chains: CHAINS_EVM,
    complexity: "intermediate",
    useCase: "Multi-chain portfolio aggregators, DeFi dashboards, unified wallet apps.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 + N credits (N = active chains)",
    keyParams: [{ name: "walletAddress", type: "string", description: "Wallet to aggregate" }],
    responseFields: ["totalUSD", "chainCount", "portfolios", "chain", "tokens"],
  },

  // ── TOKEN ──────────────────────────────────────────────────────────────────
  "erc20-transfer-history": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getERC20TransferHistory(chainName, walletAddress, contractAddress) {
  const resp = await client.BalanceService.getErc20TransfersForWalletAddress(
    chainName, walletAddress, { contractAddress }
  );
  return (resp.data?.items ?? []).map(t => ({
    from: t.from_address,
    to: t.to_address,
    amount: t.delta,
    amountUSD: t.delta_quote,
    timestamp: t.block_signed_at,
    txHash: t.tx_hash,
  }));
}`,
    endpoints: ["BalanceService.getErc20TransfersForWalletAddress"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "Token transfer histories, tax reporting, wallet-level token analytics.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain to query" },
      { name: "walletAddress", type: "string", description: "Wallet address" },
      { name: "contractAddress", type: "string", description: "ERC-20 token contract" },
    ],
    responseFields: ["from", "to", "amount", "amountUSD", "timestamp", "txHash"],
  },

  "spot-price-ticker": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getSpotPriceTicker(chainName, contractAddress) {
  const resp = await client.PricingService.getTokenPrices(
    chainName, "USD", contractAddress
  );
  const latest = resp.data?.items?.[0];
  return {
    symbol: latest?.contract_ticker_symbol,
    price: latest?.price,
    priceChange24h: latest?.price_24h,
    marketCap: latest?.market_cap,
    volume24h: latest?.volume_24h,
  };
}`,
    endpoints: ["PricingService.getTokenPrices"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "Price tickers, portfolio valuations, token detail pages, trading interfaces.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per token",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain of the token" },
      { name: "contractAddress", type: "string", description: "Token contract address" },
    ],
    responseFields: ["symbol", "price", "priceChange24h", "marketCap", "volume24h"],
  },

  "token-approval-scanner": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function scanTokenApprovals(chainName, walletAddress) {
  const resp = await client.SecurityService.getApprovals(chainName, walletAddress);
  const active = (resp.data?.items ?? []).filter(a => a.allowance !== "0");
  return active.map(a => ({
    token: a.token_address_label || a.token_address,
    spender: a.spender_address_label || a.spender_address,
    allowance: a.allowance,
    riskScore: a.risk_score,
    valueAtRisk: a.value_at_risk,
  }));
}`,
    endpoints: ["SecurityService.getApprovals"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "Token approval managers, revoke.cash-style tools, wallet security scanners.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per wallet",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain to scan" },
      { name: "walletAddress", type: "string", description: "Wallet to audit approvals for" },
    ],
    responseFields: ["token", "spender", "allowance", "riskScore", "valueAtRisk"],
  },

  "token-holder-list": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getTokenHolderList(chainName, contractAddress) {
  const resp = await client.BalanceService.getTokenHoldersV2ForTokenAddress(
    chainName, contractAddress
  );
  return (resp.data?.items ?? []).map(h => ({
    address: h.address,
    balance: h.balance,
    balanceUSD: h.balance_quote,
    percentOwned: h.total_supply
      ? (Number(h.balance) / Number(h.total_supply)) * 100
      : null,
  }));
}`,
    endpoints: ["BalanceService.getTokenHoldersV2ForTokenAddress"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "Token distribution analysis, holder leaderboards, governance power mapping.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain of the token" },
      { name: "contractAddress", type: "string", description: "ERC-20 token contract address" },
    ],
    responseFields: ["address", "balance", "balanceUSD", "percentOwned", "rank"],
  },

  "token-metadata-api": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getTokenMetadata(chainName, contractAddress) {
  const resp = await client.BalanceService.getTokenBalancesForWalletAddress(
    chainName, contractAddress // use as identifier, not wallet
  );
  const token = resp.data?.items?.[0];
  return {
    name: token?.contract_name,
    symbol: token?.contract_ticker_symbol,
    decimals: token?.contract_decimals,
    logoUrl: token?.logo_url,
    totalSupply: token?.total_supply,
    contractAddress: token?.contract_address,
  };
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "Token detail pages, DEX interfaces, wallet token identification, search.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per token",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain of the token" },
      { name: "contractAddress", type: "string", description: "ERC-20 contract address" },
    ],
    responseFields: ["name", "symbol", "decimals", "logoUrl", "totalSupply", "contractAddress"],
  },

  "token-transfer-stream": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Stream ERC-20 transfers by polling latest block events
async function* streamTokenTransfers(chainName, contractAddress, intervalMs = 12000) {
  let lastBlock = 0;
  while (true) {
    const events = await client.BaseService.getLogEventsByAddressAndTopicHash(
      chainName, contractAddress,
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", // Transfer
      { startingBlock: lastBlock > 0 ? lastBlock + 1 : "latest" }
    );
    const items = events.data?.items ?? [];
    if (items.length > 0) {
      lastBlock = Math.max(...items.map(e => e.block_height ?? 0));
      yield items;
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
}`,
    endpoints: ["BaseService.getLogEventsByAddressAndTopicHash"],
    chains: CHAINS_CORE,
    complexity: "intermediate",
    useCase: "Real-time token transfer feeds, whale alert systems, DEX event monitors.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per poll",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain to stream" },
      { name: "contractAddress", type: "string", description: "Token contract to watch" },
    ],
    responseFields: ["from", "to", "amount", "block_height", "tx_hash"],
  },

  // ── IDENTITY ───────────────────────────────────────────────────────────────
  "ens-resolver": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
import { ethers } from "ethers";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);
const provider = new ethers.JsonRpcProvider(\`https://mainnet.infura.io/v3/\${process.env.INFURA_KEY}\`);

async function resolveENS(input) {
  if (input.endsWith(".eth") || input.includes(".")) {
    // Forward: name → address
    const address = await provider.resolveName(input);
    if (!address) return { input, resolved: null };
    const activity = await client.AllChainsService.getAddressActivity(address);
    return { input, address, activeChains: activity.data?.items?.length ?? 0 };
  } else {
    // Reverse: address → name
    const name = await provider.lookupAddress(input);
    return { input, ensName: name ?? null };
  }
}`,
    endpoints: ["AllChainsService.getAddressActivity"],
    chains: ["eth-mainnet"],
    complexity: "beginner",
    useCase: "ENS name resolution, identity display in dApps, reverse lookup for explorer pages.",
    buildsWith: ["@covalenthq/client-sdk", "ethers"],
    creditCost: "1 credit per address lookup",
    keyParams: [{ name: "input", type: "string", description: "ENS name (e.g. vitalik.eth) or wallet address" }],
    responseFields: ["address", "ensName", "activeChains", "avatar"],
  },

  "nft-gate": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function checkNFTGate(chainName, walletAddress, requiredContract) {
  const resp = await client.NftService.getNftsForAddress(chainName, walletAddress);
  const owned = (resp.data?.items ?? []).some(
    nft => nft.contract_address?.toLowerCase() === requiredContract.toLowerCase()
  );
  return {
    walletAddress,
    requiredContract,
    hasAccess: owned,
    ownedCount: resp.data?.items?.filter(
      nft => nft.contract_address?.toLowerCase() === requiredContract.toLowerCase()
    ).length ?? 0,
  };
}`,
    endpoints: ["NftService.getNftsForAddress"],
    chains: ["eth-mainnet", "matic-mainnet", "base-mainnet"],
    complexity: "beginner",
    useCase: "Token-gated content, NFT membership clubs, hold-to-access dApp features.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per wallet",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain of the NFT collection" },
      { name: "walletAddress", type: "string", description: "Wallet to check" },
      { name: "requiredContract", type: "string", description: "NFT contract address required for access" },
    ],
    responseFields: ["hasAccess", "ownedCount", "tokenIds"],
  },

  "proof-of-onchain-activity": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function proveOnchainActivity(walletAddress) {
  const [txns, activity, balances] = await Promise.all([
    client.TransactionService.getTransactionsForAddressV3("eth-mainnet", walletAddress),
    client.AllChainsService.getAddressActivity(walletAddress),
    client.BalanceService.getTokenBalancesForWalletAddress("eth-mainnet", walletAddress),
  ]);
  const txCount   = txns.data?.items?.length ?? 0;
  const chains    = activity.data?.items?.length ?? 0;
  const assets    = balances.data?.items?.length ?? 0;
  const score     = txCount * 2 + chains * 10 + assets * 3;
  return {
    walletAddress,
    score,
    level: score > 100 ? "high" : score > 30 ? "medium" : "low",
    txCount, chains, assets,
  };
}`,
    endpoints: ["TransactionService.getTransactionsForAddressV3", "AllChainsService.getAddressActivity", "BalanceService.getTokenBalancesForWalletAddress"],
    chains: ["eth-mainnet", "matic-mainnet"],
    complexity: "intermediate",
    useCase: "Sybil resistance, airdrop eligibility, proof of personhood, KYC-free verification.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "3 credits per proof (1 per service)",
    keyParams: [{ name: "walletAddress", type: "string", description: "Wallet to evaluate" }],
    responseFields: ["score", "level", "txCount", "chains", "assets"],
  },

  "wallet-identity-graph": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function buildWalletIdentityGraph(walletAddress) {
  const [activity, nfts, balances] = await Promise.all([
    client.AllChainsService.getAddressActivity(walletAddress),
    client.NftService.getNftsForAddress("eth-mainnet", walletAddress),
    client.BalanceService.getTokenBalancesForWalletAddress("eth-mainnet", walletAddress),
  ]);
  const badges  = (nfts.data?.items ?? []).filter(n => n.type === "ERC-721").length;
  const assets  = (balances.data?.items ?? []).length;
  const chains  = (activity.data?.items ?? []).length;
  return {
    walletAddress,
    identityScore: badges * 10 + chains * 15 + assets * 2,
    chains, badges, assets,
  };
}`,
    endpoints: ["AllChainsService.getAddressActivity", "NftService.getNftsForAddress", "BalanceService.getTokenBalancesForWalletAddress"],
    chains: ["eth-mainnet"],
    complexity: "intermediate",
    useCase: "Identity aggregation, Web3 profile pages, trust scoring, DID integrations.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "3 credits per identity graph (1 per service)",
    keyParams: [{ name: "walletAddress", type: "string", description: "Wallet to map" }],
    responseFields: ["identityScore", "chains", "badges", "assets", "ensName"],
  },

  // ── SECURITY ───────────────────────────────────────────────────────────────
  "approval-auditor": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function auditApprovals(chainName, walletAddress) {
  const resp = await client.SecurityService.getApprovals(chainName, walletAddress);
  const dangerous = (resp.data?.items ?? []).filter(
    a => a.allowance !== "0" && (a.risk_score ?? 0) > 50
  );
  return {
    walletAddress,
    dangerousApprovals: dangerous.length,
    totalValueAtRisk: dangerous.reduce((s, a) => s + (a.value_at_risk ?? 0), 0),
    approvals: dangerous.map(a => ({
      token: a.token_address_label,
      spender: a.spender_address_label,
      riskScore: a.risk_score,
      valueAtRisk: a.value_at_risk,
    })),
  };
}`,
    endpoints: ["SecurityService.getApprovals"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "Wallet security audit tools, approval revocation dashboards, DeFi safety checks.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per wallet",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain to audit" },
      { name: "walletAddress", type: "string", description: "Wallet to audit" },
    ],
    responseFields: ["dangerousApprovals", "totalValueAtRisk", "token", "spender", "riskScore"],
  },

  "contract-interaction-history": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getContractInteractionHistory(chainName, walletAddress, contractAddress) {
  const txns = await client.TransactionService.getTransactionsForAddressV3(
    chainName, walletAddress, { pageSize: 100 }
  );
  const interactions = (txns.data?.items ?? []).filter(
    tx => tx.to_address?.toLowerCase() === contractAddress.toLowerCase()
  );
  return {
    contractAddress,
    interactionCount: interactions.length,
    firstInteraction: interactions[interactions.length - 1]?.block_signed_at,
    lastInteraction: interactions[0]?.block_signed_at,
    interactions,
  };
}`,
    endpoints: ["TransactionService.getTransactionsForAddressV3"],
    chains: CHAINS_EVM,
    complexity: "intermediate",
    useCase: "Security forensics, incident response, contract interaction auditing.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain to query" },
      { name: "walletAddress", type: "string", description: "User wallet" },
      { name: "contractAddress", type: "string", description: "Contract to filter by" },
    ],
    responseFields: ["interactionCount", "firstInteraction", "lastInteraction", "interactions"],
  },

  "mev-monitor": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Known MEV bot signatures
const MEV_SIGNATURES = ["0x3593564c", "0x12aa3caf", "0x5ae401dc"];

async function detectMEVActivity(chainName, blockHeight) {
  const block = await client.TransactionService.getTransactionsForBlock(
    chainName, blockHeight
  );
  const mevTxns = (block.data?.items ?? []).filter(tx =>
    tx.input?.length > 10 && MEV_SIGNATURES.includes(tx.input.slice(0, 10))
  );
  return {
    blockHeight,
    totalTxns: block.data?.items?.length ?? 0,
    mevTxns: mevTxns.length,
    mevTransactions: mevTxns,
  };
}`,
    endpoints: ["TransactionService.getTransactionsForBlock"],
    chains: ["eth-mainnet", "bsc-mainnet"],
    complexity: "advanced",
    useCase: "MEV analytics dashboards, sandwich attack detection, block-level MEV research.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per block",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain to analyse" },
      { name: "blockHeight", type: "number", description: "Block number to scan" },
    ],
    responseFields: ["mevTxns", "totalTxns", "mevValue", "mevBots", "sandwichPairs"],
  },

  "phishing-address-checker": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function checkPhishingAddress(chainName, suspectedAddress) {
  const txns = await client.TransactionService.getTransactionsForAddressV3(
    chainName, suspectedAddress, { pageSize: 50 }
  );
  // Dust attack pattern: many zero-value outgoing transfers
  const dustTxns = (txns.data?.items ?? []).filter(
    tx => tx.from_address === suspectedAddress &&
          (tx.value === "0" || tx.value === null)
  );
  const isPhishing = dustTxns.length > 10;
  return {
    suspectedAddress,
    isPhishing,
    dustAttackCount: dustTxns.length,
    confidence: isPhishing ? "high" : "low",
  };
}`,
    endpoints: ["TransactionService.getTransactionsForAddressV3"],
    chains: CHAINS_EVM,
    complexity: "beginner",
    useCase: "Wallet safety guards, exchange onboarding screens, Web3 browser protection.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per address",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain to check" },
      { name: "suspectedAddress", type: "string", description: "Address to evaluate" },
    ],
    responseFields: ["isPhishing", "dustAttackCount", "confidence", "firstSeen"],
  },

  "token-risk-analyzer": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function analyzeTokenRisk(chainName, tokenAddress) {
  const [approvals, prices] = await Promise.all([
    client.SecurityService.getApprovals(chainName, tokenAddress),
    client.PricingService.getTokenPrices(chainName, "USD", tokenAddress),
  ]);
  const riskyApprovals = (approvals.data?.items ?? []).filter(a => (a.risk_score ?? 0) > 70);
  const price = prices.data?.items?.[0]?.price ?? 0;
  const riskScore = riskyApprovals.length * 20 + (price === 0 ? 30 : 0);
  return {
    tokenAddress,
    riskScore: Math.min(100, riskScore),
    riskLevel: riskScore > 60 ? "high" : riskScore > 30 ? "medium" : "low",
    riskyApprovals: riskyApprovals.length,
    currentPrice: price,
  };
}`,
    endpoints: ["SecurityService.getApprovals", "PricingService.getTokenPrices"],
    chains: CHAINS_EVM,
    complexity: "intermediate",
    useCase: "Token due diligence, DeFi safety tools, pre-investment rug-pull screening.",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "2 credits per token (1 per service)",
    keyParams: [
      { name: "chainName", type: "ChainName", description: "Chain of the token" },
      { name: "tokenAddress", type: "string", description: "Token contract to analyse" },
    ],
    responseFields: ["riskScore", "riskLevel", "riskyApprovals", "currentPrice", "lpLockStatus"],
  },
};

// ─── Apply enrichments ───────────────────────────────────────────────────────
let updated = 0;
let skipped = 0;

Object.entries(enrichments).forEach(([slug, fields]) => {
  const fp = path.join(META, `${slug}.json`);
  if (!fs.existsSync(fp)) {
    console.warn(`  MISSING: ${slug}.json`);
    return;
  }
  const existing = JSON.parse(fs.readFileSync(fp, "utf8"));
  if (existing.snippet) {
    skipped++;
    return; // already rich
  }
  const enriched = { ...existing, ...fields };
  fs.writeFileSync(fp, JSON.stringify(enriched, null, 2));
  updated++;
});

console.log(`✓ Enriched ${updated} metadata files (${skipped} already had snippets)`);
