const fs = require("fs");
const path = require("path");
const META = path.join(__dirname, "..", "src", "data", "tool-metadata");

const EVM = ["eth-mainnet","base-mainnet","matic-mainnet","arbitrum-mainnet","optimism-mainnet","bsc-mainnet","avalanche-mainnet","linea-mainnet","scroll-mainnet","zksync-mainnet","blast-mainnet","fantom-mainnet","gnosis-mainnet"];
const CORE = ["eth-mainnet","base-mainnet","matic-mainnet","arbitrum-mainnet"];

const enrichments = {
  "stablecoin-dominance-tracker": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

const STABLECOINS = {
  "eth-mainnet": [
    "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
    "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
  ],
};

async function trackStablecoinDominance(chainName) {
  const addresses = (STABLECOINS[chainName] || []).join(",");
  const resp = await client.PricingService.getTokenPrices(chainName, "USD", addresses);
  if (resp.error) throw new Error(resp.error_message);
  return resp.data.map(t => ({
    symbol:      t.contract_ticker_symbol,
    address:     t.contract_address,
    price:       t.prices?.[0]?.price,
    marketCap:   t.market_cap,
    totalSupply: t.total_supply,
  }));
}`,
    endpoints: ["PricingService.getTokenPrices", "BalanceService.getTokenHoldersV2ForTokenAddress"],
    chains: EVM,
    complexity: "intermediate",
    useCase: "DeFi macro dashboards, stablecoin risk monitors, peg deviation alerts, cross-chain liquidity tracking",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per token",
    keyParams: [{ name: "chainName", type: "string", description: "EVM chain name" }],
    responseFields: ["symbol","price","marketCap","totalSupply"],
  },

  "onchain-credit-score": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function calcCreditScore(walletAddress) {
  const chain = "eth-mainnet";
  const [summaryResp, balanceResp, activityResp] = await Promise.all([
    client.TransactionService.getTransactionSummary(chain, walletAddress),
    client.BalanceService.getTokenBalancesForWalletAddress(chain, walletAddress),
    client.BaseService.getMultiChainActivity(walletAddress),
  ]);

  const summary = summaryResp.data?.items?.[0];
  const balances = balanceResp.data?.items ?? [];
  const activeChains = activityResp.data?.items?.filter(c => c.is_wallet_active).length ?? 0;

  const ageDays = summary?.earliest_transaction
    ? Math.floor((Date.now() - new Date(summary.earliest_transaction.block_signed_at)) / 86400000)
    : 0;
  const txCount   = summary?.total_count ?? 0;
  const netWorth  = balances.reduce((s, t) => s + (t.quote ?? 0), 0);

  // Simple scoring: 0-100
  const score = Math.min(100, Math.round(
    (Math.min(ageDays, 365) / 365) * 35 +
    (Math.min(txCount, 500) / 500) * 35 +
    (Math.min(netWorth, 10000) / 10000) * 20 +
    (Math.min(activeChains, 5) / 5) * 10
  ));
  return { walletAddress, score, ageDays, txCount, netWorthUSD: netWorth, activeChains };
}`,
    endpoints: ["TransactionService.getTransactionSummary", "BalanceService.getTokenBalancesForWalletAddress", "BaseService.getMultiChainActivity"],
    chains: EVM,
    complexity: "intermediate",
    useCase: "DeFi lending eligibility, undercollateralised loan screening, airdrop tiering, reputation-based access control",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "3 credits per wallet",
    keyParams: [{ name: "walletAddress", type: "string", description: "EVM wallet address" }],
    responseFields: ["score","ageDays","txCount","netWorthUSD","activeChains"],
  },

  "developer-wallet-classifier": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function classifyWallet(walletAddress, chainName = "eth-mainnet") {
  const [txResp, balResp] = await Promise.all([
    client.TransactionService.getTransactionSummary(chainName, walletAddress),
    client.BalanceService.getTokenBalancesForWalletAddress(chainName, walletAddress),
  ]);
  const summary  = txResp.data?.items?.[0];
  const tokens   = balResp.data?.items ?? [];
  const txCount  = summary?.total_count ?? 0;
  const ageDays  = summary?.earliest_transaction
    ? Math.floor((Date.now() - new Date(summary.earliest_transaction.block_signed_at)) / 86400000) : 0;

  // Heuristics
  const hasNative   = tokens.some(t => t.native_token);
  const tokenCount  = tokens.filter(t => !t.native_token && !t.is_spam).length;
  let type = "retail";
  if (txCount > 1000 && ageDays > 365) type = "power-user";
  if (txCount > 200  && tokenCount < 5)  type = "developer";
  if (txCount < 10)                       type = "fresh";

  return { walletAddress, type, txCount, ageDays, tokenCount };
}`,
    endpoints: ["TransactionService.getTransactionSummary", "BalanceService.getTokenBalancesForWalletAddress"],
    chains: EVM,
    complexity: "intermediate",
    useCase: "Developer segmentation, targeted onboarding, grant eligibility, hackathon participant screening",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "2 credits per wallet",
    keyParams: [{ name: "walletAddress", type: "string", description: "Wallet to classify" }],
    responseFields: ["type","txCount","ageDays","tokenCount"],
  },

  "dao-voter-intelligence": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Governor Bravo VoteCast topic: keccak256("VoteCast(address,uint256,uint8,uint256,string)")
const VOTE_CAST_TOPIC = "0xb8e138887d0aa13bab447e82de9d5c1777041ecd21ca36ba824ff1e6c07ddda4";

async function getDaoVoterIntelligence(chainName, governorAddress) {
  const resp = await client.BaseService.getLogs(chainName, {
    address:   governorAddress,
    topicHash: VOTE_CAST_TOPIC,
    pageSize:  1000,
  });
  if (resp.error) throw new Error(resp.error_message);

  const votes = resp.data.items.map(log => ({
    voter:     log.decoded?.params?.find(p => p.name === "voter")?.value,
    proposalId: log.decoded?.params?.find(p => p.name === "proposalId")?.value,
    support:   log.decoded?.params?.find(p => p.name === "support")?.value, // 0=against,1=for,2=abstain
    weight:    log.decoded?.params?.find(p => p.name === "weight")?.value,
    timestamp: log.block_signed_at,
  }));

  // Aggregate by voter
  const voterMap = {};
  for (const v of votes) {
    if (!v.voter) continue;
    voterMap[v.voter] = voterMap[v.voter] || { votes: 0, totalWeight: 0n };
    voterMap[v.voter].votes++;
    voterMap[v.voter].totalWeight += BigInt(v.weight || 0);
  }
  return { governorAddress, totalVotes: votes.length, voters: Object.entries(voterMap)
    .map(([addr, d]) => ({ address: addr, voteCount: d.votes, totalWeight: d.totalWeight.toString() }))
    .sort((a, b) => b.voteCount - a.voteCount) };
}`,
    endpoints: ["BaseService.getLogs"],
    chains: CORE,
    complexity: "advanced",
    useCase: "DAO governance analytics, delegate leaderboards, voter participation dashboards, governance health reports",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [
      { name: "chainName", type: "string", description: "EVM chain name" },
      { name: "governorAddress", type: "string", description: "Governor contract address" },
    ],
    responseFields: ["totalVotes","voters[address,voteCount,totalWeight]"],
  },

  "defi-bad-debt-monitor": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Aave V3 LiquidationCall topic
const LIQUIDATION_TOPIC = "0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286";

async function monitorBadDebt(chainName, lendingPoolAddress) {
  const resp = await client.BaseService.getLogs(chainName, {
    address:   lendingPoolAddress,
    topicHash: LIQUIDATION_TOPIC,
    pageSize:  500,
  });
  if (resp.error) throw new Error(resp.error_message);

  return resp.data.items.map(log => ({
    txHash:       log.tx_hash,
    timestamp:    log.block_signed_at,
    collateralAsset: log.decoded?.params?.find(p => p.name === "collateralAsset")?.value,
    debtAsset:       log.decoded?.params?.find(p => p.name === "debtAsset")?.value,
    user:            log.decoded?.params?.find(p => p.name === "user")?.value,
    debtToCover:     log.decoded?.params?.find(p => p.name === "debtToCover")?.value,
    liquidatedCollateral: log.decoded?.params?.find(p => p.name === "liquidatedCollateralAmount")?.value,
  }));
}`,
    endpoints: ["BaseService.getLogs"],
    chains: EVM,
    complexity: "advanced",
    useCase: "DeFi protocol risk monitoring, lending protocol health dashboards, liquidation alert systems",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [
      { name: "chainName", type: "string", description: "EVM chain name" },
      { name: "lendingPoolAddress", type: "string", description: "Aave/Compound pool contract" },
    ],
    responseFields: ["txHash","timestamp","collateralAsset","debtAsset","user","debtToCover"],
  },

  "cross-chain-liquidity-map": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getLiquidityMap(walletAddress) {
  const actResp = await client.BaseService.getMultiChainActivity(walletAddress);
  if (actResp.error) throw new Error(actResp.error_message);
  const chains = actResp.data.items.filter(c => c.is_wallet_active).map(c => c.name);

  const results = await Promise.allSettled(
    chains.map(chain => client.BalanceService.getTokenBalancesForWalletAddress(chain, walletAddress))
  );
  return chains.map((chain, i) => {
    if (results[i].status !== "fulfilled" || results[i].value.error) return { chain, liquidityUSD: 0 };
    const items = results[i].value.data?.items ?? [];
    return { chain, liquidityUSD: items.reduce((s, t) => s + (t.quote ?? 0), 0), tokenCount: items.length };
  }).sort((a, b) => b.liquidityUSD - a.liquidityUSD);
}`,
    endpoints: ["BaseService.getMultiChainActivity", "BalanceService.getTokenBalancesForWalletAddress"],
    chains: EVM,
    complexity: "intermediate",
    useCase: "Cross-chain treasury management, bridge routing optimisation, multi-chain portfolio rebalancing",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per chain",
    keyParams: [{ name: "walletAddress", type: "string", description: "Wallet address" }],
    responseFields: ["chain","liquidityUSD","tokenCount"],
  },

  "rwa-real-estate-portfolio": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// RWA real-estate tokens (e.g. RealT, Lofty) are ERC-20 tokens
