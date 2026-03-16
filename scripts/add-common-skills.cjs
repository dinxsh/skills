/**
 * add-common-skills.cjs
 *
 * Adds ~30 new high-value skills covering the most commonly used GoldRush
 * endpoints and product patterns across supported chains.
 * Then rebuilds tools.json and slug-map.json.
 */

const fs   = require("fs");
const path = require("path");

const BASE     = path.join(__dirname, "..", "src", "data");
const TOOLS    = path.join(BASE, "tools");
const META     = path.join(BASE, "tool-metadata");

// ─── CHAINS CONSTANTS ────────────────────────────────────────────────────────
const CHAINS_EVM = [
  "eth-mainnet","base-mainnet","matic-mainnet","arbitrum-mainnet",
  "optimism-mainnet","bsc-mainnet","avalanche-mainnet","linea-mainnet",
  "scroll-mainnet","zksync-mainnet","blast-mainnet","mantle-mainnet",
  "fraxtal-mainnet","mode-mainnet","fantom-mainnet","gnosis-mainnet",
  "celo-mainnet","moonbeam-mainnet","metis-mainnet","zora-mainnet"
];
const CHAINS_ALL = [...CHAINS_EVM, "solana-mainnet", "btc-mainnet", "aptos-mainnet", "sui-mainnet"];

// ─── NEW TOOLS PER CATEGORY ──────────────────────────────────────────────────

