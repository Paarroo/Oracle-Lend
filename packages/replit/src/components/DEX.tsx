import React, { useState, useEffect, useCallback } from 'react'
import { useContract } from '../hooks/useContract'
import { useWallet } from '../hooks/useWallet'
import { SwapQuote } from '../types'
import { trackTransaction, initializeAnalytics } from '../utils/analyticsTracker'
import TokenIcon from './TokenIcon'
import ContractAddressLink from './ContractAddressLink'
import { ethers } from 'ethers'

import { INTUITION_TESTNET, TOKENS } from '../utils/constants'

// Token type from constants
type TokenSymbol = keyof typeof TOKENS

// Contract addresses from deployment
const CONTRACTS = {
  DEX: INTUITION_TESTNET.contracts.dex,
  DEX_INTUIT: INTUITION_TESTNET.contracts.dexIntuit,
  DEX_TSWP: INTUITION_TESTNET.contracts.dexTswp,
  DEX_PINTU: INTUITION_TESTNET.contracts.dexPintu,
  DEXRouter: INTUITION_TESTNET.contracts.dexRouter,
  OracleToken: INTUITION_TESTNET.contracts.oracleToken,
  IntuitToken: INTUITION_TESTNET.contracts.intuitToken,
  TswpToken: INTUITION_TESTNET.contracts.tswpToken,
  PintuToken: INTUITION_TESTNET.contracts.pintuToken
}

// Original DEX ABI for tTRUST/ORACLE pair
const DEX_ABI = [
  'function swapTrustForOracle(uint256 _amountIn, uint256 _minAmountOut) external payable',
  'function swapOracleForTrust(uint256 _amountIn, uint256 _minAmountOut) external',
  'function getAmountOut(address _tokenIn, uint256 _amountIn) external view returns (uint256 amountOut)',
  'function getPrice(address _token) external view returns (uint256 price)',
  'function getDEXStats() external view returns (uint256 _tTrustReserve, uint256 _oracleReserve, uint256 _totalVolume, uint256 _totalTrades, uint256 _totalLiquidity)',
  'function tTrustReserve() external view returns (uint256)',
  'function oracleReserve() external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function FEE_RATE() external view returns (uint256)'
]

// Generic DEX ABI for new token pairs (INTUIT, TSWP, PINTU)
// Based on the actual deployed contracts - they use generic names like "swapTrustForToken"
const NEW_DEX_ABI = [
  'function swapTrustForIntuit(uint256 _amountIn, uint256 _minAmountOut) external payable',
  'function swapIntuitForTrust(uint256 _amountIn, uint256 _minAmountOut) external',
  'function getAmountOut(address _tokenIn, uint256 _amountIn) external view returns (uint256 amountOut)',
  'function getPrice(address _token) external view returns (uint256 price)',
  'function getDEXStats() external view returns (uint256 _tTrustReserve, uint256 _intuitReserve, uint256 _totalVolume, uint256 _totalTrades, uint256 _totalLiquidity)',
  'function tTrustReserve() external view returns (uint256)',
  'function intuitReserve() external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function FEE_RATE() external view returns (uint256)'
]

// Individual DEX ABIs for each token pair - they have specific function names
const DEX_INTUIT_ABI = [
  'function swapTrustForIntuit(uint256 _amountIn, uint256 _minAmountOut) external payable',
  'function swapIntuitForTrust(uint256 _amountIn, uint256 _minAmountOut) external',
  'function getAmountOut(address _tokenIn, uint256 _amountIn) external view returns (uint256 amountOut)',
  'function getDEXStats() external view returns (uint256 _tTrustReserve, uint256 _intuitReserve, uint256 _totalVolume, uint256 _totalTrades, uint256 _totalLiquidity)'
]

const DEX_TSWP_ABI = [
  'function swapTrustForTswp(uint256 _amountIn, uint256 _minAmountOut) external payable',
  'function swapTswpForTrust(uint256 _amountIn, uint256 _minAmountOut) external',
  'function getAmountOut(address _tokenIn, uint256 _amountIn) external view returns (uint256 amountOut)',
  'function getDEXStats() external view returns (uint256 _tTrustReserve, uint256 _tswpReserve, uint256 _totalVolume, uint256 _totalTrades, uint256 _totalLiquidity)'
]

const DEX_PINTU_ABI = [
  'function swapTrustForPintu(uint256 _amountIn, uint256 _minAmountOut) external payable',
  'function swapPintuForTrust(uint256 _amountIn, uint256 _minAmountOut) external',
  'function getAmountOut(address _tokenIn, uint256 _amountIn) external view returns (uint256 amountOut)',
  'function getDEXStats() external view returns (uint256 _tTrustReserve, uint256 _pintuReserve, uint256 _totalVolume, uint256 _totalTrades, uint256 _totalLiquidity)'
]