async function getRWARealEstatePortfolio(walletAddress, chainName = "eth-mainnet") {
  const resp = await client.BalanceService.getTokenBalancesForWalletAddress(chainName, walletAddress);
  if (resp.error) throw new Error(resp.error_message);

  // Filter by known RWA prefixes / known contract addresses
  const rwaTokens = (resp.data?.items ?? []).filter(t =>
    t.contract_name?.toLowerCase().includes("realt") ||
    t.contract_ticker_symbol?.startsWith("REALTOKEN")
  );
  return rwaTokens.map(t => ({
    tokenName:    t.contract_name,
    symbol:       t.contract_ticker_symbol,
    balance:      t.balance,
    valueUSD:     t.quote,
    contractAddr: t.contract_address,
  }));
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress"],
    chains: CORE,
    complexity: "intermediate",
    useCase: "RWA portfolio trackers, tokenised real-estate dashboards, institutional asset management, DeFi collateral views",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per chain",
    keyParams: [{ name: "walletAddress", type: "string", description: "Investor wallet address" }],
    responseFields: ["tokenName","symbol","balance","valueUSD","contractAddr"],
  },

  "rwa-tokenized-treasury-tracker": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Known tokenised treasury addresses (e.g. BUIDL, OUSG, USDY)
const TREASURY_TOKENS = {
  "eth-mainnet": [
    "0x7712c34205737192402172409a8F7ccef8aA2AEc", // BUIDL (BlackRock)
    "0x1b19c19393e2d034d8ff31ff34c81252fcbbee92", // OUSG (Ondo)
  ],
};

async function getTreasuryTokenHolders(chainName) {
  const addresses = (TREASURY_TOKENS[chainName] || []).join(",");
  if (!addresses) return [];
  const resp = await client.PricingService.getTokenPrices(chainName, "USD", addresses);
  if (resp.error) throw new Error(resp.error_message);
  return resp.data.map(t => ({
    name:        t.contract_name,
    symbol:      t.contract_ticker_symbol,
    price:       t.prices?.[0]?.price,
    marketCap:   t.market_cap,
    totalSupply: t.total_supply,
  }));
}`,
    endpoints: ["PricingService.getTokenPrices", "BalanceService.getTokenHoldersV2ForTokenAddress"],
    chains: CORE,
    complexity: "intermediate",
    useCase: "Tokenised treasury monitoring, institutional DeFi dashboards, RWA yield tracking, compliance reporting",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per token",
    keyParams: [{ name: "chainName", type: "string", description: "Chain name" }],
    responseFields: ["name","symbol","price","marketCap","totalSupply"],
  },

  "nft-liquidity-scorer": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function scoreNftLiquidity(chainName, contractAddress, tokenId) {
  const [metaResp, txResp] = await Promise.all([
    client.NftService.getNftMetadataForGivenTokenIdForContract(chainName, contractAddress, tokenId),
    client.NftService.getNftTransactionsForContractTokenId(chainName, contractAddress, tokenId),
  ]);
  const meta = metaResp.data?.items?.[0];
  const sales = (txResp.data?.items ?? []).filter(tx => tx.nft_transactions?.[0]?.value_quote > 0);

  const avgSalePrice = sales.length
    ? sales.reduce((s, t) => s + (t.nft_transactions?.[0]?.value_quote ?? 0), 0) / sales.length : 0;
  const daysSinceLastSale = sales[0]
    ? Math.floor((Date.now() - new Date(sales[0].block_signed_at)) / 86400000) : 999;

  // Liquidity score: 0-100
  const score = Math.min(100, Math.round(
    (Math.min(sales.length, 20) / 20) * 60 + (Math.max(0, 180 - daysSinceLastSale) / 180) * 40
  ));
  return { tokenId, contractAddress, saleCount: sales.length, avgSalePriceUSD: avgSalePrice, daysSinceLastSale, liquidityScore: score };
}`,
    endpoints: ["NftService.getNftMetadataForGivenTokenIdForContract", "NftService.getNftTransactionsForContractTokenId"],
    chains: CORE,
    complexity: "intermediate",
    useCase: "NFT lending protocols, NFT collateral scoring, marketplace floor price validation, liquidity-weighted rarity",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "2 credits per token",
    keyParams: [
      { name: "chainName", type: "string", description: "EVM chain name" },
      { name: "contractAddress", type: "string", description: "NFT contract address" },
      { name: "tokenId", type: "string", description: "Token ID" },
    ],
    responseFields: ["saleCount","avgSalePriceUSD","daysSinceLastSale","liquidityScore"],
  },

  "nft-royalty-tracking": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// ERC-2981 royalty payments often emitted as Transfer events to creator wallet
async function trackNftRoyalties(chainName, contractAddress, creatorAddress) {
  const resp = await client.BalanceService.getErc20TransfersForWalletAddress(
    chainName, creatorAddress
  );
  if (resp.error) throw new Error(resp.error_message);
  // Filter incoming transfers that look like royalty payments
  const royalties = (resp.data?.items ?? []).filter(tx =>
    tx.transfers?.some(t => t.transfer_type === "IN")
  );
  return royalties.map(tx => ({
    txHash:    tx.tx_hash,
    timestamp: tx.block_signed_at,
    amount:    tx.transfers?.[0]?.delta,
    amountUSD: tx.transfers?.[0]?.delta_quote,
    token:     tx.transfers?.[0]?.contract_ticker_symbol,
  }));
}`,
    endpoints: ["BalanceService.getErc20TransfersForWalletAddress", "NftService.getNftTransactionsForContractTokenId"],
    chains: CORE,
    complexity: "intermediate",
    useCase: "NFT creator royalty dashboards, on-chain creator economy analytics, royalty enforcement monitoring",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [
      { name: "chainName", type: "string", description: "EVM chain name" },
      { name: "creatorAddress", type: "string", description: "Creator wallet to track royalties for" },
    ],
    responseFields: ["txHash","timestamp","amountUSD","token"],
  },

  "nft-wash-trading-detector": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function detectWashTrading(chainName, contractAddress, tokenId) {
  const resp = await client.NftService.getNftTransactionsForContractTokenId(
    chainName, contractAddress, tokenId
  );
  if (resp.error) throw new Error(resp.error_message);

  const txs = resp.data?.items ?? [];
  const addressPairs = new Map();
  for (let i = 0; i < txs.length - 1; i++) {
    const from = txs[i].nft_transactions?.[0]?.from_address;
    const to   = txs[i].nft_transactions?.[0]?.to_address;
    if (!from || !to) continue;
    const key = [from, to].sort().join("-");
    addressPairs.set(key, (addressPairs.get(key) || 0) + 1);
  }
  const suspicious = [...addressPairs.entries()].filter(([, count]) => count > 1);
  return {
    tokenId, totalTransfers: txs.length,
    washTradingScore: suspicious.length > 0 ? "HIGH" : "LOW",
    suspiciousPairs: suspicious.map(([pair, count]) => ({ pair, count })),
  };
}`,
    endpoints: ["NftService.getNftTransactionsForContractTokenId"],
    chains: CORE,
    complexity: "advanced",
    useCase: "NFT marketplace integrity, wash trading alerts, collection authenticity scoring, SEC compliance tools",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit",
    keyParams: [
      { name: "chainName", type: "string", description: "EVM chain name" },
      { name: "contractAddress", type: "string", description: "NFT collection contract" },
      { name: "tokenId", type: "string", description: "Token ID to analyse" },
    ],
    responseFields: ["washTradingScore","suspiciousPairs","totalTransfers"],
  },

  "onchain-social-graph": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function buildSocialGraph(walletAddress, chainName = "eth-mainnet", depth = 1) {
  const nodes = new Set([walletAddress]);
  const edges = [];

  async function fetchConnections(address) {
    const resp = await client.TransactionService.getTransactionsForAddressV3(
      chainName, address, { pageSize: 50 }
    );
    if (resp.error) return;
    for (const tx of resp.data?.items ?? []) {
      const other = tx.from_address === address ? tx.to_address : tx.from_address;
      if (other && other !== address) {
        edges.push({ from: address, to: other, txHash: tx.tx_hash, valueUSD: tx.value_quote });
        nodes.add(other);
      }
    }
  }

  await fetchConnections(walletAddress);
  if (depth > 1) {
    await Promise.allSettled([...nodes].filter(n => n !== walletAddress).slice(0, 10).map(fetchConnections));
  }
  return { rootAddress: walletAddress, nodes: [...nodes], edges };
}`,
    endpoints: ["TransactionService.getTransactionsForAddressV3"],
    chains: EVM,
    complexity: "advanced",
    useCase: "On-chain social graphs, wallet clustering, influence mapping, DAO community analysis, fraud network detection",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page per address",
    keyParams: [
      { name: "walletAddress", type: "string", description: "Root wallet address" },
      { name: "depth", type: "number", description: "Graph traversal depth (1 or 2)" },
    ],
    responseFields: ["nodes","edges[from,to,txHash,valueUSD]"],
  },

  "sybil-resistance-scorer": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function scoreSybilResistance(walletAddress) {
  const chain = "eth-mainnet";
  const [summaryResp, activityResp, balResp] = await Promise.all([
    client.TransactionService.getTransactionSummary(chain, walletAddress),
    client.BaseService.getMultiChainActivity(walletAddress),
    client.BalanceService.getTokenBalancesForWalletAddress(chain, walletAddress),
  ]);

  const s = summaryResp.data?.items?.[0];
  const ageDays     = s?.earliest_transaction ? Math.floor((Date.now() - new Date(s.earliest_transaction.block_signed_at)) / 86400000) : 0;
  const txCount     = s?.total_count ?? 0;
  const chainCount  = activityResp.data?.items?.filter(c => c.is_wallet_active).length ?? 0;
  const tokenCount  = balResp.data?.items?.filter(t => !t.is_spam).length ?? 0;
  const netWorth    = balResp.data?.items?.reduce((s, t) => s + (t.quote ?? 0), 0) ?? 0;

  const score = Math.round(
    (Math.min(ageDays, 730) / 730) * 30 +
    (Math.min(txCount, 200) / 200) * 25 +
    (Math.min(chainCount, 5) / 5) * 20 +
    (Math.min(tokenCount, 20) / 20) * 15 +
    (Math.min(netWorth, 1000) / 1000) * 10
  );
  return { walletAddress, sybilScore: score, ageDays, txCount, chainCount, tokenCount, netWorthUSD: netWorth };
}`,
    endpoints: ["TransactionService.getTransactionSummary", "BaseService.getMultiChainActivity", "BalanceService.getTokenBalancesForWalletAddress"],
    chains: EVM,
    complexity: "intermediate",
    useCase: "Airdrop Sybil filtering, DAO member verification, grant distribution, quadratic voting eligibility",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "3 credits per wallet",
    keyParams: [{ name: "walletAddress", type: "string", description: "Wallet to score" }],
    responseFields: ["sybilScore","ageDays","txCount","chainCount","netWorthUSD"],
  },

  "reputation-score-aggregator": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function aggregateReputation(walletAddress, chainName = "eth-mainnet") {
  const [summaryResp, nftResp, approvalResp] = await Promise.all([
    client.TransactionService.getTransactionSummary(chainName, walletAddress),
    client.NftService.getNftsForAddress(chainName, walletAddress),
    client.SecurityService.getApprovals(chainName, walletAddress),
  ]);

  const s          = summaryResp.data?.items?.[0];
  const nftCount   = nftResp.data?.items?.length ?? 0;
  const approvalsCount = approvalResp.data?.items?.length ?? 0;
  const ageDays    = s?.earliest_transaction ? Math.floor((Date.now() - new Date(s.earliest_transaction.block_signed_at)) / 86400000) : 0;

  return {
    walletAddress,
    reputationSignals: {
      walletAgeDays:   ageDays,
      totalTxCount:    s?.total_count ?? 0,
      nftsOwned:       nftCount,
      activeApprovals: approvalsCount,
    },
    reputationTier: ageDays > 365 && (s?.total_count ?? 0) > 100 ? "Established" :
                    ageDays > 90  && (s?.total_count ?? 0) > 10  ? "Active" : "New",
  };
}`,
    endpoints: ["TransactionService.getTransactionSummary", "NftService.getNftsForAddress", "SecurityService.getApprovals"],
    chains: CORE,
    complexity: "intermediate",
    useCase: "Unified reputation profiles, DeFi trust scores, NFT platform verification, peer-to-peer trust layers",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "3 credits per wallet",
    keyParams: [{ name: "walletAddress", type: "string", description: "Wallet to score" }],
    responseFields: ["reputationSignals","reputationTier"],
  },

  "token-exchange-flow-tracker": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Track token flows in/out of a centralised exchange wallet
async function trackExchangeFlows(chainName, exchangeAddress, tokenAddress) {
  const resp = await client.BalanceService.getErc20TransfersForWalletAddress(
    chainName, exchangeAddress, { contractAddress: tokenAddress }
  );
  if (resp.error) throw new Error(resp.error_message);

  let netflow = 0;
  const flows = (resp.data?.items ?? []).map(tx => {
    const transfer = tx.transfers?.[0];
    const isInflow = transfer?.transfer_type === "IN";
    const amount   = Number(transfer?.delta_quote ?? 0);
    netflow += isInflow ? amount : -amount;
    return { txHash: tx.tx_hash, timestamp: tx.block_signed_at, direction: isInflow ? "IN" : "OUT", amountUSD: amount };
  });
  return { exchangeAddress, tokenAddress, netflowUSD: netflow, transactions: flows };
}`,
    endpoints: ["BalanceService.getErc20TransfersForWalletAddress"],
    chains: EVM,
    complexity: "intermediate",
    useCase: "CEX flow monitoring, exchange reserve tracking, whale alert systems, on-chain order flow analysis",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [
      { name: "chainName", type: "string", description: "EVM chain name" },
      { name: "exchangeAddress", type: "string", description: "Exchange hot wallet address" },
      { name: "tokenAddress", type: "string", description: "Token contract to track" },
    ],
    responseFields: ["netflowUSD","transactions[direction,amountUSD,timestamp]"],
  },

  "token-fee-revenue-correlation": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Uniswap V3 Collect event (fee collection): topic hash