const newTools = {

  wallet: [
    {
      title: "ERC-20 Transfer History",
      body: "Fetch full ERC-20 transfer history for any wallet, optionally filtered by token contract.",
      tag: "Free Tier",
      slug: "wallet-erc20-transfers",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getErc20Transfers(chainName, walletAddress, contractAddress) {
  const resp = await client.BalanceService.getErc20TransfersForWalletAddress(
    chainName,
    walletAddress,
    { contractAddress }   // optional filter by token
  );
  if (resp.error) throw new Error(resp.error_message);
  return resp.data.items.map(tx => ({
    txHash:       tx.tx_hash,
    block:        tx.block_height,
    timestamp:    tx.block_signed_at,
    fromAddress:  tx.from_address,
    toAddress:    tx.to_address,
    tokenName:    tx.transfers[0]?.contract_name,
    tokenSymbol:  tx.transfers[0]?.contract_ticker_symbol,
    decimals:     tx.transfers[0]?.contract_decimals,
    deltaRaw:     tx.transfers[0]?.delta,
    deltaUSD:     tx.transfers[0]?.delta_quote,
  }));
}`,
        endpoints: ["BalanceService.getErc20TransfersForWalletAddress"],
        chains: CHAINS_EVM,
        complexity: "beginner",
        useCase: "Token transfer history, accounting, tax reporting, airdrop verification, wallet forensics",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "1 credit per page",
        keyParams: [
          { name: "chainName", type: "string", description: "EVM chain name (e.g. eth-mainnet)" },
          { name: "walletAddress", type: "string", description: "EVM wallet address (0x…)" },
          { name: "contractAddress", type: "string", description: "Optional: filter by specific ERC-20 token" },
        ],
        responseFields: ["txHash","timestamp","fromAddress","toAddress","tokenSymbol","deltaRaw","deltaUSD"],
      }
    },
    {
      title: "Native Token Balance",
      body: "Lightweight check for the native token balance (ETH, MATIC, BNB, etc.) of any wallet across any chain.",
      tag: "Free Tier",
      slug: "native-token-balance",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getNativeBalance(chainName, walletAddress) {
  const resp = await client.BalanceService.getNativeTokenBalance(
    chainName,
    walletAddress
  );
  if (resp.error) throw new Error(resp.error_message);
  const d = resp.data;
  return {
    chainName,
    walletAddress,
    symbol:       d.contract_ticker_symbol,
    name:         d.contract_name,
    decimals:     d.contract_decimals,
    balanceRaw:   d.balance,
    balanceUSD:   d.quote,
    quoteRate:    d.quote_rate,
  };
}`,
        endpoints: ["BalanceService.getNativeTokenBalance"],
        chains: CHAINS_ALL,
        complexity: "beginner",
        useCase: "Gas balance checks, pre-flight validation before transactions, faucet eligibility, mobile wallet balance widgets",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "0.1 credits",
        keyParams: [
          { name: "chainName", type: "string", description: "Chain name (e.g. base-mainnet, solana-mainnet)" },
          { name: "walletAddress", type: "string", description: "Wallet address" },
        ],
        responseFields: ["symbol","balanceRaw","balanceUSD","quoteRate"],
      }
    },
    {
      title: "Wallet Age & Summary",
      body: "Get first and last transaction date, total transaction count, and gas spent for any wallet — the foundation for wallet age verification and on-chain identity.",
      tag: "Free Tier",
      slug: "wallet-age-summary",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getWalletAge(chainName, walletAddress) {
  const resp = await client.TransactionService.getTransactionSummary(
    chainName,
    walletAddress
  );
  if (resp.error) throw new Error(resp.error_message);
  const d = resp.data.items[0];
  return {
    walletAddress,
    firstTxDate:   d.earliest_transaction?.block_signed_at,
    lastTxDate:    d.latest_transaction?.block_signed_at,
    totalTxCount:  d.total_count,
    gasSpentNative: d.gas_quote,   // total gas in USD
    walletAgedays: d.earliest_transaction
      ? Math.floor((Date.now() - new Date(d.earliest_transaction.block_signed_at)) / 86400000)
      : null,
  };
}`,
        endpoints: ["TransactionService.getTransactionSummary"],
        chains: CHAINS_EVM,
        complexity: "beginner",
        useCase: "KYC-lite wallet verification, Sybil resistance, airdrop eligibility gates, reputation scoring, bot detection",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "0.1 credits",
        keyParams: [
          { name: "chainName", type: "string", description: "EVM chain name" },
          { name: "walletAddress", type: "string", description: "EVM wallet address" },
        ],
        responseFields: ["firstTxDate","lastTxDate","totalTxCount","gasSpentNative","walletAgeDays"],
      }
    },
    {
      title: "Historical Portfolio Value",
      body: "30-day rolling historical portfolio value with open/close/high/low per token per day — build P&L charts, portfolio performance dashboards, and DeFi fund trackers.",
      tag: "API Key Required",
      slug: "historical-portfolio-value",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getHistoricalPortfolio(chainName, walletAddress) {
  const resp = await client.BalanceService.getHistoricalPortfolioForWalletAddress(
    chainName,
    walletAddress,
    { quoteCurrency: "USD", days: 30 }
  );
  if (resp.error) throw new Error(resp.error_message);

  // Build a daily total USD value series
  const dailySeries = {};
  for (const token of resp.data.items) {
    for (const holding of token.holdings) {
      const date = holding.timestamp.split("T")[0];
      dailySeries[date] = (dailySeries[date] || 0) + (holding.close?.quote || 0);
    }
  }
  return Object.entries(dailySeries)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, totalUSD]) => ({ date, totalUSD }));
}`,
        endpoints: ["BalanceService.getHistoricalPortfolioForWalletAddress"],
        chains: CHAINS_EVM,
        complexity: "intermediate",
        useCase: "Portfolio P&L charts, daily NAV calculation, fund performance reporting, DCA tracker",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "5 credits",
        keyParams: [
          { name: "chainName", type: "string", description: "EVM chain name" },
          { name: "walletAddress", type: "string", description: "EVM wallet address" },
          { name: "days", type: "number", description: "Look-back window in days (max 30)" },
        ],
        responseFields: ["date","totalUSD","tokenBreakdown"],
      }
    },
  ],

  token: [
    {
      title: "Token Holders Snapshot",
      body: "Paginated list of every holder of an ERC-20 token with balance, percentage of supply, and address. Essential for airdrops, governance snapshots, and holder analytics.",
      tag: "API Key Required",
      slug: "token-holders-snapshot",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getTokenHolders(chainName, tokenAddress, pageSize = 1000) {
  const holders = [];
  let pageNumber = 0;
  let hasMore = true;

  while (hasMore) {
    const resp = await client.BalanceService.getTokenHoldersV2ForTokenAddress(
      chainName,
      tokenAddress,
      { pageSize, pageNumber }
    );
    if (resp.error) throw new Error(resp.error_message);
    holders.push(...resp.data.items);
    hasMore = resp.data.pagination?.has_more ?? false;
    pageNumber++;
  }

  return holders.map(h => ({
    address:      h.address,
    balance:      h.balance,
    balanceUSD:   h.balance_quote,
    percentage:   h.percent_of_supply_held,
  }));
}`,
        endpoints: ["BalanceService.getTokenHoldersV2ForTokenAddress"],
        chains: CHAINS_EVM,
        complexity: "intermediate",
        useCase: "Airdrop eligibility snapshots, governance token holder lists, whale monitoring, token distribution analysis",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "1 credit per page",
        keyParams: [
          { name: "chainName", type: "string", description: "EVM chain name" },
          { name: "tokenAddress", type: "string", description: "ERC-20 contract address" },
          { name: "pageSize", type: "number", description: "Holders per page (max 1000)" },
        ],
        responseFields: ["address","balance","balanceUSD","percentOfSupply"],
      }
    },
    {
      title: "Token Price History",
      body: "Historical USD price for one or more token contracts on any chain. Powers price charts, backtesting, P&L calculation, and DeFi analytics.",
      tag: "API Key Required",
      slug: "token-price-chart",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getTokenPriceHistory(chainName, contractAddresses, from, to) {
  // contractAddresses: comma-separated string or array
  const addresses = Array.isArray(contractAddresses)
    ? contractAddresses.join(",")
    : contractAddresses;

  const resp = await client.PricingService.getTokenPrices(
    chainName,
    "USD",
    addresses,
    { from, to }   // ISO date strings: "2024-01-01"
  );
  if (resp.error) throw new Error(resp.error_message);

  return resp.data.map(token => ({
    contractAddress: token.contract_address,
    symbol:          token.contract_ticker_symbol,
    name:            token.contract_name,
    prices: (token.prices || []).map(p => ({
      date:   p.date,
      price:  p.price,
    })),
  }));
}`,
        endpoints: ["PricingService.getTokenPrices"],
        chains: CHAINS_EVM,
        complexity: "beginner",
        useCase: "Price charts, portfolio P&L, DeFi backtesting, impermanent loss calculators, trade analytics",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "1 credit per token per day of data",
        keyParams: [
          { name: "chainName", type: "string", description: "EVM chain name" },
          { name: "contractAddresses", type: "string | string[]", description: "One or more token contract addresses" },
          { name: "from", type: "string", description: "Start date ISO-8601 (e.g. 2024-01-01)" },
          { name: "to", type: "string", description: "End date ISO-8601 (e.g. 2024-12-31)" },
        ],
        responseFields: ["contractAddress","symbol","prices[date,price]"],
      }
    },
    {
      title: "Token Supply & Metadata",
      body: "Fetch token contract metadata including name, symbol, decimals, total supply, logo, and current USD price from a single endpoint.",
      tag: "Free Tier",
      slug: "token-supply-metadata",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getTokenMetadata(chainName, tokenAddresses) {
  const addresses = Array.isArray(tokenAddresses)
    ? tokenAddresses.join(",")
    : tokenAddresses;

  const resp = await client.PricingService.getTokenPrices(
    chainName,
    "USD",
    addresses
  );
  if (resp.error) throw new Error(resp.error_message);

  return resp.data.map(t => ({
    address:      t.contract_address,
    name:         t.contract_name,
    symbol:       t.contract_ticker_symbol,
    decimals:     t.contract_decimals,
    logoUrl:      t.logo_url,
    currentPrice: t.prices?.[0]?.price ?? null,
    marketCap:    t.market_cap,
    totalSupply:  t.total_supply,
  }));
}`,
        endpoints: ["PricingService.getTokenPrices"],
        chains: CHAINS_EVM,
        complexity: "beginner",
        useCase: "Token info widgets, swap interfaces, portfolio enrichment, token search autocomplete",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "0.1 credits per token",
        keyParams: [
          { name: "chainName", type: "string", description: "EVM chain name" },
          { name: "tokenAddresses", type: "string | string[]", description: "Token contract addresses" },
        ],
        responseFields: ["address","name","symbol","decimals","logoUrl","currentPrice","marketCap","totalSupply"],
      }
    },
  ],

  nft: [
    {
      title: "NFT Collection Browser",
      body: "Browse all indexed NFT collections on a chain with floor price, volume, and holder stats. Build NFT marketplaces, discovery pages, and trending collection feeds.",
      tag: "API Key Required",
      slug: "nft-collection-browser",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function browseCollections(chainName, pageSize = 50) {
  const resp = await client.NftService.getChainCollections(
    chainName,
    { pageSize, pageNumber: 0 }
  );
  if (resp.error) throw new Error(resp.error_message);

  return resp.data.items.map(c => ({
    contractAddress: c.contract_address,
    name:            c.contract_name,
    tickerSymbol:    c.contract_ticker_symbol,
    type:            c.supports_erc?.join(","),
    logoUrl:         c.logo_url,
    floorPriceUSD:   c.floor_price_quote_7d,
    volumeUSD24h:    c.volume_quote_24h,
    uniqueHolders:   c.unique_wallet_count,
    totalTokens:     c.nft_count,
  }));
}`,
        endpoints: ["NftService.getChainCollections"],
        chains: CHAINS_EVM,
        complexity: "intermediate",
        useCase: "NFT marketplace collection listings, trending pages, collection discovery, portfolio diversification tools",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "1 credit per page",
        keyParams: [
          { name: "chainName", type: "string", description: "EVM chain name (e.g. eth-mainnet)" },
          { name: "pageSize", type: "number", description: "Collections per page (max 100)" },
        ],
        responseFields: ["contractAddress","name","floorPriceUSD","volumeUSD24h","uniqueHolders","totalTokens"],
      }
    },
    {
      title: "NFT Traits Explorer",
      body: "Fetch all trait types and their value distributions for an NFT collection. Essential for rarity calculators, collection analytics, and trait-based filtering UIs.",
      tag: "API Key Required",
      slug: "nft-traits-explorer",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getCollectionTraits(chainName, contractAddress) {
  const resp = await client.NftService.getTraitsForCollection(
    chainName,
    contractAddress
  );
  if (resp.error) throw new Error(resp.error_message);

  // For each trait type, get the value breakdown
  const traitTypes = resp.data.items;
  const result = [];

  for (const traitType of traitTypes) {
    const valResp = await client.NftService.getAttributesForTraitInCollection(
      chainName,
      contractAddress,
      traitType.name
    );
    if (!valResp.error) {
      result.push({
        traitName:  traitType.name,
        uniqueCount: traitType.unique_attribute_count,
        values: valResp.data.items.map(v => ({
          value:       v.trait_value,
          count:       v.count,
          rarityPct:   ((v.count / v.collection_token_count) * 100).toFixed(2),
        })),
      });
    }
  }
  return result;
}`,
        endpoints: ["NftService.getTraitsForCollection", "NftService.getAttributesForTraitInCollection"],
        chains: CHAINS_EVM,
        complexity: "intermediate",
        useCase: "NFT rarity calculators, trait-based filtering, collection analytics dashboards, marketplace attribute search",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "1 credit per trait fetch",
        keyParams: [
          { name: "chainName", type: "string", description: "EVM chain name" },
          { name: "contractAddress", type: "string", description: "NFT collection contract address" },
        ],
        responseFields: ["traitName","uniqueCount","values[value,count,rarityPct]"],
      }
    },
    {
      title: "NFT Gallery Viewer",
      body: "Drop-in React component that renders a full NFT gallery for any wallet using GoldRush Kit's NFTWalletCollectionView — zero custom UI needed.",
      tag: "Open Source",
      slug: "nft-gallery-viewer",
      meta: {
        snippet: `// Install: npm install @covalenthq/goldrush-kit
import {
  GoldRushProvider,
  NFTWalletCollectionView,
} from "@covalenthq/goldrush-kit";
import "@covalenthq/goldrush-kit/styles.css";

export function NFTGallery({ walletAddress }) {
  return (
    <GoldRushProvider
      apikey={process.env.NEXT_PUBLIC_GOLDRUSH_API_KEY}
      theme={{ mode: "dark", borderRadius: 8 }}
    >
      <NFTWalletCollectionView
        address={walletAddress}
        chain_names={[
          "eth-mainnet",
          "base-mainnet",
          "matic-mainnet",
          "arbitrum-mainnet",
        ]}
        on_transfer_click={(nft) => console.log("NFT clicked:", nft)}
      />
    </GoldRushProvider>
  );
}`,
        endpoints: ["NftService.getNftsForAddress"],
        chains: CHAINS_EVM,
        complexity: "beginner",
        useCase: "NFT portfolio pages, wallet profile pages, social identity UIs, NFT-gated dashboards",
        buildsWith: ["@covalenthq/goldrush-kit"],
        creditCost: "Included in kit",
        keyParams: [
          { name: "address", type: "string", description: "Wallet address" },
          { name: "chain_names", type: "string[]", description: "Chains to query for NFTs" },
        ],
        responseFields: ["nftName","collection","tokenId","imageUrl","floorPriceUSD"],
      }
    },
    {
      title: "NFT Token Sale History",
      body: "Full transfer and sale history for a single NFT token ID — who owned it, when it sold, and for how much. Powers provenance viewers and NFT detail pages.",
      tag: "API Key Required",
      slug: "nft-sale-history",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getNftSaleHistory(chainName, contractAddress, tokenId) {
  const resp = await client.NftService.getNftTransactionsForContractTokenId(
    chainName,
    contractAddress,
    tokenId
  );
  if (resp.error) throw new Error(resp.error_message);

  return resp.data.items.map(tx => ({
    txHash:    tx.tx_hash,
    timestamp: tx.block_signed_at,
    from:      tx.nft_transactions?.[0]?.from_address,
    to:        tx.nft_transactions?.[0]?.to_address,
    priceUSD:  tx.nft_transactions?.[0]?.value_quote,
    event:     tx.nft_transactions?.[0]?.transfer_type, // "transfer" | "sale"
  }));
}`,
        endpoints: ["NftService.getNftTransactionsForContractTokenId"],
        chains: CHAINS_EVM,
        complexity: "beginner",
        useCase: "NFT provenance viewers, price history charts, ownership timeline, marketplace detail pages",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "1 credit per page",
        keyParams: [
          { name: "chainName", type: "string", description: "EVM chain name" },
          { name: "contractAddress", type: "string", description: "NFT collection contract" },
          { name: "tokenId", type: "string", description: "Token ID" },
        ],
        responseFields: ["txHash","timestamp","from","to","priceUSD","event"],
      }
    },
  ],

  analytics: [
    {
      title: "Contract Event Log Monitor",
      body: "Stream all decoded event logs emitted by any smart contract — filter by topic hash, date, or block range. The foundation for DEX analytics, protocol dashboards, and real-time monitoring.",
      tag: "API Key Required",
      slug: "contract-event-log-monitor",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Example: watch all Swap events on a Uniswap V3 pool
const SWAP_TOPIC = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";

async function getContractEvents(chainName, contractAddress, topic, startBlock, endBlock) {
  const resp = await client.BaseService.getLogs(
    chainName,
    {
      address:        contractAddress,
      topicHash:      topic,
      blockStart:     startBlock,
      blockEnd:       endBlock,
      pageSize:       1000,
    }
  );
  if (resp.error) throw new Error(resp.error_message);

  return resp.data.items.map(log => ({
    txHash:        log.tx_hash,
    blockHeight:   log.block_height,
    timestamp:     log.block_signed_at,
    senderAddress: log.sender_address,
    decodedName:   log.decoded?.name,
    decodedParams: log.decoded?.params,
    rawData:       log.raw_log_data,
  }));
}`,
        endpoints: ["BaseService.getLogs"],
        chains: CHAINS_EVM,
        complexity: "intermediate",
        useCase: "DEX swap monitoring, protocol revenue tracking, governance event feeds, liquidation alerts, custom webhook triggers",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "1 credit per page",
        keyParams: [
          { name: "chainName", type: "string", description: "EVM chain name" },
          { name: "address", type: "string", description: "Contract address to monitor" },
          { name: "topicHash", type: "string", description: "Keccak-256 of event signature (e.g. Transfer topic hash)" },
          { name: "blockStart/blockEnd", type: "number", description: "Block range to query" },
        ],
        responseFields: ["txHash","blockHeight","timestamp","decodedName","decodedParams"],
      }
    },
    {
      title: "Cross-Contract Event Scanner",
      body: "Scan ALL contracts on a chain for a specific event by topic hash — e.g. find every ERC-20 Transfer or every Uniswap Swap across the entire chain.",
      tag: "API Key Required",
      slug: "cross-contract-event-scanner",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// ERC-20 Transfer topic hash
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

async function scanChainForEvent(chainName, topicHash, startBlock, endBlock) {
  const resp = await client.BaseService.getLogEventsByTopicHash(
    chainName,
    topicHash,
    { blockStart: startBlock, blockEnd: endBlock, pageSize: 1000 }
  );
  if (resp.error) throw new Error(resp.error_message);

  return resp.data.items.map(log => ({
    txHash:       log.tx_hash,
    block:        log.block_height,
    timestamp:    log.block_signed_at,
    sender:       log.sender_address,
    contractName: log.sender_name,
    decoded:      log.decoded?.params,
  }));
}`,
        endpoints: ["BaseService.getLogEventsByTopicHash"],
        chains: CHAINS_EVM,
        complexity: "advanced",
        useCase: "Chain-wide event indexing, MEV opportunity detection, cross-protocol analytics, competitive intelligence dashboards",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "1 credit per page",
        keyParams: [
          { name: "chainName", type: "string", description: "EVM chain name" },
          { name: "topicHash", type: "string", description: "Event topic hash to scan for" },
          { name: "blockStart/blockEnd", type: "number", description: "Block range" },
        ],
        responseFields: ["txHash","block","timestamp","sender","contractName","decoded"],
      }
    },
    {
      title: "Block Explorer Toolkit",
      body: "Fetch block details, all transactions in a block, and decode individual transactions — all the building blocks for a custom block explorer.",
      tag: "Free Tier",
      slug: "block-explorer-toolkit",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Get a block and its transactions
async function getBlockWithTxns(chainName, blockHeight = "latest") {
  const [blockResp, txResp] = await Promise.all([
    client.BaseService.getBlock(chainName, blockHeight),
    client.TransactionService.getTransactionsForBlock(chainName, blockHeight),
  ]);

  const block = blockResp.data;
  const txns  = txResp.data?.items ?? [];

  return {
    blockHeight:  block.height,
    blockHash:    block.block_hash,
    timestamp:    block.signed_at,
    gasUsed:      block.gas_used,
    gasLimit:     block.gas_limit,
    txCount:      txns.length,
    transactions: txns.map(tx => ({
      hash:      tx.tx_hash,
      from:      tx.from_address,
      to:        tx.to_address,
      valueUSD:  tx.value_quote,
      gasSpent:  tx.fees_paid,
      status:    tx.successful ? "success" : "failed",
    })),
  };
}`,
        endpoints: ["BaseService.getBlock", "TransactionService.getTransactionsForBlock", "TransactionService.getTransaction"],
        chains: CHAINS_EVM,
        complexity: "intermediate",
        useCase: "Custom block explorers, transaction debuggers, chain activity monitors, validator dashboards",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "1 credit per page",
        keyParams: [
          { name: "chainName", type: "string", description: "EVM chain name" },
          { name: "blockHeight", type: "number | 'latest'", description: "Block height or 'latest'" },
        ],
        responseFields: ["blockHeight","blockHash","timestamp","gasUsed","txCount","transactions"],
      }
    },
    {
      title: "Wallet Activity Heatmap",
      body: "Generate a GitHub-style activity heatmap showing daily transaction counts for any wallet — visualize on-chain behaviour patterns.",
      tag: "API Key Required",
      slug: "wallet-activity-heatmap",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getActivityHeatmap(chainName, walletAddress) {
  // Fetch all time-bucketed transactions (daily buckets)
  const heatmap = {};
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const resp = await client.TransactionService.getTransactionsForAddressV3(
      chainName,
      walletAddress,
      { pageNumber: page, pageSize: 100 }
    );
    if (resp.error) break;
    for (const tx of resp.data.items) {
      const day = tx.block_signed_at?.split("T")[0];
      if (day) heatmap[day] = (heatmap[day] || 0) + 1;
    }
    hasMore = resp.data.pagination?.has_more ?? false;
    page++;
  }

  return Object.entries(heatmap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}`,
        endpoints: ["TransactionService.getTransactionsForAddressV3"],
        chains: CHAINS_EVM,
        complexity: "intermediate",
        useCase: "Developer portfolio pages, wallet identity profiles, on-chain activity scoring, social DeFi profiles",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "1 credit per page",
        keyParams: [
          { name: "chainName", type: "string", description: "EVM chain name" },
          { name: "walletAddress", type: "string", description: "Wallet address" },
        ],
        responseFields: ["date","transactionCount"],
      }
    },
  ],

  developer: [
    {
      title: "GoldRush Kit Token Balances",
      body: "Drop-in React component for a full token balances table — ERC-20 + native — using GoldRush Kit's TokenBalancesListView. Ships with sorting, USD values, logos, and spam filtering.",
      tag: "Open Source",
      slug: "goldrush-kit-token-balances",
      meta: {
        snippet: `// Install: npm install @covalenthq/goldrush-kit
import {
  GoldRushProvider,
  TokenBalancesListView,
} from "@covalenthq/goldrush-kit";
import "@covalenthq/goldrush-kit/styles.css";

export function WalletTokenTable({ walletAddress }) {
  return (
    <GoldRushProvider
      apikey={process.env.NEXT_PUBLIC_GOLDRUSH_API_KEY}
      theme={{ mode: "dark", borderRadius: 8 }}
    >
      <TokenBalancesListView
        address={walletAddress}
        chain_names={[
          "eth-mainnet",
          "base-mainnet",
          "matic-mainnet",
          "arbitrum-mainnet",
          "optimism-mainnet",
        ]}
        mask_balances={false}
        hide_small_balances={true}
      />
    </GoldRushProvider>
  );
}`,
        endpoints: ["BalanceService.getTokenBalancesForWalletAddress"],
        chains: CHAINS_EVM,
        complexity: "beginner",
        useCase: "Wallet dashboards, DeFi portfolio pages, CEX-style account overviews, mobile wallet balance screens",
        buildsWith: ["@covalenthq/goldrush-kit"],
        creditCost: "Included in kit",
        keyParams: [
          { name: "address", type: "string", description: "Wallet address" },
          { name: "chain_names", type: "string[]", description: "Chains to include in the balance view" },
          { name: "hide_small_balances", type: "boolean", description: "Hides dust/spam tokens below threshold" },
        ],
        responseFields: ["tokenName","symbol","balance","balanceUSD","logo"],
      }
    },
    {
      title: "GoldRush Kit Approval Manager",
      body: "Drop-in React component that shows all active ERC-20 and NFT approvals for a wallet using ApprovalsListView — with built-in revoke functionality.",
      tag: "Open Source",
      slug: "goldrush-kit-approvals",
      meta: {
        snippet: `// Install: npm install @covalenthq/goldrush-kit
import {
  GoldRushProvider,
  ApprovalsListView,
} from "@covalenthq/goldrush-kit";
import "@covalenthq/goldrush-kit/styles.css";

export function WalletApprovals({ walletAddress }) {
  return (
    <GoldRushProvider
      apikey={process.env.NEXT_PUBLIC_GOLDRUSH_API_KEY}
    >
      <ApprovalsListView
        address={walletAddress}
        chain_names={[
          "eth-mainnet",
          "base-mainnet",
          "matic-mainnet",
          "arbitrum-mainnet",
        ]}
        on_revoke_approval={async (approval) => {
          // Hook into your wallet provider to send revoke tx
          console.log("Revoking approval:", approval);
        }}
      />
    </GoldRushProvider>
  );
}`,
        endpoints: ["SecurityService.getApprovals"],
        chains: CHAINS_EVM,
        complexity: "beginner",
        useCase: "Wallet security dashboards, Revoke.cash-style tools, DeFi safety checkers, hardware wallet companion apps",
        buildsWith: ["@covalenthq/goldrush-kit"],
        creditCost: "Included in kit",
        keyParams: [
          { name: "address", type: "string", description: "Wallet address to check approvals for" },
          { name: "chain_names", type: "string[]", description: "Chains to scan for approvals" },
          { name: "on_revoke_approval", type: "function", description: "Callback when user clicks Revoke" },
        ],
        responseFields: ["spender","allowance","tokenAddress","riskLevel"],
      }
    },
    {
      title: "GoldRush Kit Transaction Feed",
      body: "Drop-in React component rendering a paginated, decoded transaction activity feed for any wallet using WalletActivityListView.",
      tag: "Open Source",
      slug: "goldrush-kit-tx-feed",
      meta: {
        snippet: `// Install: npm install @covalenthq/goldrush-kit
import {
  GoldRushProvider,
  WalletActivityListView,
} from "@covalenthq/goldrush-kit";
import "@covalenthq/goldrush-kit/styles.css";

export function TransactionFeed({ walletAddress }) {
  return (
    <GoldRushProvider
      apikey={process.env.NEXT_PUBLIC_GOLDRUSH_API_KEY}
      theme={{ mode: "dark" }}
    >
      <WalletActivityListView
        address={walletAddress}
        chain_names={[
          "eth-mainnet",
          "base-mainnet",
          "arbitrum-mainnet",
        ]}
        on_transaction_click={(tx) => {
          window.open(\`https://etherscan.io/tx/\${tx.tx_hash}\`, "_blank");
        }}
      />
    </GoldRushProvider>
  );
}`,
        endpoints: ["TransactionService.getTransactionsForAddressV3"],
        chains: CHAINS_EVM,
        complexity: "beginner",
        useCase: "Wallet activity pages, DeFi position history, account statement views, social transaction feeds",
        buildsWith: ["@covalenthq/goldrush-kit"],
        creditCost: "Included in kit",
        keyParams: [
          { name: "address", type: "string", description: "Wallet address" },
          { name: "chain_names", type: "string[]", description: "Chains to include" },
          { name: "on_transaction_click", type: "function", description: "Click handler for tx row" },
        ],
        responseFields: ["txHash","timestamp","from","to","valueUSD","gasSpent","status"],
      }
    },
    {
      title: "All Chains Status Monitor",
      body: "Fetch the real-time sync status of all 200+ GoldRush-supported chains — latest indexed block, sync lag, and chain metadata. Ideal for multi-chain app health checks.",
      tag: "Free Tier",
      slug: "all-chains-status",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getChainStatuses() {
  const [chainsResp, statusResp] = await Promise.all([
    client.BaseService.getAllChains(),
    client.BaseService.getAllChainStatuses(),
  ]);

  const meta   = Object.fromEntries(
    chainsResp.data.items.map(c => [c.name, c])
  );
  const statuses = statusResp.data.items;

  return statuses.map(s => ({
    chainName:      s.name,
    chainId:        meta[s.name]?.chain_id,
    logoUrl:        meta[s.name]?.logo_url,
    explorerUrl:    meta[s.name]?.explorers?.[0]?.url,
    latestBlock:    s.synced_block_height,
    isSyncing:      s.is_indexing,
    syncLag:        s.synced_block_height - s.latest_quick_sync_block_height,
  }));
}`,
        endpoints: ["BaseService.getAllChains", "BaseService.getAllChainStatuses"],
        chains: CHAINS_ALL,
        complexity: "beginner",
        useCase: "Multi-chain app health dashboards, chain selector components, DevOps monitoring, chain picker UIs",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "0.1 credits",
        keyParams: [],
        responseFields: ["chainName","chainId","logoUrl","latestBlock","isSyncing","syncLag"],
      }
    },
  ],

  crosschain: [
    {
      title: "Multi-Chain Activity Discovery",
      body: "Scan every supported chain simultaneously to discover which networks a wallet has been active on — single call, 200+ chains. The must-have entry point for any cross-chain app.",
      tag: "API Key Required",
      slug: "multichain-activity-discovery",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function discoverActiveChains(walletAddress) {
  const resp = await client.BaseService.getMultiChainActivity(walletAddress);
  if (resp.error) throw new Error(resp.error_message);

  const activeChains = resp.data.items.filter(c => c.is_wallet_active);

  return {
    walletAddress,
    totalChainsActive: activeChains.length,
    chains: activeChains.map(c => ({
      chainName:   c.name,
      chainId:     c.chain_id,
      logoUrl:     c.logo_url,
      latestTxAt:  c.last_seen_at,
      gasQuote:    c.gas_quote,
    })),
  };
}`,
        endpoints: ["BaseService.getMultiChainActivity"],
        chains: CHAINS_ALL,
        complexity: "beginner",
        useCase: "Cross-chain wallet onboarding, multi-chain portfolio discovery, agent wallet initialization, chain-agnostic identity",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "1 credit (scans all chains)",
        keyParams: [
          { name: "walletAddress", type: "string", description: "Wallet address to scan across all chains" },
        ],
        responseFields: ["chains[chainName,chainId,latestTxAt,gasQuote]","totalChainsActive"],
      }
    },
    {
      title: "Multi-Chain Token Aggregator",
      body: "Aggregate all token balances across every chain a wallet is active on — auto-discovers chains then fetches balances in parallel. One function call for a complete cross-chain portfolio.",
      tag: "API Key Required",
      slug: "multichain-token-aggregator",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getAllChainBalances(walletAddress) {
  // Step 1: discover active chains
  const activityResp = await client.BaseService.getMultiChainActivity(walletAddress);
  if (activityResp.error) throw new Error(activityResp.error_message);

  const activeChains = activityResp.data.items
    .filter(c => c.is_wallet_active)
    .map(c => c.name);

  // Step 2: fetch balances on all active chains in parallel
  const results = await Promise.allSettled(
    activeChains.map(chainName =>
      client.BalanceService.getTokenBalancesForWalletAddress(chainName, walletAddress)
    )
  );

  let totalUSD = 0;
  const chainBreakdown = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled" && !result.value.error) {
      const items = result.value.data.items ?? [];
      const chainUSD = items.reduce((sum, t) => sum + (t.quote || 0), 0);
      totalUSD += chainUSD;
      chainBreakdown.push({
        chainName:   activeChains[i],
        totalUSD:    chainUSD,
        tokenCount:  items.length,
        tokens:      items.map(t => ({
          symbol:  t.contract_ticker_symbol,
          balance: t.balance,
          usd:     t.quote,
        })),
      });
    }
  });

  return { walletAddress, totalUSD, chainBreakdown };
}`,
        endpoints: ["BaseService.getMultiChainActivity", "BalanceService.getTokenBalancesForWalletAddress"],
        chains: CHAINS_ALL,
        complexity: "intermediate",
        useCase: "Unified cross-chain portfolio trackers, multi-chain net worth widgets, DeFi aggregator dashboards",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "1 credit per chain queried",
        keyParams: [
          { name: "walletAddress", type: "string", description: "Wallet address to aggregate across all chains" },
        ],
        responseFields: ["totalUSD","chainBreakdown[chainName,totalUSD,tokenCount,tokens]"],
      }
    },
    {
      title: "Cross-Chain Transaction History",
      body: "Fetch and merge transaction history across multiple chains for a single wallet — great for multichain explorers, unified activity timelines, and tax reporting tools.",
      tag: "API Key Required",
      slug: "cross-chain-transaction-history",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getCrossChainTxHistory(walletAddress, chainNames) {
  const results = await Promise.allSettled(
    chainNames.map(async chainName => {
      const resp = await client.TransactionService.getTransactionsForAddressV3(
        chainName,
        walletAddress
      );
      if (resp.error) return [];
      return resp.data.items.map(tx => ({
        chain:     chainName,
        txHash:    tx.tx_hash,
        timestamp: tx.block_signed_at,
        from:      tx.from_address,
        to:        tx.to_address,
        valueUSD:  tx.value_quote,
        gasSpent:  tx.fees_paid,
        successful: tx.successful,
      }));
    })
  );

  const allTxns = results
    .flatMap(r => r.status === "fulfilled" ? r.value : [])
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return allTxns;
}`,
        endpoints: ["TransactionService.getTransactionsForAddressV3"],
        chains: CHAINS_EVM,
        complexity: "intermediate",
        useCase: "Cross-chain activity timelines, crypto tax reports, unified wallet history, multi-chain explorers",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "1 credit per page per chain",
        keyParams: [
          { name: "walletAddress", type: "string", description: "Wallet address" },
          { name: "chainNames", type: "string[]", description: "List of chains to query (e.g. ['eth-mainnet', 'base-mainnet'])" },
        ],
        responseFields: ["chain","txHash","timestamp","from","to","valueUSD","gasSpent","successful"],
      }
    },
  ],

  identity: [
    {
      title: "Governance Token Snapshot",
      body: "Snapshot all holders of a governance token at a specific block height for voting power calculation, airdrop distribution, or DAO membership verification.",
      tag: "API Key Required",
      slug: "governance-token-snapshot",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function takeGovernanceSnapshot(chainName, tokenAddress, blockHeight) {
  // blockHeight = snapshot block (or undefined for current)
  const resp = await client.BalanceService.getTokenHoldersV2ForTokenAddress(
    chainName,
    tokenAddress,
    {
      blockHeight,
      pageSize: 1000,
      pageNumber: 0,
    }
  );
  if (resp.error) throw new Error(resp.error_message);

  const holders = resp.data.items;
  const totalSupply = holders.reduce((s, h) => s + BigInt(h.balance || 0), 0n);

  return {
    snapshotBlock: blockHeight,
    tokenAddress,
    totalHolders: holders.length,
    holders: holders.map(h => ({
      address:      h.address,
      balance:      h.balance,
      votingPower:  totalSupply > 0n
        ? Number((BigInt(h.balance || 0) * 10000n) / totalSupply) / 100
        : 0,
    })).sort((a, b) => Number(BigInt(b.balance) - BigInt(a.balance))),
  };
}`,
        endpoints: ["BalanceService.getTokenHoldersV2ForTokenAddress"],
        chains: CHAINS_EVM,
        complexity: "intermediate",
        useCase: "DAO governance snapshots, on-chain voting eligibility, airdrop distribution, token-gated access verification",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "1 credit per page",
        keyParams: [
          { name: "chainName", type: "string", description: "EVM chain name" },
          { name: "tokenAddress", type: "string", description: "Governance token contract address" },
          { name: "blockHeight", type: "number", description: "Block height for historical snapshot" },
        ],
        responseFields: ["snapshotBlock","totalHolders","holders[address,balance,votingPower]"],
      }
    },
    {
      title: "Onchain Activity Verifier",
      body: "Verify on-chain activity depth with transaction count, wallet age, chains used, and token diversity — build KYC-lite gates, Sybil filters, and proof-of-personhood checks.",
      tag: "API Key Required",
      slug: "onchain-activity-verifier",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function verifyOnchainActivity(walletAddress, requiredChains = ["eth-mainnet"]) {
  // Get wallet age + tx count on each required chain
  const summaries = await Promise.allSettled(
    requiredChains.map(chain =>
      client.TransactionService.getTransactionSummary(chain, walletAddress)
    )
  );

  // Get cross-chain footprint
  const activityResp = await client.BaseService.getMultiChainActivity(walletAddress);

  const profile = summaries.map((result, i) => {
    const chain = requiredChains[i];
    if (result.status !== "fulfilled" || result.value.error) {
      return { chain, txCount: 0, walletAgeDays: 0 };
    }
    const d = result.value.data.items?.[0];
    return {
      chain,
      txCount:       d?.total_count ?? 0,
      walletAgeDays: d?.earliest_transaction
        ? Math.floor((Date.now() - new Date(d.earliest_transaction.block_signed_at)) / 86400000)
        : 0,
    };
  });

  const activeChainCount = activityResp.error
    ? 0
    : activityResp.data.items.filter(c => c.is_wallet_active).length;

  return {
    walletAddress,
    chainProfiles:    profile,
    totalActiveChains: activeChainCount,
    isActive: profile.some(p => p.txCount > 5 && p.walletAgeDays > 30),
  };
}`,
        endpoints: ["TransactionService.getTransactionSummary", "BaseService.getMultiChainActivity"],
        chains: CHAINS_EVM,
        complexity: "intermediate",
        useCase: "Sybil-resistant airdrop gates, DAO membership verification, proof-of-human checks, anti-bot filtering",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "0.1 credits per chain",
        keyParams: [
          { name: "walletAddress", type: "string", description: "Wallet address to verify" },
          { name: "requiredChains", type: "string[]", description: "Chains to check activity on" },
        ],
        responseFields: ["chainProfiles[chain,txCount,walletAgeDays]","totalActiveChains","isActive"],
      }
    },
  ],

  security: [
    {
      title: "Token Approval Risk Scanner",
      body: "Scan all active ERC-20 and NFT approvals for a wallet and score each by risk level — identify dangerous unlimited approvals, deprecated protocols, and known exploited contracts.",
      tag: "API Key Required",
      slug: "token-approval-risk-scanner",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function scanApprovalRisks(chainName, walletAddress) {
  const resp = await client.SecurityService.getApprovals(chainName, walletAddress);
  if (resp.error) throw new Error(resp.error_message);

  const MAX_UINT256 = BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935");

  return resp.data.items.map(approval => {
    const isUnlimited = BigInt(approval.allowance || 0) >= MAX_UINT256 / 2n;
    const riskScore   = isUnlimited ? "HIGH" : "MEDIUM";

    return {
      tokenAddress:   approval.token_address,
      tokenSymbol:    approval.contract_ticker_symbol,
      spender:        approval.spender,
      spenderName:    approval.spender_name,
      allowanceRaw:   approval.allowance,
      isUnlimited,
      riskScore,
      lastUpdated:    approval.block_signed_at,
    };
  }).sort((a, b) => (b.riskScore === "HIGH" ? 1 : -1));
}`,
        endpoints: ["SecurityService.getApprovals"],
        chains: CHAINS_EVM,
        complexity: "beginner",
        useCase: "Wallet security audits, pre-trade approval checks, revoke dashboards, security scoring for DeFi",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "1 credit per call",
        keyParams: [
          { name: "chainName", type: "string", description: "EVM chain name" },
          { name: "walletAddress", type: "string", description: "Wallet address to scan" },
        ],
        responseFields: ["tokenSymbol","spender","spenderName","isUnlimited","riskScore","lastUpdated"],
      }
    },
    {
      title: "Transaction Decoded Receipt",
      body: "Fetch a fully decoded transaction receipt including internal transfers, decoded log events, ERC-20/NFT movements, and gas analytics — the core of any transaction detail page.",
      tag: "Free Tier",
      slug: "transaction-decoded-receipt",
      meta: {
        snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";

const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getDecodedReceipt(chainName, txHash) {
  const resp = await client.TransactionService.getTransaction(chainName, txHash);
  if (resp.error) throw new Error(resp.error_message);

  const tx = resp.data.items[0];

  return {
    txHash:          tx.tx_hash,
    status:          tx.successful ? "success" : "failed",
    block:           tx.block_height,
    timestamp:       tx.block_signed_at,
    from:            tx.from_address,
    to:              tx.to_address,
    valueETH:        tx.value,
    valueUSD:        tx.value_quote,
    gasUsed:         tx.gas_spent,
    gasPriceGwei:    Number(tx.gas_price) / 1e9,
    feePaidUSD:      tx.fees_paid,
    // Decoded log events (swaps, transfers, mints, etc.)
    events: (tx.log_events || []).map(ev => ({
      name:          ev.decoded?.name,
      contractName:  ev.sender_contract_ticker_symbol,
      contractAddr:  ev.sender_address,
      params:        ev.decoded?.params,
    })),
    // ERC-20 / NFT transfers within the tx
    transfers: (tx.log_events || [])
      .filter(ev => ev.decoded?.name === "Transfer")
      .map(ev => ({
        token:   ev.sender_contract_ticker_symbol,
        from:    ev.decoded?.params?.find(p => p.name === "from")?.value,
        to:      ev.decoded?.params?.find(p => p.name === "to")?.value,
        amount:  ev.decoded?.params?.find(p => p.name === "value" || p.name === "tokenId")?.value,
      })),
  };
}`,
        endpoints: ["TransactionService.getTransaction"],
        chains: CHAINS_EVM,
        complexity: "intermediate",
        useCase: "Transaction detail pages, block explorers, DeFi swap receipts, audit tools, smart contract debuggers",
        buildsWith: ["@covalenthq/client-sdk"],
        creditCost: "0.1 credits",
        keyParams: [
          { name: "chainName", type: "string", description: "EVM chain name" },
          { name: "txHash", type: "string", description: "Transaction hash (0x…)" },
        ],
        responseFields: ["status","block","timestamp","from","to","valueUSD","feePaidUSD","events","transfers"],
      }
    },
  ],

};