// ERC20 Token ABI - for all tokens (ORACLE, INTUIT, TSWP, PINTU)
const ERC20_TOKEN_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)'
]

// Utility functions to determine correct DEX contract and methods
const getDEXContractInfo = (fromToken: TokenSymbol, toToken: TokenSymbol) => {
  // Always ensure tTRUST is one of the tokens (all pairs are with tTRUST)
  if (fromToken !== 'tTRUST' && toToken !== 'tTRUST') {
    throw new Error('All swaps must include tTRUST as one of the tokens')
  }

  // Determine the non-tTRUST token
  const otherToken = fromToken === 'tTRUST' ? toToken : fromToken

  switch (otherToken) {
    case 'ORACLE':
      return {
        contractAddress: CONTRACTS.DEX,
        abi: DEX_ABI,
        swapToTokenFunction: 'swapTrustForOracle',
        swapFromTokenFunction: 'swapOracleForTrust',
        tokenContract: CONTRACTS.OracleToken
      }
    case 'INTUIT':
      return {
        contractAddress: CONTRACTS.DEX_INTUIT,
        abi: DEX_INTUIT_ABI,
        swapToTokenFunction: 'swapTrustForIntuit',
        swapFromTokenFunction: 'swapIntuitForTrust',
        tokenContract: CONTRACTS.IntuitToken
      }
    case 'TSWP':
      return {
        contractAddress: CONTRACTS.DEX_TSWP,
        abi: DEX_TSWP_ABI,
        swapToTokenFunction: 'swapTrustForTswp',
        swapFromTokenFunction: 'swapTswpForTrust',
        tokenContract: CONTRACTS.TswpToken
      }
    case 'PINTU':
      return {
        contractAddress: CONTRACTS.DEX_PINTU,
        abi: DEX_PINTU_ABI,
        swapToTokenFunction: 'swapTrustForPintu',
        swapFromTokenFunction: 'swapPintuForTrust',
        tokenContract: CONTRACTS.PintuToken
      }
    default:
      throw new Error(`Unsupported token: ${otherToken}`)
  }
}