const COLLECT_TOPIC = "0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0";

async function getFeeRevenueCorrelation(chainName, poolAddress, tokenAddress) {
  const [feeResp, priceResp] = await Promise.all([
    client.BaseService.getLogs(chainName, { address: poolAddress, topicHash: COLLECT_TOPIC, pageSize: 200 }),
    client.PricingService.getTokenPrices(chainName, "USD", tokenAddress),
  ]);

  const fees = (feeResp.data?.items ?? []).map(log => ({
    timestamp: log.block_signed_at,
    amount0:   log.decoded?.params?.find(p => p.name === "amount0")?.value,
    amount1:   log.decoded?.params?.find(p => p.name === "amount1")?.value,
  }));
  const priceHistory = priceResp.data?.[0]?.prices ?? [];
  return { poolAddress, feesCollected: fees, tokenPriceHistory: priceHistory };
}`,
    endpoints: ["BaseService.getLogs", "PricingService.getTokenPrices"],
    chains: CORE,
    complexity: "advanced",
    useCase: "Protocol revenue analytics, LP fee yield calculation, token price vs fee revenue correlation studies",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "2 credits",
    keyParams: [
      { name: "chainName", type: "string", description: "EVM chain name" },
      { name: "poolAddress", type: "string", description: "Uniswap V3 pool address" },
    ],
    responseFields: ["feesCollected","tokenPriceHistory"],
  },

  "token-memecoin-risk-scorer": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function scoreMemeRisk(chainName, tokenAddress) {
  const [priceResp, holdersResp] = await Promise.all([
    client.PricingService.getTokenPrices(chainName, "USD", tokenAddress),
    client.BalanceService.getTokenHoldersV2ForTokenAddress(chainName, tokenAddress, { pageSize: 100 }),
  ]);

  const token   = priceResp.data?.[0];
  const holders = holdersResp.data?.items ?? [];

  const top10pct = holders.slice(0, 10).reduce((s, h) => s + (h.percent_of_supply_held ?? 0), 0);
  const holderCount = holdersResp.data?.pagination?.total_count ?? holders.length;

  let riskScore = 0;
  if (top10pct > 50)     riskScore += 40; // top 10 wallets own >50%
  if (holderCount < 500) riskScore += 30; // low distribution
  if (!token?.logo_url)  riskScore += 10; // no logo = unverified
  if ((token?.market_cap ?? 0) < 100000) riskScore += 20; // micro cap

  return { tokenAddress, riskScore: Math.min(100, riskScore), top10HoldersPercent: top10pct, holderCount, marketCapUSD: token?.market_cap };
}`,
    endpoints: ["PricingService.getTokenPrices", "BalanceService.getTokenHoldersV2ForTokenAddress"],
    chains: EVM,
    complexity: "intermediate",
    useCase: "Memecoin risk alerts, token screeners, DeFi safety tools, pre-swap risk checks",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "2 credits",
    keyParams: [
      { name: "chainName", type: "string", description: "EVM chain name" },
      { name: "tokenAddress", type: "string", description: "Token contract address" },
    ],
    responseFields: ["riskScore","top10HoldersPercent","holderCount","marketCapUSD"],
  },

  "bridge-security-monitor": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function monitorBridgeSecurity(chainName, bridgeAddress) {
  const [balResp, txResp] = await Promise.all([
    client.BalanceService.getTokenBalancesForWalletAddress(chainName, bridgeAddress),
    client.TransactionService.getTransactionsForAddressV3(chainName, bridgeAddress, { pageSize: 50 }),
  ]);

  const tvl = (balResp.data?.items ?? []).reduce((s, t) => s + (t.quote ?? 0), 0);
  const recentTxs = txResp.data?.items ?? [];
  const largeWithdrawals = recentTxs.filter(tx => (tx.value_quote ?? 0) > tvl * 0.05); // >5% TVL

  return {
    bridgeAddress, chainName, tvlUSD: tvl,
    recentTxCount: recentTxs.length,
    largeWithdrawalAlerts: largeWithdrawals.map(tx => ({
      txHash:    tx.tx_hash,
      timestamp: tx.block_signed_at,
      valueUSD:  tx.value_quote,
      pctOfTVL:  ((tx.value_quote ?? 0) / tvl * 100).toFixed(2),
    })),
  };
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress", "TransactionService.getTransactionsForAddressV3"],
    chains: EVM,
    complexity: "advanced",
    useCase: "Bridge TVL monitoring, large withdrawal alerts, cross-chain exploit detection, DeFi security dashboards",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "2 credits",
    keyParams: [
      { name: "chainName", type: "string", description: "EVM chain name" },
      { name: "bridgeAddress", type: "string", description: "Bridge contract or hot wallet address" },
    ],
    responseFields: ["tvlUSD","largeWithdrawalAlerts","recentTxCount"],
  },

  "compliance-transaction-screening": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// OFAC-like screening: check if a wallet interacted with known flagged addresses
const FLAGGED_ADDRESSES = new Set([
  "0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b", // Tornado Cash Router (example)
  "0x8576acc5c05d6ce88f4e49bf65bdf0c62f91353c",
]);