// ─── WRITE CATEGORY FILES & METADATA ─────────────────────────────────────────

let addedTotal = 0;

for (const [category, tools] of Object.entries(newTools)) {
  const catFile = path.join(TOOLS, `${category}.json`);
  const existing = JSON.parse(fs.readFileSync(catFile, "utf8"));

  const existingSlugs = new Set(existing.map(t => t.slug));

  for (const tool of tools) {
    if (existingSlugs.has(tool.slug)) {
      console.log(`  SKIP (exists): ${tool.slug}`);
      continue;
    }

    // Add to category file
    existing.push({
      title:        tool.title,
      body:         tool.body,
      tag:          tool.tag,
      url:          "https://goldrush.dev",
      "date-added": "2026-03-16",
      slug:         tool.slug,
    });

    // Write metadata file
    const metaPath = path.join(META, `${tool.slug}.json`);
    const metaObj = {
      slug:           tool.slug,
      title:          tool.title,
      description:    tool.body,
      tag:            tool.tag,
      url:            "https://goldrush.dev",
      "date-added":   "2026-03-16",
      category,
      ...tool.meta,
    };
    fs.writeFileSync(metaPath, JSON.stringify(metaObj, null, 2));
    addedTotal++;
    console.log(`  + ${tool.slug}`);
  }

  fs.writeFileSync(catFile, JSON.stringify(existing, null, 2));
  console.log(`✓ ${category}: now ${existing.length} tools`);
}

