/**
 * 🔗 Shared Constants for Oracle Lend Protocol
 *
 * This file centralizes all contract addresses, token information, and network configs
 * to eliminate duplication between the custom frontend (replit) and Scaffold-ETH (nextjs).
 *
 * Used by:
 * - packages/replit/src/utils/constants.ts (custom frontend)
 * - packages/nextjs/ (Scaffold-ETH frontend via imports)
 */

// Network configuration - matches Scaffold-ETH format
export const INTUITION_TESTNET = {
  chainId: 13579,
  name: 'Intuition Testnet',
  rpcUrl: 'https://testnet.rpc.intuition.systems',
  wsUrl: 'wss://testnet.rpc.intuition.systems/ws',
  blockExplorer: 'https://testnet.explorer.intuition.systems',
  nativeCurrency: {
    name: 'Testnet TRUST',
    symbol: 'TTRUST',
    decimals: 18,
  },
  contracts: {
    // ✅ PRODUCTION: Real Intuition testnet addresses with liquidity and funding
    oracleLend: '0x552948CC80f3D757E4c18a702F5DdD42a06E7039', // OracleLend contract (5M ORACLE funded)
    oracleToken: '0x1AA6ad0A70Dd90796F2936BD11F0d4DEF7553b04', // OracleToken contract (10M supply)
    dex: '0x216cCe003Be533D11Fd4B6d87F066Eef48B42568', // DEX contract (10 TTRUST + 5M ORACLE liquidity)
    tTrustToken: '0x0000000000000000000000000000000000000000', // Native TTRUST

    // ✅ DEPLOYED: New tokens on Intuition Testnet
    intuitToken: '0xD8a5a9b31c3C0232E196d518E89Fd8bF83AcAd43', // INTUIT Token (100M supply)
    tswpToken: '0xDC11f7E700A4c898AE5CAddB1082cFfa76512aDD', // TSWP Token (50M supply)
    pintuToken: '0x51A1ceB83B83F1985a81C295d1fF28Afef186E02', // PINTU Token (10M supply)

    // ✅ DEPLOYED: New DEX contracts for token pairs
    dexIntuit: '0x36b58F5C1969B7b6591D752ea6F5486D069010AB', // DEX_INTUIT (tTRUST/INTUIT)
    dexTswp: '0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7', // DEX_TSWP (tTRUST/TSWP)
    dexPintu: '0x0355B7B8cb128fA5692729Ab3AAa199C1753f726', // DEX_PINTU (tTRUST/PINTU)
    dexRouter: '0x9A676e781A523b5d0C0e43731313A708CB607508', // DEXRouter for multi-hop
  }
} as const

// Local Hardhat configuration - matches Scaffold-ETH deployedContracts
export const LOCAL_HARDHAT = {
  chainId: 31337,
  name: 'Local Hardhat',
  rpcUrl: 'http://127.0.0.1:8545',
  contracts: {
    // These will be dynamically populated by Scaffold-ETH deployment
    // The addresses below are examples from typical Hardhat deployments
    oracleLend: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    oracleToken: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    dex: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    tTrustToken: '0x0000000000000000000000000000000000000000', // Native TTRUST

    // Additional tokens for local development
    intuitToken: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    tswpToken: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
    pintuToken: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
  }
} as const

// Token metadata - unified for both frontends
export const TOKENS = {
  tTRUST: {
    symbol: 'tTRUST',
    name: 'Testnet TRUST (Native Token)',
    address: '0x0000000000000000000000000000000000000000', // Native token
    decimals: 18,
    icon: '⚡',
    color: '#3B82F6',
    isNative: true
  },
  ORACLE: {
    symbol: 'ORACLE',
    name: 'Oracle Token',
    address: INTUITION_TESTNET.contracts.oracleToken,
    decimals: 18,
    icon: '🔮',
    color: '#8B5CF6',
    isNative: false
  },
  INTUIT: {
    symbol: 'INTUIT',
    name: 'INTUIT Token',
    address: INTUITION_TESTNET.contracts.intuitToken,
    decimals: 18,
    icon: '🧠',
    color: '#10B981',
    isNative: false
  },
  TSWP: {
    symbol: 'TSWP',
    name: 'TSWP Token (Governance)',
    address: INTUITION_TESTNET.contracts.tswpToken,
    decimals: 18,
    icon: '🗳️',
    color: '#10B981',
    isNative: false
  },
  PINTU: {
    symbol: 'PINTU',
    name: 'PINTU Token (Staking)',
    address: INTUITION_TESTNET.contracts.pintuToken,
    decimals: 18,
    icon: '💎',
    color: '#F59E0B',
    isNative: false
  }
} as const

// Protocol configuration
export const PROTOCOL_CONFIG = {
  name: 'Oracle Lend Protocol',
  version: '1.0.0',
  description: 'Advanced DeFi platform with lending, borrowing, and automated market maker',
  collateralizationRatio: 120, // 120% minimum collateral
  liquidationBonus: 10, // 10% bonus for liquidators
  tradingFee: 0.003, // 0.3% DEX fee
  supportedNetworks: [INTUITION_TESTNET.chainId, LOCAL_HARDHAT.chainId]
} as const

// Helper functions
export const getContractsForNetwork = (chainId: number) => {
  switch (chainId) {
    case INTUITION_TESTNET.chainId:
      return INTUITION_TESTNET.contracts
    case LOCAL_HARDHAT.chainId:
      return LOCAL_HARDHAT.contracts
    default:
      console.warn(`Unsupported network: ${chainId}`)
      return INTUITION_TESTNET.contracts // Fallback to testnet
  }
}

export const getTokensForNetwork = (chainId: number) => {
  const contracts = getContractsForNetwork(chainId)

  // Update token addresses based on network
  return {
    ...TOKENS,
    ORACLE: { ...TOKENS.ORACLE, address: contracts.oracleToken },
    INTUIT: { ...TOKENS.INTUIT, address: contracts.intuitToken },
    TSWP: { ...TOKENS.TSWP, address: contracts.tswpToken },
    PINTU: { ...TOKENS.PINTU, address: contracts.pintuToken },
  }
}

export const isNetworkSupported = (chainId: number): boolean => {
  return PROTOCOL_CONFIG.supportedNetworks.includes(chainId)
}

// Export types for TypeScript
export type TokenSymbol = keyof typeof TOKENS
export type SupportedChainId = typeof INTUITION_TESTNET.chainId | typeof LOCAL_HARDHAT.chainId