async function screenWalletCompliance(chainName, walletAddress) {
  const resp = await client.TransactionService.getTransactionsForAddressV3(
    chainName, walletAddress, { pageSize: 200 }
  );
  if (resp.error) throw new Error(resp.error_message);

  const interactions = (resp.data?.items ?? []).filter(tx =>
    FLAGGED_ADDRESSES.has(tx.to_address?.toLowerCase()) ||
    FLAGGED_ADDRESSES.has(tx.from_address?.toLowerCase())
  );
  return {
    walletAddress,
    riskLevel:     interactions.length > 0 ? "FLAGGED" : "CLEAR",
    flaggedInteractions: interactions.map(tx => ({
      txHash:       tx.tx_hash,
      timestamp:    tx.block_signed_at,
      counterparty: FLAGGED_ADDRESSES.has(tx.to_address?.toLowerCase()) ? tx.to_address : tx.from_address,
    })),
  };
}`,
    endpoints: ["TransactionService.getTransactionsForAddressV3"],
    chains: EVM,
    complexity: "advanced",
    useCase: "AML/KYC compliance screening, VASP transaction monitoring, CEX onboarding checks, institutional DeFi compliance",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [
      { name: "chainName", type: "string", description: "EVM chain name" },
      { name: "walletAddress", type: "string", description: "Wallet to screen" },
    ],
    responseFields: ["riskLevel","flaggedInteractions[txHash,timestamp,counterparty]"],
  },

  "exploit-early-warning-system": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function detectExploitSignals(chainName, contractAddress) {
  const resp = await client.TransactionService.getTransactionsForAddressV3(
    chainName, contractAddress, { pageSize: 100 }
  );
  if (resp.error) throw new Error(resp.error_message);

  const txs = resp.data?.items ?? [];
  const now  = Date.now();
  const last1h = txs.filter(tx => (now - new Date(tx.block_signed_at).getTime()) < 3600000);

  // Signals: unusually high tx volume or value in last hour
  const hourlyVolume = last1h.reduce((s, t) => s + (t.value_quote ?? 0), 0);
  const baselineAvg  = txs.length ? txs.reduce((s, t) => s + (t.value_quote ?? 0), 0) / txs.length : 0;
  const anomaly      = baselineAvg > 0 && hourlyVolume > baselineAvg * txs.length * 0.5;

  return {
    contractAddress, chainName,
    last1hTxCount:    last1h.length,
    last1hVolumeUSD:  hourlyVolume,
    anomalyDetected:  anomaly,
    riskSignal:       anomaly ? "HIGH — unusual volume spike" : "NORMAL",
  };
}`,
    endpoints: ["TransactionService.getTransactionsForAddressV3", "BaseService.getLogs"],
    chains: EVM,
    complexity: "advanced",
    useCase: "Real-time exploit detection, protocol security monitoring, DeFi insurance triggers, guardian bots",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [
      { name: "chainName", type: "string", description: "EVM chain name" },
      { name: "contractAddress", type: "string", description: "Protocol contract to monitor" },
    ],
    responseFields: ["last1hTxCount","last1hVolumeUSD","anomalyDetected","riskSignal"],
  },

  "mev-exposure-analyzer": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function analyzeMevExposure(chainName, walletAddress) {
  const resp = await client.TransactionService.getTransactionsForAddressV3(
    chainName, walletAddress, { pageSize: 100 }
  );
  if (resp.error) throw new Error(resp.error_message);

  const txs = resp.data?.items ?? [];
  // MEV heuristic: failed txs (often sandwich victims) + high gas premium
  const failedTxs   = txs.filter(tx => !tx.successful);
  const highGasTxs  = txs.filter(tx => tx.gas_price > 50e9); // >50 gwei
  const mevRisk     = failedTxs.length > txs.length * 0.1 ? "HIGH" : "LOW";

  return {
    walletAddress, totalTxsAnalyzed: txs.length,
    failedTxCount: failedTxs.length,
    highGasTxCount: highGasTxs.length,
    mevExposureRisk: mevRisk,
    estimatedMevCostUSD: failedTxs.reduce((s, t) => s + (t.fees_paid ?? 0), 0),
  };
}`,
    endpoints: ["TransactionService.getTransactionsForAddressV3"],
    chains: CORE,
    complexity: "advanced",
    useCase: "MEV protection tools, gas optimisation, sandwich attack detection, DEX routing intelligence",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [{ name: "walletAddress", type: "string", description: "Wallet to analyse for MEV exposure" }],
    responseFields: ["failedTxCount","highGasTxCount","mevExposureRisk","estimatedMevCostUSD"],
  },

  "oracle-manipulation-detector": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Chainlink AnswerUpdated topic
const ANSWER_UPDATED = "0x0559884fd3a460db3073b7fc896cc77986f16e378210ded43186175bf646fc5f";

async function detectOracleManipulation(chainName, oracleAddress) {
  const resp = await client.BaseService.getLogs(chainName, {
    address: oracleAddress, topicHash: ANSWER_UPDATED, pageSize: 500
  });
  if (resp.error) throw new Error(resp.error_message);

  const updates = resp.data.items.map(log => ({
    timestamp: log.block_signed_at,
    answer:    log.decoded?.params?.find(p => p.name === "current")?.value,
    roundId:   log.decoded?.params?.find(p => p.name === "roundId")?.value,
  }));

  // Flag rounds with >10% price change between consecutive updates
  const anomalies = updates.filter((u, i) => {
    if (i === 0 || !u.answer || !updates[i-1].answer) return false;
    const pct = Math.abs(Number(u.answer) - Number(updates[i-1].answer)) / Math.abs(Number(updates[i-1].answer));
    return pct > 0.1;
  });
  return { oracleAddress, totalUpdates: updates.length, anomalies };
}`,
    endpoints: ["BaseService.getLogs"],
    chains: CORE,
    complexity: "advanced",
    useCase: "Oracle manipulation detection, DeFi protocol risk monitoring, price feed anomaly alerts",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [
      { name: "chainName", type: "string", description: "EVM chain name" },
      { name: "oracleAddress", type: "string", description: "Chainlink aggregator contract address" },
    ],
    responseFields: ["totalUpdates","anomalies[timestamp,answer,roundId]"],
  },

  "rugpull-pattern-detector": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function detectRugPull(chainName, tokenAddress) {
  const [priceResp, holdersResp] = await Promise.all([
    client.PricingService.getTokenPrices(chainName, "USD", tokenAddress, { from: "2024-01-01" }),
    client.BalanceService.getTokenHoldersV2ForTokenAddress(chainName, tokenAddress, { pageSize: 20 }),
  ]);

  const prices  = priceResp.data?.[0]?.prices ?? [];
  const holders = holdersResp.data?.items ?? [];

  // Signals: top holder concentration + price crash
  const top1pct = holders[0]?.percent_of_supply_held ?? 0;
  const priceNow  = prices[prices.length - 1]?.price ?? 0;
  const priceMax  = Math.max(...prices.map(p => p.price ?? 0));
  const drawdown  = priceMax > 0 ? ((priceMax - priceNow) / priceMax) * 100 : 0;

  return {
    tokenAddress,
    rugRisk: top1pct > 30 && drawdown > 80 ? "VERY HIGH" : drawdown > 60 ? "HIGH" : "LOW",
    top1HolderPercent: top1pct,
    maxDrawdownPercent: drawdown.toFixed(1),
    currentPriceUSD: priceNow,
  };
}`,
    endpoints: ["PricingService.getTokenPrices", "BalanceService.getTokenHoldersV2ForTokenAddress"],
    chains: EVM,
    complexity: "intermediate",
    useCase: "Token screeners, rug pull alert bots, DeFi safety tools, pre-investment due diligence",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "2 credits",
    keyParams: [{ name: "tokenAddress", type: "string", description: "Token contract to analyse" }],
    responseFields: ["rugRisk","top1HolderPercent","maxDrawdownPercent","currentPriceUSD"],
  },

  "smart-contract-interaction-risk": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function assessContractRisk(chainName, walletAddress, contractAddress) {
  const [approvalResp, txResp] = await Promise.all([
    client.SecurityService.getApprovals(chainName, walletAddress),
    client.TransactionService.getTransactionsForAddressV3(chainName, walletAddress, { pageSize: 100 }),
  ]);

  const MAX_UINT = BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935");
  const approvals = (approvalResp.data?.items ?? []).filter(a => a.spender?.toLowerCase() === contractAddress.toLowerCase());
  const txsToContract = (txResp.data?.items ?? []).filter(tx => tx.to_address?.toLowerCase() === contractAddress.toLowerCase());
  const unlimitedApproval = approvals.some(a => BigInt(a.allowance || 0) >= MAX_UINT / 2n);

  return {
    contractAddress, walletAddress,
    riskLevel:          unlimitedApproval ? "HIGH" : approvals.length > 0 ? "MEDIUM" : "LOW",
    activeApprovals:    approvals.length,
    hasUnlimitedApproval: unlimitedApproval,
    interactionCount:   txsToContract.length,
  };
}`,
    endpoints: ["SecurityService.getApprovals", "TransactionService.getTransactionsForAddressV3"],
    chains: EVM,
    complexity: "intermediate",
    useCase: "Pre-interaction risk checks, DeFi safety UIs, smart contract auditing tools, wallet security dashboards",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "2 credits",
    keyParams: [
      { name: "walletAddress", type: "string", description: "Wallet address" },
      { name: "contractAddress", type: "string", description: "Contract to assess risk for" },
    ],
    responseFields: ["riskLevel","activeApprovals","hasUnlimitedApproval","interactionCount"],
  },

  "phishing-wallet-database": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Lookup whether a wallet has received funds FROM known phishing addresses
const KNOWN_PHISHING = new Set([
  "0x4e5b2e1dc63f6b91cb6cd759936495434c7e972f",
  // Add more from community sources
]);

async function checkPhishingExposure(chainName, walletAddress) {
  const resp = await client.TransactionService.getTransactionsForAddressV3(
    chainName, walletAddress, { pageSize: 200 }
  );
  if (resp.error) throw new Error(resp.error_message);

  const phishingTxs = (resp.data?.items ?? []).filter(tx =>
    KNOWN_PHISHING.has(tx.from_address?.toLowerCase())
  );
  return {
    walletAddress,
    phishingContactsFound: phishingTxs.length,
    riskLevel: phishingTxs.length > 0 ? "FLAGGED" : "CLEAR",
    contacts: phishingTxs.map(tx => ({ txHash: tx.tx_hash, from: tx.from_address, timestamp: tx.block_signed_at })),
  };
}`,
    endpoints: ["TransactionService.getTransactionsForAddressV3"],
    chains: EVM,
    complexity: "intermediate",
    useCase: "Wallet phishing detection, CEX deposit screening, security alert notifications",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [{ name: "walletAddress", type: "string", description: "Wallet to check" }],
    responseFields: ["riskLevel","phishingContactsFound","contacts"],
  },

  // ── CHAIN-SPECIFIC INTELLIGENCE ─────────────────────────────────────────────
  "berachain-intelligence": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getBerachainWalletData(walletAddress) {
  const chain = "berachain-mainnet"; // or check current supported name
  const [balResp, txResp] = await Promise.all([
    client.BalanceService.getTokenBalancesForWalletAddress(chain, walletAddress),
    client.TransactionService.getTransactionSummary(chain, walletAddress),
  ]);
  const tokens  = balResp.data?.items ?? [];
  const summary = txResp.data?.items?.[0];
  return {
    chain, walletAddress,
    beraBalance:  tokens.find(t => t.native_token)?.balance,
    netWorthUSD:  tokens.reduce((s, t) => s + (t.quote ?? 0), 0),
    txCount:      summary?.total_count ?? 0,
    tokens: tokens.filter(t => !t.is_spam).map(t => ({ symbol: t.contract_ticker_symbol, balanceUSD: t.quote })),
  };
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress", "TransactionService.getTransactionSummary"],
    chains: ["berachain-mainnet"],
    complexity: "beginner",
    useCase: "Berachain DeFi dashboards, BGT staking tracker, Berachain validator analytics, PoL monitoring",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per chain",
    keyParams: [{ name: "walletAddress", type: "string", description: "Berachain wallet address" }],
    responseFields: ["beraBalance","netWorthUSD","txCount","tokens"],
  },

  "scroll-and-linea-intelligence": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getZkEVMActivity(walletAddress) {
  const chains = ["scroll-mainnet", "linea-mainnet"];
  const results = await Promise.allSettled(
    chains.map(chain => client.BalanceService.getTokenBalancesForWalletAddress(chain, walletAddress))
  );
  return chains.map((chain, i) => {
    if (results[i].status !== "fulfilled" || results[i].value.error) return { chain, netWorthUSD: 0 };
    const items = results[i].value.data?.items ?? [];
    return { chain, netWorthUSD: items.reduce((s, t) => s + (t.quote ?? 0), 0), tokenCount: items.length };
  });
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress"],
    chains: ["scroll-mainnet", "linea-mainnet"],
    complexity: "beginner",
    useCase: "zkEVM portfolio trackers, Scroll/Linea DeFi dashboards, L2 bridging status, zkEVM points programs",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per chain",
    keyParams: [{ name: "walletAddress", type: "string", description: "Wallet address" }],
    responseFields: ["chain","netWorthUSD","tokenCount"],
  },

  "starknet-intelligence": {
    snippet: `// StarkNet is not yet EVM-compatible; use GoldRush when StarkNet EVM support is added.
// For now, use the Starknet.js SDK alongside GoldRush for EVM bridged assets.
import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Track StarkNet bridged assets on Ethereum (StarkGate bridge)
const STARKGATE_BRIDGE = "0xae0Ee0A63A2cE6BaeEFFE56e7714FB4EFE48D419";