const DEX: React.FC = () => {
  const { isLoading: contractLoading } = useContract()
  const { isConnected, account, balance, isInitializing } = useWallet()
  
  const [fromToken, setFromToken] = useState<TokenSymbol>('tTRUST')
  const [toToken, setToToken] = useState<TokenSymbol>('ORACLE')
  const [fromAmount, setFromAmount] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [balances, setBalances] = useState<Record<TokenSymbol, string>>({
    tTRUST: '0',
    ORACLE: '0',
    INTUIT: '0',
    TSWP: '0',
    PINTU: '0'
  })
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [slippage, setSlippage] = useState(0.5) // Default 0.5% (min: 0.1%, max: 10% for security)
  const [showSlippageSettings, setShowSlippageSettings] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [dexStats, setDexStats] = useState({ 
    ethReserve: '0', 
    oracleReserve: '0', 
    totalVolume: '0', 
    totalTrades: '0', 
    totalLiquidity: '0',
    currentPrice: 0 // Dynamic price: 1 TTRUST = X ORACLE
  })
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false)

  // Check if user is on correct network
  const checkNetwork = useCallback(async (): Promise<boolean> => {
    if (!window.ethereum) return false
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const network = await provider.getNetwork()
      const isCorrect = Number(network.chainId) === INTUITION_TESTNET.chainId
      setIsCorrectNetwork(isCorrect)
      return isCorrect
    } catch (error) {
      console.error('Failed to check network:', error)
      setIsCorrectNetwork(false)
      return false
    }
  }, [])

  // Switch to Intuition Testnet
  const switchToIntuitionTestnet = async () => {
    if (!window.ethereum) return
    
    try {
      // Try to switch to the network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${INTUITION_TESTNET.chainId.toString(16)}` }],
      })
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${INTUITION_TESTNET.chainId.toString(16)}`,
              chainName: INTUITION_TESTNET.name,
              nativeCurrency: INTUITION_TESTNET.nativeCurrency,
              rpcUrls: [INTUITION_TESTNET.rpcUrl],
              blockExplorerUrls: [INTUITION_TESTNET.blockExplorer],
            }],
          })
        } catch (addError) {
          console.error('Failed to add network:', addError)
        }
      } else {
        console.error('Failed to switch network:', switchError)
      }
    }
  }

  // Fetch real balances and DEX stats
  const fetchBalances = async () => {
    if (!isConnected || !account || !window.ethereum || !isCorrectNetwork) {
      return
    }


    try {
      const provider = new ethers.BrowserProvider(window.ethereum)

      // Get native token balance (tTRUST on Intuition Testnet)
      const nativeBalance = await provider.getBalance(account)

      // Initialize all balances to 0
      const formattedBalances: Record<TokenSymbol, string> = {
        tTRUST: '0',
        ORACLE: '0',
        INTUIT: '0',
        TSWP: '0',
        PINTU: '0'
      }

      // Set native token balance
      formattedBalances.tTRUST = ethers.formatEther(nativeBalance)

      // Get ERC20 token balances for each token
      const tokenContracts = {
        ORACLE: CONTRACTS.OracleToken,
        INTUIT: CONTRACTS.IntuitToken,
        TSWP: CONTRACTS.TswpToken,
        PINTU: CONTRACTS.PintuToken
      }

      for (const [tokenSymbol, contractAddress] of Object.entries(tokenContracts)) {
        try {
          const tokenContract = new ethers.Contract(contractAddress, ORACLE_TOKEN_ABI, provider)
          const tokenBalance = await tokenContract.balanceOf(account)
          formattedBalances[tokenSymbol as TokenSymbol] = ethers.formatEther(tokenBalance)
        } catch (tokenError) {
          console.error(`Failed to fetch balance for ${tokenSymbol}:`, tokenError)
          formattedBalances[tokenSymbol as TokenSymbol] = '0'
        }
      }

      setBalances(formattedBalances)
    } catch (error) {
      console.error('Failed to fetch balances:', error)
    }
  }

  // Fetch AMM DEX stats
  const fetchDexStats = async () => {
    if (!window.ethereum) return
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const dexContract = new ethers.Contract(CONTRACTS.DEX, DEX_ABI, provider)
      
      // Get AMM stats
      const [tTrustReserve, oracleReserve, totalVolume, totalTrades, totalLiquidity] = await dexContract.getDEXStats()
      
      // Calculate current market price (1 TTRUST = X ORACLE)
      let currentPrice = 0
      const tTrustAmount = Number(ethers.formatEther(tTrustReserve))
      const oracleAmount = Number(ethers.formatEther(oracleReserve))
      
      if (tTrustAmount > 0 && oracleAmount > 0) {
        currentPrice = oracleAmount / tTrustAmount
      }
      
      setDexStats({
        ethReserve: ethers.formatEther(tTrustReserve),
        oracleReserve: ethers.formatEther(oracleReserve),
        totalVolume: ethers.formatEther(totalVolume),
        totalTrades: totalTrades.toString(),
        totalLiquidity: ethers.formatEther(totalLiquidity),
        currentPrice: currentPrice
      })
    } catch (error) {
      console.error('Failed to fetch AMM DEX stats:', error)
    }
  }

  // Initialize analytics and fetch data when wallet connects
  useEffect(() => {
    // Initialize analytics tracking
    try {
      initializeAnalytics()
    } catch (error) {
      console.error('Failed to initialize analytics:', error)
    }
    
    if (isConnected && account) {
      // Small delay to ensure wallet connection is fully established
      setTimeout(() => {
        checkNetwork().then(isCorrect => {
          if (isCorrect) {
            fetchBalances()
            fetchDexStats()
          }
        })
      }, 100)
    } else {
      setBalances({ tTRUST: '0', ORACLE: '0', INTUIT: '0', TSWP: '0', PINTU: '0' })
      setIsCorrectNetwork(false)
    }
  }, [isConnected, account, checkNetwork])

  // Also fetch balances when network status changes
  useEffect(() => {
    if (isConnected && account && isCorrectNetwork) {
      fetchBalances()
      fetchDexStats()
    }
  }, [isCorrectNetwork])

  // Listen for network changes
  useEffect(() => {
    if (window.ethereum) {
      const handleChainChanged = () => {
        checkNetwork()
      }
      
      window.ethereum.on('chainChanged', handleChainChanged)
      return () => window.ethereum.removeListener('chainChanged', handleChainChanged)
    }
    return undefined
  }, [checkNetwork])

  // Get real quote from appropriate DEX contract
  const getQuote = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0 || !window.ethereum || !isCorrectNetwork) {
      setToAmount('')
      setQuote(null)
      return
    }

    try {
      // Validate token pair (must include tTRUST)
      if (fromToken !== 'tTRUST' && toToken !== 'tTRUST') {
        console.error('All swaps must include tTRUST as one of the tokens')
        setToAmount('')
        setQuote(null)
        return
      }

      // Get the appropriate DEX contract info
      const dexInfo = getDEXContractInfo(fromToken, toToken)
      const provider = new ethers.BrowserProvider(window.ethereum)
      const dexContract = new ethers.Contract(dexInfo.contractAddress, dexInfo.abi, provider)

      const inputAmount = ethers.parseEther(fromAmount)

      // Use the contract's getAmountOut function for accurate quotes
      const tokenInAddress = fromToken === 'tTRUST'
        ? TOKENS.tTRUST.address
        : TOKENS[fromToken].address

      const amountOut = await dexContract.getAmountOut(tokenInAddress, inputAmount)
      const outputAmount = ethers.formatEther(amountOut)

      // Get current exchange rate for price impact calculation
      const otherToken = fromToken === 'tTRUST' ? toToken : fromToken
      const tokenPrices = {
        ORACLE: dexStats.currentPrice > 0 ? dexStats.currentPrice : 500000,
        INTUIT: 5,    // 1 tTRUST = 5 INTUIT (from config)
        TSWP: 2.5,    // 1 tTRUST = 2.5 TSWP (from config)
        PINTU: 0.5    // 1 tTRUST = 0.5 PINTU (from config)
      }

      const currentRate = tokenPrices[otherToken as keyof typeof tokenPrices] || 1
      const expectedOutput = fromToken === 'tTRUST'
        ? parseFloat(fromAmount) * currentRate
        : parseFloat(fromAmount) / currentRate

      const actualOutput = parseFloat(outputAmount)
      const priceImpact = expectedOutput > 0 ? Math.abs((expectedOutput - actualOutput) / expectedOutput) * 100 : 0

      setToAmount(outputAmount)
      setQuote({
        inputAmount: fromAmount,
        outputAmount: outputAmount,
        priceImpact: priceImpact,
        minimumReceived: (parseFloat(outputAmount) * (1 - slippage / 100)).toFixed(6),
        exchangeRate: fromToken === 'tTRUST' ? currentRate : 1 / currentRate
      })
    } catch (error) {
      console.error('Failed to get quote:', error)
      setToAmount('')
      setQuote(null)
    }
  }

  // Calculate quote when amounts change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      getQuote()
    }, 500) // Debounce API calls
    
    return () => clearTimeout(timeoutId)
  }, [fromAmount, fromToken, toToken, slippage, dexStats])

  const handleSwapTokens = () => {
    setFromToken(toToken)
    setToToken(fromToken)
    setFromAmount(toAmount)
    setToAmount(fromAmount)
  }

  const handleSwap = async () => {
    if (!quote || !isConnected || !account || !window.ethereum) return

    setIsLoading(true)

    try {
      // Validate token pair
      if (fromToken !== 'tTRUST' && toToken !== 'tTRUST') {
        throw new Error('All swaps must include tTRUST as one of the tokens')
      }

      // Get the appropriate DEX contract info
      const dexInfo = getDEXContractInfo(fromToken, toToken)
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const dexContract = new ethers.Contract(dexInfo.contractAddress, dexInfo.abi, signer)

      const inputAmount = ethers.parseEther(fromAmount)
      const minAmountOut = ethers.parseEther(quote.minimumReceived)

      let tx

      if (fromToken === 'tTRUST') {
        // tTRUST → Token swap (native to ERC20)
        // Send native token via msg.value
        const swapFunction = dexInfo.swapToTokenFunction
        tx = await dexContract[swapFunction](0, minAmountOut, {
          value: inputAmount, // Native token sent via value
          gasLimit: 300000
        })
      } else {
        // Token → tTRUST swap (ERC20 to native)
        // First check/approve ERC20 allowance
        const tokenContract = new ethers.Contract(dexInfo.tokenContract, ERC20_TOKEN_ABI, signer)
        const allowance = await tokenContract.allowance(account, dexInfo.contractAddress)

        if (allowance < inputAmount) {
          console.log(`Approving ${fromToken} tokens for DEX...`)
          const approveTx = await tokenContract.approve(dexInfo.contractAddress, inputAmount)
          await approveTx.wait()
          console.log(`${fromToken} tokens approved successfully`)
        }

        // Swap ERC20 for native token
        const swapFunction = dexInfo.swapFromTokenFunction
        tx = await dexContract[swapFunction](inputAmount, minAmountOut, {
          gasLimit: 300000
        })
      }

      console.log(`Swap transaction submitted: ${tx.hash}`)

      // Wait for transaction confirmation
      const receipt = await tx.wait()
      console.log(`Swap confirmed in block ${receipt.blockNumber}`)

      // Track swap transaction for analytics
      try {
        if (account && receipt.hash) {
          // Track volume as the TTRUST amount involved in the swap
          const volumeTTRUST = fromToken === 'tTRUST' ? fromAmount : toAmount
          trackTransaction(
            receipt.hash,
            'swap',
            account,
            `${fromToken}→${toToken}`,
            `${fromAmount} ${fromToken}`,
            volumeTTRUST
          )
        }
      } catch (analyticsError) {
        console.error('Analytics tracking failed:', analyticsError)
      }

      // Success notification
      if (typeof window !== 'undefined' && (window as any).showNotification) {
        (window as any).showNotification('success', `Successfully swapped ${fromAmount} ${fromToken} for ${quote.outputAmount} ${toToken}`, receipt.hash)
      }

      // Reset form and refresh data
      setFromAmount('')
      setToAmount('')
      setQuote(null)

      // Refresh balances and DEX stats
      await fetchBalances()
      await fetchDexStats()

    } catch (error: any) {
      console.error('Swap error:', error)
      
      if (error.code === 4001 || error.message.includes('rejected')) {
        if (typeof window !== 'undefined' && (window as any).showNotification) {
          (window as any).showNotification('rejected', 'Transaction was rejected by user')
        }
      } else {
        if (typeof window !== 'undefined' && (window as any).showNotification) {
          (window as any).showNotification('error', error.message || 'Swap failed unexpectedly')
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  const getTokenInfo = (token: TokenSymbol) => {
    const tokenData = TOKENS[token]

    // For now, simplified pricing (would need real DEX price calculation)
    const ttrustPrice = 2500 // Base TTRUST price in USD
    const tokenPrices: Record<TokenSymbol, number> = {
      tTRUST: ttrustPrice,
      ORACLE: dexStats.currentPrice > 0 ? ttrustPrice / dexStats.currentPrice : 0.005,
      INTUIT: 0.01, // Example price
      TSWP: 0.05,   // Example price
      PINTU: 0.10   // Example price
    }

    return {
      name: tokenData.name,
      symbol: tokenData.symbol,
      icon: typeof tokenData.icon === 'string' && tokenData.icon.length <= 2 ?
        tokenData.icon : <TokenIcon token="ORACLE" size="sm" />,
      price: `${tokenPrices[token].toLocaleString('en-US', {
        minimumFractionDigits: token === 'tTRUST' ? 2 : 4,
        maximumFractionDigits: token === 'tTRUST' ? 2 : 4
      })}`
    }
  }

  // For dropdown options (text only)
  const getTokenTextIcon = (token: TokenSymbol) => {
    const tokenData = TOKENS[token]
    // Use emoji icons for all tokens in dropdown
    if (typeof tokenData.icon === 'string' && tokenData.icon.length <= 2) {
      return tokenData.icon
    }
    // For ORACLE with image, use eye emoji
    if (token === 'ORACLE') {
      return '👁️'
    }
    // Default to first letter
    return tokenData.symbol.charAt(0)
  }

  const slippageOptions = [0.1, 0.5, 1.0, 2.0]

  // Calculate volume in USD for analytics
  const calculateVolumeUSD = (token: string, amount: string) => {
    const amountFloat = parseFloat(amount)
    const prices = {
      TTRUST: 2500,
      ORACLE: dexStats.currentPrice > 0 ? 2500 / dexStats.currentPrice : 0.005
    }
    const price = prices[token as keyof typeof prices] || 0
    return (amountFloat * price).toFixed(2)
  }

  return (
    <div className="space-y-6 sm:space-y-8 p-4 sm:p-6">

      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text mb-2 sm:mb-4">Token Swap</h1>
        <p className="text-sm sm:text-base text-gray-400">Live market rates with real-time fluctuation</p>
      </div>

      {isInitializing && (
        <div className="glass-effect rounded-xl p-8 border border-blue-500/30 text-center">
          <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h3 className="text-xl font-bold text-white mb-2">Checking Wallet Connection</h3>
          <p className="text-gray-400">Please wait while we check for existing wallet connections...</p>
        </div>
      )}

      {!isInitializing && !isConnected && (
        <div className="flex justify-center pt-24 pb-16">
          <div className="glass-effect rounded-xl p-8 border border-yellow-500/30 text-center max-w-md">
            <i className="fas fa-wallet text-yellow-400 text-4xl mb-4"></i>
            <h3 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h3>
            <p className="text-gray-400">Please connect your wallet to start trading.</p>
          </div>
        </div>
      )}

      {isConnected && !isCorrectNetwork && (
        <div className="glass-effect rounded-xl p-8 border border-red-500/30 text-center">
          <i className="fas fa-exclamation-triangle text-red-400 text-4xl mb-4"></i>
          <h3 className="text-xl font-bold text-white mb-2">Wrong Network</h3>
          <p className="text-gray-400 mb-4">Please switch to Intuition Testnet to use this DEX.</p>
          <button
            onClick={switchToIntuitionTestnet}
            className="btn-primary px-6 py-3 rounded-lg font-medium"
          >
            Switch to Intuition Testnet
          </button>
        </div>
      )}

      {isConnected && isCorrectNetwork && (
        <>
          {/* Token Balances */}
          <div className="glass-effect rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center">
                <i className="fas fa-wallet text-green-400 mr-3"></i>
                Your Balances
              </h2>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    fetchBalances()
                    fetchDexStats()
                  }}
                  className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 glass-effect border border-gray-600/50 rounded-lg text-gray-400 hover:text-white hover:border-green-500/50 transition-all min-h-[44px]"
                  title="Refresh balances"
                >
                  <i className="fas fa-sync-alt"></i>
                  <span className="text-sm">Refresh</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {(Object.keys(TOKENS) as TokenSymbol[]).map((token) => {
                const info = getTokenInfo(token)
                return (
                  <div key={token} className="glass-effect rounded-lg p-4 border border-gray-600/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {token === 'ORACLE' ? (
                          <TokenIcon token="ORACLE" size="lg" />
                        ) : (
                          <span className="text-2xl">{info.icon}</span>
                        )}
                        <div>
                          <h3 className="font-bold text-white">{info.symbol}</h3>
                          <p className="text-sm text-gray-400 truncate">{info.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">
                          {parseFloat(balances[token]) === 0 ? '0' : parseFloat(balances[token]).toFixed(4)} {token}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Swap Interface */}
          <div className="max-w-full sm:max-w-md mx-auto">
            <div className="glass-effect rounded-xl p-6 border border-gray-700/50">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white tracking-wide">Swap Tokens</h2>
                <div className="relative">
                  <button 
                    onClick={() => setShowSlippageSettings(!showSlippageSettings)}
                    className="flex items-center space-x-2 px-3 py-2 glass-effect border border-purple-500/30 rounded-lg text-slate-200 hover:text-cyan-300 hover:border-cyan-400/50 transition-all font-medium"
                  >
                    <i className="fas fa-cog"></i>
                    <span className="text-sm">Settings</span>
                  </button>
                  
                  {showSlippageSettings && (
                    <div className="fixed sm:absolute inset-x-4 sm:inset-x-auto sm:right-0 top-20 sm:top-12 w-auto sm:w-64 glass-effect border border-gray-600/50 rounded-lg p-4 z-30">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-medium text-white">Slippage Tolerance</h3>
                        <button 
                          onClick={() => setShowSlippageSettings(false)}
                          className="text-gray-400 hover:text-white"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-1 sm:gap-2 mb-3">
                        {slippageOptions.map((option) => (
                          <button
                            key={option}
                            onClick={() => setSlippage(option)}
                            className={`px-2 py-1.5 text-xs rounded transition-colors min-h-[44px] sm:min-h-0 ${
                              slippage === option
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            {option}%
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={slippage}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0.5;
                            // Security: Limit slippage between 0.1% and 10% to prevent exploitation
                            const safeSlippage = Math.min(Math.max(0.1, value), 10);
                            setSlippage(safeSlippage);
                          }}
                          step="0.1"
                          min="0.1"
                          max="10"
                          className="flex-1 px-3 py-2 sm:px-2 sm:py-1.5 text-sm sm:text-xs bg-gray-800 border border-gray-600 rounded text-white focus:border-purple-500 outline-none min-h-[44px] sm:min-h-0"
                          placeholder="Custom"
                        />
                        <span className="text-xs text-gray-400">%</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Higher slippage = higher chance of success, but worse price
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* From Token */}
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm text-slate-200 font-medium">From</label>
                    <span className="text-xs text-slate-300 font-medium">
                      Balance: {parseFloat(balances[fromToken]).toFixed(4)}
                    </span>
                  </div>
                  <div className="glass-effect rounded-lg p-4 sm:p-5 border border-gray-600/30">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={fromAmount}
                        onChange={(e) => {
                          const value = e.target.value
                          if (value === '' || parseFloat(value) >= 0) {
                            setFromAmount(value)
                          }
                        }}
                        placeholder="0.00"
                        className="bg-transparent text-lg sm:text-xl font-semibold text-white placeholder-slate-400 flex-1 outline-none w-full py-2"
                      />
                      <div className="relative">
                        <select
                          value={fromToken}
                          onChange={(e) => setFromToken(e.target.value as TokenSymbol)}
                          className="appearance-none glass-effect rounded-lg pl-2 pr-10 py-1 text-lg sm:text-xl text-white font-semibold cursor-pointer hover:border-cyan-400/50 transition-all duration-200 border border-purple-500/30 focus:border-cyan-400/70 outline-none min-h-[44px]"
                        >
                          {(Object.keys(TOKENS) as TokenSymbol[]).map((token) => (
                            <option key={token} value={token} className="bg-gray-800">
                              {`${getTokenTextIcon(token)} ${token}`}
                            </option>
                          ))}
                        </select>
                        <i className="fas fa-chevron-down absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 sm:gap-3">
                      <button
                        onClick={() => setFromAmount((parseFloat(balances[fromToken]) * 0.25).toString())}
                        className="py-3 px-2 text-xs font-semibold text-cyan-300 hover:text-white rounded-xl glass-effect border border-cyan-500/40 hover:border-cyan-400/70 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-400/30 min-h-[44px]"
                      >
                        25%
                      </button>
                      <button
                        onClick={() => setFromAmount((parseFloat(balances[fromToken]) * 0.5).toString())}
                        className="py-3 px-2 text-xs font-semibold text-cyan-300 hover:text-white rounded-xl glass-effect border border-cyan-500/40 hover:border-cyan-400/70 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-400/30 min-h-[44px]"
                      >
                        50%
                      </button>
                      <button
                        onClick={() => setFromAmount((parseFloat(balances[fromToken]) * 0.75).toString())}
                        className="py-3 px-2 text-xs font-semibold text-cyan-300 hover:text-white rounded-xl glass-effect border border-cyan-500/40 hover:border-cyan-400/70 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-400/30 min-h-[44px]"
                      >
                        75%
                      </button>
                      <button
                        onClick={() => setFromAmount(balances[fromToken])}
                        className="py-3 px-2 text-xs font-semibold text-cyan-300 hover:text-white rounded-xl glass-effect border border-cyan-500/40 hover:border-cyan-400/70 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-400/30 min-h-[44px]"
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                </div>

                {/* Swap Button */}
                <div className="flex justify-center">
                  <button
                    onClick={handleSwapTokens}
                    className="w-12 h-12 rounded-full glass-effect border-2 border-cyan-500/40 hover:border-cyan-400/70 text-cyan-300 hover:text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-cyan-400/30 font-medium"
                  >
                    <i className="fas fa-arrow-down"></i>
                  </button>
                </div>

                {/* To Token */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm text-slate-200 font-medium">To</label>
                    <span className="text-xs text-slate-300 font-medium">
                      Balance: {parseFloat(balances[toToken]).toFixed(4)}
                    </span>
                  </div>
                  <div className="glass-effect rounded-lg p-4 sm:p-5 border border-gray-600/30">
                    <div className="flex items-center justify-between gap-3">
                      <input
                        type="number"
                        value={toAmount}
                        readOnly
                        placeholder="0.00"
                        className="bg-transparent text-lg sm:text-xl font-semibold text-white placeholder-slate-400 flex-1 outline-none w-full py-2"
                      />
                      <div className="relative">
                        <select
                          value={toToken}
                          onChange={(e) => setToToken(e.target.value as TokenSymbol)}
                          className="appearance-none glass-effect rounded-lg pl-2 pr-10 py-1 text-lg sm:text-xl text-white font-semibold cursor-pointer hover:border-cyan-400/50 transition-all duration-200 border border-purple-500/30 focus:border-cyan-400/70 outline-none min-h-[44px]"
                        >
                          {(Object.keys(TOKENS) as TokenSymbol[]).map((token) => (
                            <option key={token} value={token} className="bg-gray-800">
                              {`${getTokenTextIcon(token)} ${token}`}
                            </option>
                          ))}
                        </select>
                        <i className="fas fa-chevron-down absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Swap Details */}
                {quote && (
                  <div className="glass-effect rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Exchange Rate:</span>
                      <span className="text-white">
                        1 {fromToken} = {quote.exchangeRate.toFixed(fromToken === 'TTRUST' ? 0 : 6)} {toToken}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Price Impact:</span>
                      <span className={`${quote.priceImpact < 1 ? 'text-green-400' : quote.priceImpact < 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {quote.priceImpact.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Minimum Received:</span>
                      <span className="text-white">{quote.minimumReceived} {toToken}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Slippage Tolerance:</span>
                      <span className="text-white">{slippage}%</span>
                    </div>
                  </div>
                )}

                {/* Swap Button */}
                <button
                  onClick={handleSwap}
                  disabled={!fromAmount || !toAmount || !quote || isLoading || fromToken === toToken}
                  className={`w-full py-3 sm:py-4 px-4 sm:px-6 rounded-xl font-medium text-base sm:text-lg transition-all duration-300 min-h-[44px] ${
                    !fromAmount || !toAmount || !quote || isLoading || fromToken === toToken
                      ? 'glass-effect text-slate-500 cursor-not-allowed border border-slate-700/50'
                      : 'bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-700 hover:to-cyan-700 text-slate-100 shadow-lg hover:shadow-cyan-500/25 border border-cyan-500/30'
                  } flex items-center justify-center space-x-2`}
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                      <span>Swapping...</span>
                    </>
                  ) : fromToken === toToken ? (
                    <span>Select Different Tokens</span>
                  ) : !fromAmount || !toAmount ? (
                    <span>Enter Amount</span>
                  ) : (
                    <>
                      <i className="fas fa-exchange-alt"></i>
                      <span>Swap {fromToken} for {toToken}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Live Token Rates */}
          <div className="glass-effect rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex flex-wrap items-center gap-2">
              <i className="fas fa-chart-line text-green-400 mr-3"></i>
              Live Token Rates
              <span className="ml-2 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
                <i className="fas fa-circle animate-pulse mr-1"></i>
                LIVE
              </span>
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="glass-effect rounded-lg p-3 sm:p-4 border border-gray-600/30">
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl mb-2 flex items-center justify-center space-x-2">
                    <span>⚡</span>
                    <span className="text-blue-400 font-bold">→</span>
                    <TokenIcon token="ORACLE" size="lg" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white mb-1">TTRUST to ORACLE</h3>
                  <p className="text-xl sm:text-2xl font-bold text-green-400">
                    1 : {dexStats.currentPrice > 0 ? dexStats.currentPrice.toFixed(0) : '500,000'}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    1 TTRUST = {dexStats.currentPrice > 0 ? dexStats.currentPrice.toFixed(0) : '500,000'} ORACLE
                  </p>
                </div>
              </div>
              
              <div className="glass-effect rounded-lg p-3 sm:p-4 border border-gray-600/30">
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl mb-2 flex items-center justify-center space-x-2">
                    <TokenIcon token="ORACLE" size="lg" />
                    <span className="text-blue-400 font-bold">→</span>
                    <span>⚡</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white mb-1">ORACLE to TTRUST</h3>
                  <p className="text-xl sm:text-2xl font-bold text-cyan-400">
                    {dexStats.currentPrice > 0 ? dexStats.currentPrice.toFixed(0) : '500,000'} : 1
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    {dexStats.currentPrice > 0 ? dexStats.currentPrice.toFixed(0) : '500,000'} ORACLE = 1 TTRUST
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <div className="flex items-start space-x-3">
                <i className="fas fa-pool text-blue-400 mt-1"></i>
                <div className="text-sm">
                  <h4 className="text-blue-300 font-medium mb-2">AMM Liquidity Pool</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-gray-300">
                    <div>
                      <p className="text-blue-200">TTRUST Reserve:</p>
                      <p className="font-mono">{parseFloat(dexStats.ethReserve).toFixed(4)} TTRUST</p>
                    </div>
                    <div>
                      <p className="text-blue-200">ORACLE Reserve:</p>
                      <p className="font-mono">{parseFloat(dexStats.oracleReserve).toLocaleString()} ORACLE</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-gray-300 mt-2">
                    <div>
                      <p className="text-blue-200">Total Volume:</p>
                      <p className="font-mono">{parseFloat(dexStats.totalVolume).toFixed(2)} TTRUST</p>
                    </div>
                    <div>
                      <p className="text-blue-200">Total Trades:</p>
                      <p className="font-mono">{dexStats.totalTrades}</p>
                    </div>
                  </div>
                  <p className="text-gray-300 mt-2">
                    Real AMM liquidity with dynamic pricing. Native TTRUST ↔ ERC20 ORACLE using constant product formula (x × y = k).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Contract Information */}
          <div className="glass-effect rounded-xl p-4 sm:p-6 border border-gray-700/50">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 flex items-center">
              <i className="fas fa-file-contract text-purple-400 mr-3"></i>
              Contract Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-semibold text-white flex items-center">
                  <i className="fas fa-exchange-alt text-blue-400 mr-2"></i>
                  Active DEX Contract
                </h3>
                <div className="space-y-3">
                  {(() => {
                    const dexInfo = getDEXContractInfo(fromToken, toToken);
                    const pairName = fromToken === 'tTRUST' && toToken === 'ORACLE' ? 'tTRUST/ORACLE' :
                                   fromToken === 'tTRUST' && toToken === 'INTUIT' ? 'tTRUST/INTUIT' :
                                   fromToken === 'tTRUST' && toToken === 'TSWP' ? 'tTRUST/TSWP' :
                                   fromToken === 'tTRUST' && toToken === 'PINTU' ? 'tTRUST/PINTU' :
                                   `${fromToken}/${toToken}`;

                    return (
                      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/30">
                        <div className="mb-3">
                          <span className="text-sm text-gray-400">Trading Pair:</span>
                          <p className="text-lg font-bold text-white">{pairName}</p>
                        </div>
                        <ContractAddressLink
                          address={dexInfo.contractAddress}
                          label="DEX Contract"
                          className="text-sm"
                        />
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-semibold text-white flex items-center">
                  <i className="fas fa-coins text-green-400 mr-2"></i>
                  Token Contracts
                </h3>
                <div className="space-y-3">
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/30">
                    <div className="space-y-2">
                      <ContractAddressLink
                        address={TOKENS[fromToken].address}
                        label={`${fromToken} Token`}
                        className="text-sm"
                      />
                      <ContractAddressLink
                        address={TOKENS[toToken].address}
                        label={`${toToken} Token`}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
              <div className="flex items-start space-x-3">
                <i className="fas fa-info-circle text-purple-400 mt-1"></i>
                <div className="text-sm text-gray-300">
                  <p className="font-medium text-purple-300 mb-1">Contract Verification</p>
                  <p>All contracts are deployed on Intuition Testnet and verified on the explorer. Click any address to view source code, transactions, and contract details.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Discord Link */}
          <div className="text-center py-8">
            <a
              href="https://discord.com/invite/0xintuition"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-3 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors duration-200 shadow-lg hover:shadow-indigo-500/25"
            >
              <i className="fab fa-discord text-xl"></i>
              <span>Join Intuition Discord</span>
              <i className="fas fa-external-link-alt text-sm opacity-75"></i>
            </a>
          </div>

        </>
      )}
    </div>
  )
}

export default DEX