console.log(`\nAdded ${addedTotal} new tools total.`);

// ─── REBUILD tools.json & slug-map.json ──────────────────────────────────────

const GOLDRUSH_CATEGORIES = [
  { file: "wallet",     title: "Wallet",      category: "wallet"     },
  { file: "defi",       title: "DeFi",        category: "defi"       },
  { file: "nft",        title: "NFT",         category: "nft"        },
  { file: "analytics",  title: "Analytics",   category: "analytics"  },
  { file: "agents",     title: "AI Agents",   category: "agents"     },
  { file: "developer",  title: "Developer",   category: "developer"  },
  { file: "crosschain", title: "Cross-chain", category: "crosschain" },
  { file: "token",      title: "Tokens",      category: "token"      },
  { file: "identity",   title: "Identity",    category: "identity"   },
  { file: "security",   title: "Security",    category: "security"   },
];

const toolsJson = { tools: [] };
const slugMap   = {};
let totalTools  = 0;

GOLDRUSH_CATEGORIES.forEach(({ file, title, category }) => {
  const fp    = path.join(TOOLS, `${file}.json`);
  const items = JSON.parse(fs.readFileSync(fp, "utf8"));
  toolsJson.tools.push({ title, category, content: items });
  items.forEach(item => { slugMap[item.slug] = [category]; });
  totalTools += items.length;
  console.log(`  ${file.padEnd(12)} ${items.length} tools`);
});

fs.writeFileSync(path.join(BASE, "tools.json"),    JSON.stringify(toolsJson, null, 2));
fs.writeFileSync(path.join(BASE, "slug-map.json"), JSON.stringify(slugMap, null, 2));

console.log(`\n✓ tools.json rebuilt — ${totalTools} total tools`);
console.log(`✓ slug-map.json rebuilt — ${Object.keys(slugMap).length} slugs`);
console.log("\nDone!");