async function getStarkNetBridgedAssets(ethWalletAddress) {
  const resp = await client.TransactionService.getTransactionsForAddressV3(
    "eth-mainnet", ethWalletAddress, { pageSize: 100 }
  );
  const bridgeTxs = (resp.data?.items ?? []).filter(
    tx => tx.to_address?.toLowerCase() === STARKGATE_BRIDGE.toLowerCase()
  );
  return bridgeTxs.map(tx => ({
    txHash:    tx.tx_hash,
    timestamp: tx.block_signed_at,
    valueUSD:  tx.value_quote,
    direction: "ETH → StarkNet",
  }));
}`,
    endpoints: ["TransactionService.getTransactionsForAddressV3"],
    chains: ["eth-mainnet"],
    complexity: "intermediate",
    useCase: "StarkNet bridge monitoring, L2 deposit tracking, StarkNet DeFi migration analytics",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [{ name: "ethWalletAddress", type: "string", description: "Ethereum wallet that bridges to StarkNet" }],
    responseFields: ["txHash","timestamp","valueUSD","direction"],
  },

  "solana-program-analytics": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getSolanaWalletData(solanaAddress) {
  const chain = "solana-mainnet";
  const [balResp, txResp] = await Promise.all([
    client.BalanceService.getTokenBalancesForWalletAddress(chain, solanaAddress),
    client.TransactionService.getTransactionSummary(chain, solanaAddress),
  ]);
  const tokens = balResp.data?.items ?? [];
  return {
    chain, solanaAddress,
    solBalance:   tokens.find(t => t.native_token)?.balance,
    netWorthUSD:  tokens.reduce((s, t) => s + (t.quote ?? 0), 0),
    splTokens:    tokens.filter(t => !t.native_token && !t.is_spam).map(t => ({
      mint:       t.contract_address,
      symbol:     t.contract_ticker_symbol,
      balance:    t.balance,
      valueUSD:   t.quote,
    })),
    txCount:      txResp.data?.items?.[0]?.total_count ?? 0,
  };
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress", "TransactionService.getTransactionSummary"],
    chains: ["solana-mainnet"],
    complexity: "beginner",
    useCase: "Solana portfolio trackers, SPL token dashboards, Solana DeFi positions, cross-chain (SOL+EVM) wallets",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit",
    keyParams: [{ name: "solanaAddress", type: "string", description: "Solana wallet address (base58)" }],
    responseFields: ["solBalance","netWorthUSD","splTokens","txCount"],
  },

  "sui-and-aptos-intelligence": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getMoveEcosystemBalances(walletAddress) {
  const chains = ["aptos-mainnet", "sui-mainnet"];
  const results = await Promise.allSettled(
    chains.map(chain => client.BalanceService.getTokenBalancesForWalletAddress(chain, walletAddress))
  );
  return chains.map((chain, i) => {
    if (results[i].status !== "fulfilled" || results[i].value.error) return { chain, netWorthUSD: 0, tokens: [] };
    const items = results[i].value.data?.items ?? [];
    return {
      chain,
      netWorthUSD: items.reduce((s, t) => s + (t.quote ?? 0), 0),
      tokens: items.filter(t => !t.is_spam).map(t => ({ symbol: t.contract_ticker_symbol, valueUSD: t.quote })),
    };
  });
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress"],
    chains: ["aptos-mainnet", "sui-mainnet"],
    complexity: "beginner",
    useCase: "Move VM portfolio dashboards, Aptos/Sui DeFi positions, cross-ecosystem (Move + EVM) portfolio trackers",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per chain",
    keyParams: [{ name: "walletAddress", type: "string", description: "Move ecosystem wallet address" }],
    responseFields: ["chain","netWorthUSD","tokens"],
  },

  "cosmos-ecosystem": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getCosmosBalances(walletAddress) {
  const chains = ["cosmos-mainnet", "osmosis-mainnet", "axelar-mainnet"];
  const results = await Promise.allSettled(
    chains.map(chain => client.BalanceService.getTokenBalancesForWalletAddress(chain, walletAddress))
  );
  return chains.map((chain, i) => ({
    chain,
    netWorthUSD: results[i].status === "fulfilled" && !results[i].value.error
      ? (results[i].value.data?.items ?? []).reduce((s, t) => s + (t.quote ?? 0), 0) : 0,
  }));
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress"],
    chains: ["cosmos-mainnet", "osmosis-mainnet", "axelar-mainnet"],
    complexity: "beginner",
    useCase: "Cosmos ecosystem portfolio, IBC token tracking, ATOM/OSMO balance dashboards, cross-chain IBC analytics",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per chain",
    keyParams: [{ name: "walletAddress", type: "string", description: "Cosmos bech32 wallet address" }],
    responseFields: ["chain","netWorthUSD"],
  },

  "near-protocol-intelligence": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// NEAR Aurora is EVM-compatible and supported by GoldRush
async function getNearAuroraData(walletAddress) {
  const chain = "aurora-mainnet";
  const resp  = await client.BalanceService.getTokenBalancesForWalletAddress(chain, walletAddress);
  if (resp.error) throw new Error(resp.error_message);
  const items = resp.data?.items ?? [];
  return {
    chain, walletAddress,
    netWorthUSD: items.reduce((s, t) => s + (t.quote ?? 0), 0),
    tokens: items.filter(t => !t.is_spam).map(t => ({ symbol: t.contract_ticker_symbol, valueUSD: t.quote })),
  };
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress"],
    chains: ["aurora-mainnet"],
    complexity: "beginner",
    useCase: "NEAR Aurora DeFi dashboards, Aurora DEX analytics, cross-chain NEAR/EVM portfolio trackers",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit",
    keyParams: [{ name: "walletAddress", type: "string", description: "Aurora EVM-compatible address" }],
    responseFields: ["netWorthUSD","tokens"],
  },

  "ton-blockchain-intelligence": {
    snippet: `// TON is not yet in GoldRush's EVM scope. Use TON-specific SDKs for on-chain data.
// Bridge assets between TON and EVM chains can be tracked via GoldRush:
import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Track TON bridge receipts on Ethereum
async function trackTonBridgeActivity(ethWalletAddress) {
  const resp = await client.BalanceService.getErc20TransfersForWalletAddress(
    "eth-mainnet", ethWalletAddress
  );
  const tonBridgeTokens = (resp.data?.items ?? []).filter(tx =>
    tx.transfers?.some(t => t.contract_ticker_symbol === "TONCOIN" || t.contract_name?.includes("Toncoin"))
  );
  return tonBridgeTokens.map(tx => ({
    txHash:    tx.tx_hash,
    timestamp: tx.block_signed_at,
    amount:    tx.transfers?.[0]?.delta,
    amountUSD: tx.transfers?.[0]?.delta_quote,
  }));
}`,
    endpoints: ["BalanceService.getErc20TransfersForWalletAddress"],
    chains: ["eth-mainnet"],
    complexity: "intermediate",
    useCase: "TON-EVM bridge monitoring, TONCOIN transfer tracking, cross-chain Telegram wallet analytics",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [{ name: "ethWalletAddress", type: "string", description: "Ethereum wallet bridging from TON" }],
    responseFields: ["txHash","timestamp","amountUSD"],
  },

  "tron-ecosystem-monitor": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// TRON is EVM-compatible (TRC-20 ≈ ERC-20 on TRON EVM)
async function getTronEcosystemData(walletAddress) {
  // GoldRush supports TRON via its EVM-compatible layer
  const chain = "tron-mainnet";
  const resp  = await client.BalanceService.getTokenBalancesForWalletAddress(chain, walletAddress);
  if (resp.error) throw new Error(resp.error_message);
  const items = resp.data?.items ?? [];
  return {
    walletAddress,
    trxBalance:  items.find(t => t.native_token)?.balance,
    usdtBalance: items.find(t => t.contract_ticker_symbol === "USDT")?.quote,
    netWorthUSD: items.reduce((s, t) => s + (t.quote ?? 0), 0),
    tokens: items.filter(t => !t.is_spam).map(t => ({ symbol: t.contract_ticker_symbol, valueUSD: t.quote })),
  };
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress"],
    chains: ["tron-mainnet"],
    complexity: "beginner",
    useCase: "TRON/USDT flow monitoring, TRC-20 portfolio trackers, TRON DeFi dashboards, stablecoin transfer analytics",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit",
    keyParams: [{ name: "walletAddress", type: "string", description: "TRON wallet address" }],
    responseFields: ["trxBalance","usdtBalance","netWorthUSD","tokens"],
  },

  "polkadot-parachain-intelligence": {
    snippet: `// Polkadot parachains that are EVM-compatible (Moonbeam, Moonriver, Astar) are supported by GoldRush.
import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getPolkadotEVMPortfolio(walletAddress) {
  const chains = ["moonbeam-mainnet", "moonriver-mainnet", "astar-mainnet"];
  const results = await Promise.allSettled(
    chains.map(chain => client.BalanceService.getTokenBalancesForWalletAddress(chain, walletAddress))
  );
  return chains.map((chain, i) => ({
    chain,
    netWorthUSD: results[i].status === "fulfilled" && !results[i].value.error
      ? (results[i].value.data?.items ?? []).reduce((s, t) => s + (t.quote ?? 0), 0) : 0,
  }));
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress"],
    chains: ["moonbeam-mainnet", "moonriver-mainnet", "astar-mainnet"],
    complexity: "beginner",
    useCase: "Polkadot EVM portfolio trackers, Moonbeam DeFi dashboards, XCM asset tracking, parachain analytics",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per chain",
    keyParams: [{ name: "walletAddress", type: "string", description: "EVM-compatible address on Polkadot parachains" }],
    responseFields: ["chain","netWorthUSD"],
  },

  "hyperliquid-intelligence": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Hyperliquid uses Arbitrum for USDC bridging
async function getHyperliquidBridgeActivity(walletAddress) {
  const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const HYPERLIQUID_BRIDGE = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7";

  const resp = await client.BalanceService.getErc20TransfersForWalletAddress(
    "arbitrum-mainnet", walletAddress, { contractAddress: USDC_ARB }
  );
  if (resp.error) throw new Error(resp.error_message);

  const bridgeTxs = (resp.data?.items ?? []).filter(tx =>
    tx.transfers?.some(t =>
      t.to_address?.toLowerCase() === HYPERLIQUID_BRIDGE.toLowerCase() ||
      t.from_address?.toLowerCase() === HYPERLIQUID_BRIDGE.toLowerCase()
    )
  );
  return bridgeTxs.map(tx => ({
    txHash:    tx.tx_hash,
    timestamp: tx.block_signed_at,
    direction: tx.transfers?.[0]?.transfer_type === "OUT" ? "Deposit to HL" : "Withdraw from HL",
    amountUSD: tx.transfers?.[0]?.delta_quote,
  }));
}`,
    endpoints: ["BalanceService.getErc20TransfersForWalletAddress"],
    chains: ["arbitrum-mainnet"],
    complexity: "intermediate",
    useCase: "Hyperliquid bridge tracking, USDC deposit/withdraw monitoring, perp DEX flow analytics",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [{ name: "walletAddress", type: "string", description: "Arbitrum wallet address" }],
    responseFields: ["txHash","direction","amountUSD","timestamp"],
  },

  "ethereum-validator-intelligence": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Track ETH staking deposits to the Beacon Chain deposit contract
const DEPOSIT_CONTRACT = "0x00000000219ab540356cBB839Cbe05303d7705Fa";
// DepositEvent topic
const DEPOSIT_TOPIC = "0x649bbc62d0e31342afea4e5cd82d4049e7e1ee912fc0889aa790803be39038c5";

async function getValidatorDeposits(depositorAddress) {
  const resp = await client.BaseService.getLogs("eth-mainnet", {
    address: DEPOSIT_CONTRACT, topicHash: DEPOSIT_TOPIC, pageSize: 100
  });
  if (resp.error) throw new Error(resp.error_message);
  // Filter logs for this depositor (pubkey owner)
  return resp.data.items.map(log => ({
    txHash:    log.tx_hash,
    timestamp: log.block_signed_at,
    pubkey:    log.decoded?.params?.find(p => p.name === "pubkey")?.value,
    amount:    log.decoded?.params?.find(p => p.name === "amount")?.value,
  }));
}`,
    endpoints: ["BaseService.getLogs"],
    chains: ["eth-mainnet"],
    complexity: "advanced",
    useCase: "Ethereum staking dashboards, validator deposit tracking, LST protocol analytics, staking yield calculators",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [],
    responseFields: ["txHash","timestamp","pubkey","amount"],
  },

  "chain-health-scorecard": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getChainHealthScorecard(chainNames) {
  const [chainsResp, statusResp] = await Promise.all([
    client.BaseService.getAllChains(),
    client.BaseService.getAllChainStatuses(),
  ]);
  const metaMap = Object.fromEntries((chainsResp.data?.items ?? []).map(c => [c.name, c]));
  const statuses = statusResp.data?.items ?? [];

  return statuses
    .filter(s => !chainNames || chainNames.includes(s.name))
    .map(s => ({
      chainName:    s.name,
      logoUrl:      metaMap[s.name]?.logo_url,
      latestBlock:  s.synced_block_height,
      isSyncing:    s.is_indexing,
      syncLagBlocks: s.synced_block_height - (s.latest_quick_sync_block_height ?? s.synced_block_height),
      status:       s.is_indexing ? "syncing" : "live",
    }));
}`,
    endpoints: ["BaseService.getAllChains", "BaseService.getAllChainStatuses"],
    chains: EVM,
    complexity: "beginner",
    useCase: "Multi-chain health dashboards, chain selector UIs, DevOps monitoring, uptime status pages",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "0.1 credits",
    keyParams: [{ name: "chainNames", type: "string[]", description: "Chains to include (or omit for all)" }],
    responseFields: ["chainName","latestBlock","isSyncing","syncLagBlocks","status"],
  },

  "fund-flow-intelligence": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function traceFundFlows(chainName, seedAddress, hops = 2) {
  const visited = new Set([seedAddress]);
  const flows   = [];

  async function traceHop(address, depth) {
    if (depth === 0 || visited.size > 50) return;
    const resp = await client.TransactionService.getTransactionsForAddressV3(
      chainName, address, { pageSize: 20 }
    );
    if (resp.error) return;
    for (const tx of resp.data?.items ?? []) {
      const next = tx.from_address === address ? tx.to_address : tx.from_address;
      if (!next || visited.has(next)) continue;
      flows.push({ from: address, to: next, txHash: tx.tx_hash, valueUSD: tx.value_quote, depth: hops - depth + 1 });
      visited.add(next);
      if (depth > 1) await traceHop(next, depth - 1);
    }
  }
  await traceHop(seedAddress, hops);
  return { seedAddress, nodes: [...visited], flows };
}`,
    endpoints: ["TransactionService.getTransactionsForAddressV3"],
    chains: EVM,
    complexity: "advanced",
    useCase: "On-chain fund flow tracing, money laundering detection, VC fund tracking, whale wallet intelligence",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page per address",
    keyParams: [
      { name: "seedAddress", type: "string", description: "Starting wallet address" },
      { name: "hops", type: "number", description: "Depth of fund flow tracing (1-3)" },
    ],
    responseFields: ["nodes","flows[from,to,txHash,valueUSD,depth]"],
  },

  "institutional-wallet-tracker": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Well-known institutional / VC wallet addresses
const INSTITUTIONAL_WALLETS = {
  "a16z":    "0x05e793ce0c6027323ac150f6d45c2344d28b6019",
  "Jump":    "0x0f4ee9631f4be0a63756515141281a3e2b293bbe",
  "Paradigm": "0xa251a1da8acf6d6285b2a52ad4db31acdd76e0f1",
};

async function trackInstitutionalWallet(chainName, labelOrAddress) {
  const address = INSTITUTIONAL_WALLETS[labelOrAddress] || labelOrAddress;
  const [balResp, txResp] = await Promise.all([
    client.BalanceService.getTokenBalancesForWalletAddress(chainName, address),
    client.TransactionService.getTransactionsForAddressV3(chainName, address, { pageSize: 20 }),
  ]);
  const tokens   = balResp.data?.items ?? [];
  const recentTx = txResp.data?.items ?? [];
  return {
    address, label: labelOrAddress,
    netWorthUSD: tokens.reduce((s, t) => s + (t.quote ?? 0), 0),
    topHoldings: tokens.filter(t => !t.is_spam).sort((a, b) => (b.quote ?? 0) - (a.quote ?? 0)).slice(0, 5)
      .map(t => ({ symbol: t.contract_ticker_symbol, valueUSD: t.quote })),
    recentActivity: recentTx.slice(0, 5).map(tx => ({ txHash: tx.tx_hash, timestamp: tx.block_signed_at, valueUSD: tx.value_quote })),
  };
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress", "TransactionService.getTransactionsForAddressV3"],
    chains: EVM,
    complexity: "intermediate",
    useCase: "Institutional whale tracking, smart money analytics, VC portfolio monitoring, market intelligence dashboards",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "2 credits",
    keyParams: [{ name: "labelOrAddress", type: "string", description: "Institutional label or wallet address" }],
    responseFields: ["netWorthUSD","topHoldings","recentActivity"],
  },

  "macro-onchain-sentiment": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function getMacroOnchainSentiment(chainName = "eth-mainnet") {
  // Use chain status + recent block data as macro signal
  const [statusResp, balResp] = await Promise.all([
    client.BaseService.getAllChainStatuses(),
    // Sample a well-known active address for proxy activity signal
    client.TransactionService.getTransactionSummary(chainName, "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"), // vitalik.eth
  ]);
  const chainStatus = statusResp.data?.items?.find(c => c.name === chainName);
  return {
    chainName,
    latestBlock:  chainStatus?.synced_block_height,
    isSyncing:    chainStatus?.is_indexing,
    chainSummary: chainStatus,
  };
}`,
    endpoints: ["BaseService.getAllChainStatuses", "TransactionService.getTransactionSummary"],
    chains: EVM,
    complexity: "intermediate",
    useCase: "Macro on-chain sentiment dashboards, DeFi market timing signals, chain activity indices, crypto market intelligence",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "0.5 credits",
    keyParams: [{ name: "chainName", type: "string", description: "Primary chain to analyse" }],
    responseFields: ["latestBlock","isSyncing","chainSummary"],
  },

  "carbon-credit-regen-tracker": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Toucan Protocol BCT (Base Carbon Tonne) on Polygon
const BCT_ADDRESS  = "0x2F800Db0fdb5223b3C3f354886d907A671414A7F";
const MCO2_ADDRESS = "0xAa7DbD1598251f856C12f63557A4C4397c253Cea";

async function trackCarbonCredits(walletAddress) {
  const chain = "matic-mainnet";
  const resp  = await client.BalanceService.getTokenBalancesForWalletAddress(chain, walletAddress);
  if (resp.error) throw new Error(resp.error_message);

  const carbonTokens = (resp.data?.items ?? []).filter(t =>
    [BCT_ADDRESS.toLowerCase(), MCO2_ADDRESS.toLowerCase()].includes(t.contract_address?.toLowerCase())
  );
  return carbonTokens.map(t => ({
    token:       t.contract_ticker_symbol,
    balance:     t.balance,
    valueUSD:    t.quote,
    retired:     false, // retirement requires additional on-chain check
  }));
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress"],
    chains: ["matic-mainnet"],
    complexity: "intermediate",
    useCase: "Carbon credit portfolio tracking, ESG reporting dashboards, Toucan Protocol analytics, voluntary carbon market tools",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit",
    keyParams: [{ name: "walletAddress", type: "string", description: "Wallet holding carbon credit tokens" }],
    responseFields: ["token","balance","valueUSD"],
  },

  "cross-border-payment-analytics": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Track stablecoin cross-border payments (USDC/USDT transfers)
async function analyzeCrossBorderPayments(chainName, walletAddress) {
  const USDC = { "eth-mainnet": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "matic-mainnet": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" };
  const resp = await client.BalanceService.getErc20TransfersForWalletAddress(
    chainName, walletAddress, { contractAddress: USDC[chainName] }
  );
  if (resp.error) throw new Error(resp.error_message);

  const transfers = resp.data?.items ?? [];
  const sent     = transfers.filter(tx => tx.transfers?.[0]?.transfer_type === "OUT");
  const received = transfers.filter(tx => tx.transfers?.[0]?.transfer_type === "IN");
  return {
    walletAddress, chainName,
    totalSentUSD:     sent.reduce((s, t) => s + (t.transfers?.[0]?.delta_quote ?? 0), 0),
    totalReceivedUSD: received.reduce((s, t) => s + (t.transfers?.[0]?.delta_quote ?? 0), 0),
    txCount: transfers.length,
  };
}`,
    endpoints: ["BalanceService.getErc20TransfersForWalletAddress"],
    chains: ["matic-mainnet", "eth-mainnet", "base-mainnet"],
    complexity: "intermediate",
    useCase: "Stablecoin remittance analytics, cross-border payment dashboards, fintech compliance, USDC flow monitoring",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [{ name: "walletAddress", type: "string", description: "Wallet address" }],
    responseFields: ["totalSentUSD","totalReceivedUSD","txCount"],
  },

  "treasury-management-intelligence": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function analyzeTreasury(treasuryAddress, chainNames = ["eth-mainnet", "matic-mainnet"]) {
  const results = await Promise.allSettled(
    chainNames.map(chain => client.BalanceService.getTokenBalancesForWalletAddress(chain, treasuryAddress))
  );
  let totalUSD = 0;
  const breakdown = chainNames.map((chain, i) => {
    if (results[i].status !== "fulfilled" || results[i].value.error) return { chain, totalUSD: 0 };
    const items = results[i].value.data?.items ?? [];
    const chainUSD = items.reduce((s, t) => s + (t.quote ?? 0), 0);
    totalUSD += chainUSD;
    return { chain, totalUSD: chainUSD, topAssets: items.sort((a, b) => (b.quote ?? 0) - (a.quote ?? 0)).slice(0, 5).map(t => ({ symbol: t.contract_ticker_symbol, valueUSD: t.quote })) };
  });
  return { treasuryAddress, totalUSD, chainBreakdown: breakdown };
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress"],
    chains: EVM,
    complexity: "intermediate",
    useCase: "DAO treasury dashboards, protocol treasury management, multi-sig wallet monitoring, fund NAV calculation",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per chain",
    keyParams: [
      { name: "treasuryAddress", type: "string", description: "Multi-sig or treasury wallet address" },
      { name: "chainNames", type: "string[]", description: "Chains to include in analysis" },
    ],
    responseFields: ["totalUSD","chainBreakdown[chain,totalUSD,topAssets]"],
  },

  "protocol-acquisition-intelligence": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function analyzeProtocolAcquisition(chainName, protocolAddress, tokenAddress) {
  const [holdersResp, txResp, priceResp] = await Promise.all([
    client.BalanceService.getTokenHoldersV2ForTokenAddress(chainName, tokenAddress, { pageSize: 100 }),
    client.TransactionService.getTransactionsForAddressV3(chainName, protocolAddress, { pageSize: 100 }),
    client.PricingService.getTokenPrices(chainName, "USD", tokenAddress),
  ]);
  const holders = holdersResp.data?.items ?? [];
  const txs     = txResp.data?.items ?? [];
  const price   = priceResp.data?.[0]?.prices?.[0]?.price ?? 0;
  return {
    protocolAddress, tokenAddress,
    tokenPrice:    price,
    holderCount:   holdersResp.data?.pagination?.total_count ?? holders.length,
    top10Concentration: holders.slice(0, 10).reduce((s, h) => s + (h.percent_of_supply_held ?? 0), 0),
    recentTxVolume: txs.reduce((s, t) => s + (t.value_quote ?? 0), 0),
  };
}`,
    endpoints: ["BalanceService.getTokenHoldersV2ForTokenAddress", "PricingService.getTokenPrices"],
    chains: EVM,
    complexity: "advanced",
    useCase: "M&A due diligence for DeFi protocols, token acquisition analysis, governance takeover detection",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "3 credits",
    keyParams: [
      { name: "protocolAddress", type: "string", description: "Protocol contract or treasury address" },
      { name: "tokenAddress", type: "string", description: "Governance token address" },
    ],
    responseFields: ["tokenPrice","holderCount","top10Concentration","recentTxVolume"],
  },

  // ── AGENT TOOLS ─────────────────────────────────────────────────────────────
  "agent-alpha-signal-extractor": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Smart money wallets (update with current known alpha wallets)
const SMART_MONEY = [
  "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // vitalik.eth
  "0x220866b1a2219f40e72f5c628b65d54268ca3a9d", // example whale
];

async function extractAlphaSignals(chainName) {
  const signals = await Promise.allSettled(
    SMART_MONEY.map(async wallet => {
      const resp = await client.TransactionService.getTransactionsForAddressV3(
        chainName, wallet, { pageSize: 10 }
      );
      if (resp.error) return null;
      return { wallet, recentTxs: resp.data?.items?.slice(0, 3).map(tx => ({
        txHash: tx.tx_hash, timestamp: tx.block_signed_at, to: tx.to_address, valueUSD: tx.value_quote
      })) };
    })
  );
  return signals.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);
}`,
    endpoints: ["TransactionService.getTransactionsForAddressV3", "BalanceService.getTokenBalancesForWalletAddress"],
    chains: EVM,
    complexity: "advanced",
    useCase: "AI trading agent alpha extraction, smart money copy trading, on-chain signal generation for LLM agents",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per wallet per page",
    keyParams: [{ name: "chainName", type: "string", description: "Chain to scan for signals" }],
    responseFields: ["wallet","recentTxs[txHash,timestamp,to,valueUSD]"],
  },

  "agent-counterparty-verification": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function verifyCounterparty(walletAddress) {
  const chain = "eth-mainnet";
  const [summaryResp, approvalResp, activityResp] = await Promise.all([
    client.TransactionService.getTransactionSummary(chain, walletAddress),
    client.SecurityService.getApprovals(chain, walletAddress),
    client.BaseService.getMultiChainActivity(walletAddress),
  ]);

  const s = summaryResp.data?.items?.[0];
  const ageDays   = s?.earliest_transaction ? Math.floor((Date.now() - new Date(s.earliest_transaction.block_signed_at)) / 86400000) : 0;
  const activeChains = activityResp.data?.items?.filter(c => c.is_wallet_active).length ?? 0;
  const riskyApprovals = (approvalResp.data?.items ?? []).filter(a => BigInt(a.allowance || 0) > BigInt("1000000000000000000000000")); // >1M tokens

  return {
    walletAddress,
    verified: ageDays > 90 && (s?.total_count ?? 0) > 10,
    ageDays, txCount: s?.total_count ?? 0, activeChains,
    riskFlags: riskyApprovals.length > 5 ? ["excessive-approvals"] : [],
  };
}`,
    endpoints: ["TransactionService.getTransactionSummary", "SecurityService.getApprovals", "BaseService.getMultiChainActivity"],
    chains: EVM,
    complexity: "intermediate",
    useCase: "Agent-to-agent trust verification, DeFi counterparty risk, autonomous payment screening",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "3 credits",
    keyParams: [{ name: "walletAddress", type: "string", description: "Counterparty address to verify" }],
    responseFields: ["verified","ageDays","txCount","activeChains","riskFlags"],
  },

  "agent-cross-chain-coordinator": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function coordinateCrossChain(agentAddress) {
  // Step 1: find all active chains
  const actResp = await client.BaseService.getMultiChainActivity(agentAddress);
  if (actResp.error) throw new Error(actResp.error_message);
  const chains = actResp.data.items.filter(c => c.is_wallet_active).map(c => c.name);

  // Step 2: get balances on all chains
  const balances = await Promise.allSettled(
    chains.map(chain => client.BalanceService.getTokenBalancesForWalletAddress(chain, agentAddress))
  );

  return {
    agentAddress,
    activeChains: chains.length,
    chainPortfolio: chains.map((chain, i) => ({
      chain,
      totalUSD: balances[i].status === "fulfilled" && !balances[i].value.error
        ? (balances[i].value.data?.items ?? []).reduce((s, t) => s + (t.quote ?? 0), 0) : 0,
    })),
  };
}`,
    endpoints: ["BaseService.getMultiChainActivity", "BalanceService.getTokenBalancesForWalletAddress"],
    chains: EVM,
    complexity: "intermediate",
    useCase: "Autonomous agent cross-chain portfolio management, bridge routing decisions, multi-chain DeFi execution",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per chain",
    keyParams: [{ name: "agentAddress", type: "string", description: "Agent's multi-chain wallet address" }],
    responseFields: ["activeChains","chainPortfolio[chain,totalUSD]"],
  },

  "agent-data-budget-manager": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Lightweight balance check to manage agent's data credit usage
async function checkDataBudget(agentAddress, chainName = "eth-mainnet") {
  // Use the cheapest endpoint (getNativeTokenBalance = 0.1 credits) to check gas
  const resp = await client.BalanceService.getNativeTokenBalance(chainName, agentAddress);
  if (resp.error) throw new Error(resp.error_message);
  return {
    agentAddress, chainName,
    nativeBalance: resp.data?.balance,
    nativeBalanceUSD: resp.data?.quote,
    hasGasForOps: Number(resp.data?.quote ?? 0) > 5, // >$5 USD in gas
  };
}`,
    endpoints: ["BalanceService.getNativeTokenBalance"],
    chains: EVM,
    complexity: "beginner",
    useCase: "Autonomous agent gas management, credit budget enforcement, agent operational health checks",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "0.1 credits",
    keyParams: [{ name: "agentAddress", type: "string", description: "Agent wallet address" }],
    responseFields: ["nativeBalance","nativeBalanceUSD","hasGasForOps"],
  },

  "agent-discovery-protocol": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Discover other on-chain agents by scanning known agent registry patterns
async function discoverAgents(chainName, registryAddress) {
  const resp = await client.TransactionService.getTransactionsForAddressV3(
    chainName, registryAddress, { pageSize: 100 }
  );
  if (resp.error) throw new Error(resp.error_message);

  // Each tx that deployed or registered an agent
  const agentAddresses = [...new Set(
    (resp.data?.items ?? []).map(tx => tx.from_address).filter(Boolean)
  )];
  return { registryAddress, discoveredAgents: agentAddresses.slice(0, 20) };
}`,
    endpoints: ["TransactionService.getTransactionsForAddressV3"],
    chains: EVM,
    complexity: "advanced",
    useCase: "Agent mesh networks, multi-agent coordination, on-chain agent directories, autonomous agent discovery",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [{ name: "registryAddress", type: "string", description: "Agent registry contract address" }],
    responseFields: ["discoveredAgents"],
  },

  "agent-fleet-monitor": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function monitorAgentFleet(agentAddresses, chainName = "eth-mainnet") {
  const health = await Promise.allSettled(
    agentAddresses.map(async addr => {
      const [balResp, sumResp] = await Promise.all([
        client.BalanceService.getNativeTokenBalance(chainName, addr),
        client.TransactionService.getTransactionSummary(chainName, addr),
      ]);
      return {
        address:    addr,
        gasUSD:     balResp.data?.quote ?? 0,
        lastActive: sumResp.data?.items?.[0]?.latest_transaction?.block_signed_at,
        txCount:    sumResp.data?.items?.[0]?.total_count ?? 0,
        status:     (balResp.data?.quote ?? 0) > 2 ? "healthy" : "low-gas",
      };
    })
  );
  return health.filter(r => r.status === "fulfilled").map(r => r.value);
}`,
    endpoints: ["BalanceService.getNativeTokenBalance", "TransactionService.getTransactionSummary"],
    chains: EVM,
    complexity: "intermediate",
    useCase: "Multi-agent fleet health monitoring, agent operational dashboards, autonomous swarm management",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "0.2 credits per agent",
    keyParams: [
      { name: "agentAddresses", type: "string[]", description: "List of agent wallet addresses" },
      { name: "chainName", type: "string", description: "Chain to monitor on" },
    ],
    responseFields: ["address","gasUSD","lastActive","txCount","status"],
  },

  "agent-market-surveillance": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

const SWAP_TOPIC = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822"; // Uniswap V2 Swap

async function surveillanceAgent(chainName, poolAddress, blockRange = 100) {
  const [statusResp] = await Promise.all([client.BaseService.getAllChainStatuses()]);
  const chainStatus  = statusResp.data?.items?.find(c => c.name === chainName);
  const latestBlock  = chainStatus?.synced_block_height ?? 0;

  const resp = await client.BaseService.getLogs(chainName, {
    address:   poolAddress,
    topicHash: SWAP_TOPIC,
    blockStart: latestBlock - blockRange,
    blockEnd:   latestBlock,
    pageSize:   500,
  });
  if (resp.error) throw new Error(resp.error_message);

  const swaps = resp.data.items;
  const volumeUSD = swaps.reduce((s, log) => {
    const amount = log.decoded?.params?.find(p => p.name === "amount0In" || p.name === "amount0Out");
    return s + (Number(amount?.value ?? 0) / 1e18) * 2000; // rough ETH price proxy
  }, 0);
  return { poolAddress, blocksScanned: blockRange, swapCount: swaps.length, estimatedVolumeUSD: volumeUSD };
}`,
    endpoints: ["BaseService.getLogs", "BaseService.getAllChainStatuses"],
    chains: EVM,
    complexity: "advanced",
    useCase: "Real-time DEX monitoring agents, volume surveillance, large trade detection, agent-driven MEV bots",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [
      { name: "poolAddress", type: "string", description: "DEX pool contract to monitor" },
      { name: "blockRange", type: "number", description: "Number of recent blocks to scan" },
    ],
    responseFields: ["swapCount","estimatedVolumeUSD","blocksScanned"],
  },

  "agent-onchain-news-aggregator": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Aggregate on-chain "news" signals: large transfers, new deployments, governance votes
async function aggregateOnchainNews(chainName) {
  const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const [statusResp] = await Promise.all([client.BaseService.getAllChainStatuses()]);
  const latest = statusResp.data?.items?.find(c => c.name === chainName)?.synced_block_height ?? 0;

  const resp = await client.BaseService.getLogEventsByTopicHash(chainName, TRANSFER_TOPIC, {
    blockStart: latest - 50, blockEnd: latest, pageSize: 200
  });

  const largeTransfers = (resp.data?.items ?? [])
    .filter(log => log.decoded?.params?.find(p => p.name === "value" && Number(p.value) > 1e23))
    .map(log => ({
      txHash:   log.tx_hash, timestamp: log.block_signed_at,
      token:    log.sender_contract_ticker_symbol,
      from:     log.decoded?.params?.find(p => p.name === "from")?.value,
      to:       log.decoded?.params?.find(p => p.name === "to")?.value,
      amount:   log.decoded?.params?.find(p => p.name === "value")?.value,
    }));
  return { chainName, latestBlock: latest, largeTransfers };
}`,
    endpoints: ["BaseService.getLogEventsByTopicHash", "BaseService.getAllChainStatuses"],
    chains: EVM,
    complexity: "advanced",
    useCase: "On-chain news feed agents, large transfer alerts, whale movement notifications, LLM news context injection",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per page",
    keyParams: [{ name: "chainName", type: "string", description: "Chain to scan for news signals" }],
    responseFields: ["largeTransfers[txHash,token,from,to,amount]"],
  },

  "agent-payment-optimizer": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function optimizePaymentRoute(senderAddress, amountUSD) {
  // Find cheapest chain for USDC transfer based on gas costs
  const chains = ["base-mainnet", "matic-mainnet", "arbitrum-mainnet", "optimism-mainnet"];
  const [statusResp, ...balResults] = await Promise.all([
    client.BaseService.getAllChainStatuses(),
    ...chains.map(chain => client.BalanceService.getTokenBalancesForWalletAddress(chain, senderAddress)),
  ]);

  const chainData = chains.map((chain, i) => {
    const items = balResults[i].data?.items ?? [];
    const usdcBal = items.find(t => t.contract_ticker_symbol === "USDC")?.quote ?? 0;
    const gasUSD  = items.find(t => t.native_token)?.quote ?? 0;
    return { chain, usdcBalance: usdcBal, gasBalanceUSD: gasUSD, canSend: usdcBal >= amountUSD && gasUSD > 0.5 };
  });

  const viable = chainData.filter(c => c.canSend);
  const recommended = viable.sort((a, b) => a.gasBalanceUSD - b.gasBalanceUSD)[0];
  return { senderAddress, amountUSD, viable, recommendedChain: recommended?.chain ?? null };
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress"],
    chains: EVM,
    complexity: "intermediate",
    useCase: "Agent payment routing, gas-optimised USDC transfers, multi-chain payment orchestration for AI agents",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per chain",
    keyParams: [
      { name: "senderAddress", type: "string", description: "Agent sender wallet address" },
      { name: "amountUSD", type: "number", description: "USDC amount to send" },
    ],
    responseFields: ["recommendedChain","viable[chain,usdcBalance,canSend]"],
  },

  "agent-reputation-builder": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function buildAgentReputation(agentAddress) {
  const chain = "eth-mainnet";
  const [summaryResp, balResp, activityResp] = await Promise.all([
    client.TransactionService.getTransactionSummary(chain, agentAddress),
    client.BalanceService.getTokenBalancesForWalletAddress(chain, agentAddress),
    client.BaseService.getMultiChainActivity(agentAddress),
  ]);

  const s       = summaryResp.data?.items?.[0];
  const balance = balResp.data?.items?.reduce((sum, t) => sum + (t.quote ?? 0), 0) ?? 0;
  const chains  = activityResp.data?.items?.filter(c => c.is_wallet_active).length ?? 0;
  const ageDays = s?.earliest_transaction
    ? Math.floor((Date.now() - new Date(s.earliest_transaction.block_signed_at)) / 86400000) : 0;

  return {
    agentAddress,
    reputationScore: Math.min(100, Math.round((ageDays / 365) * 40 + (Math.min(s?.total_count ?? 0, 1000) / 1000) * 40 + (chains / 10) * 20)),
    ageDays, txCount: s?.total_count ?? 0, netWorthUSD: balance, activeChains: chains,
  };
}`,
    endpoints: ["TransactionService.getTransactionSummary", "BalanceService.getTokenBalancesForWalletAddress", "BaseService.getMultiChainActivity"],
    chains: EVM,
    complexity: "intermediate",
    useCase: "Agent trust scoring, autonomous agent reputation systems, agent-to-agent trust verification",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "3 credits",
    keyParams: [{ name: "agentAddress", type: "string", description: "Agent wallet address" }],
    responseFields: ["reputationScore","ageDays","txCount","netWorthUSD","activeChains"],
  },

  "agent-risk-circuit-breaker": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

async function checkCircuitBreaker(agentAddress, chainName = "eth-mainnet") {
  const [balResp, approvalResp] = await Promise.all([
    client.BalanceService.getTokenBalancesForWalletAddress(chainName, agentAddress),
    client.SecurityService.getApprovals(chainName, agentAddress),
  ]);

  const netWorth = (balResp.data?.items ?? []).reduce((s, t) => s + (t.quote ?? 0), 0);
  const MAX_UINT = BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935");
  const unlimitedApprovals = (approvalResp.data?.items ?? []).filter(a => BigInt(a.allowance || 0) >= MAX_UINT / 2n);

  const shouldBreak = netWorth < 10 || unlimitedApprovals.length > 10;
  return {
    agentAddress, chainName, netWorthUSD: netWorth,
    unlimitedApprovalCount: unlimitedApprovals.length,
    circuitBreakerTriggered: shouldBreak,
    reason: shouldBreak ? (netWorth < 10 ? "low-balance" : "excessive-approvals") : null,
  };
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress", "SecurityService.getApprovals"],
    chains: EVM,
    complexity: "intermediate",
    useCase: "Autonomous agent safety rails, DeFi risk circuit breakers, agent spend limits, loss-limit enforcement",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "2 credits",
    keyParams: [{ name: "agentAddress", type: "string", description: "Agent wallet to check" }],
    responseFields: ["netWorthUSD","unlimitedApprovalCount","circuitBreakerTriggered","reason"],
  },

  "agent-yield-harvester": {
    snippet: `import { GoldRushClient } from "@covalenthq/client-sdk";
const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY);

// Track claimable yield via Collect events on known yield positions
const COLLECT_TOPIC = "0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0";

async function trackYieldPositions(agentAddress, chainName, poolAddresses) {
  const balResp = await client.BalanceService.getTokenBalancesForWalletAddress(chainName, agentAddress);
  const holdings = (balResp.data?.items ?? []).filter(t => !t.is_spam);

  // Check fee collection events from known pools
  const feeData = await Promise.allSettled(
    poolAddresses.map(pool => client.BaseService.getLogs(chainName, {
      address: pool, topicHash: COLLECT_TOPIC, pageSize: 20
    }))
  );

  return {
    agentAddress, chainName,
    totalHoldingsUSD: holdings.reduce((s, t) => s + (t.quote ?? 0), 0),
    poolActivity: poolAddresses.map((pool, i) => ({
      pool,
      recentCollects: feeData[i].status === "fulfilled" ? feeData[i].value.data?.items?.length : 0,
    })),
  };
}`,
    endpoints: ["BalanceService.getTokenBalancesForWalletAddress", "BaseService.getLogs"],
    chains: EVM,
    complexity: "advanced",
    useCase: "Autonomous yield harvesting agents, DeFi position monitoring, auto-compound bots, yield aggregator agents",
    buildsWith: ["@covalenthq/client-sdk"],
    creditCost: "1 credit per pool",
    keyParams: [
      { name: "agentAddress", type: "string", description: "Agent wallet address" },
      { name: "poolAddresses", type: "string[]", description: "DeFi pool addresses to monitor for yield" },
    ],
    responseFields: ["totalHoldingsUSD","poolActivity[pool,recentCollects]"],
  },
};

// ─── WRITE METADATA FILES ────────────────────────────────────────────────────
let count = 0;
for (const [slug, enrichment] of Object.entries(enrichments)) {
  const fp      = path.join(META, `${slug}.json`);
  if (!fs.existsSync(fp)) { console.log(`  SKIP (no file): ${slug}`); continue; }
  const existing = JSON.parse(fs.readFileSync(fp, "utf8"));
  if (existing.snippet) { console.log(`  SKIP (has snippet): ${slug}`); continue; }
  const updated = { ...existing, ...enrichment };
  fs.writeFileSync(fp, JSON.stringify(updated, null, 2));
  count++;
  console.log(`  ✓ ${slug}`);
}
console.log(`\nEnriched ${count} metadata files.`);
