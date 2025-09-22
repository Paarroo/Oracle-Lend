import React, { useState, useEffect } from 'react'
import { useContract } from '../hooks/useContract'
import TokenIcon from './TokenIcon'
import ContractAddressLink from './ContractAddressLink'
import { INTUITION_TESTNET } from '../utils/constants'

const Analytics: React.FC = () => {
  const { 
    protocolStats, 
    isLoading, 
    oracleTokenContract, 
    oracleLendContract,
    dexContract,
    isConnected 
  } = useContract()
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('24h')
  const [realTimeData, setRealTimeData] = useState({
    totalTVL: { tTRUST: '0', ORACLE: '0', usd: '0' },
    totalTransactions: 0,
    volume24h: '0',
    dexReserves: { tTRUST: '0', ORACLE: '0' },
    lendingStats: { totalCollateral: '0', totalBorrowed: '0', oracleBalance: '0' }
  })
  const [dataLoading, setDataLoading] = useState(true)

  // Fetch real-time data from contracts
  useEffect(() => {
    const fetchRealTimeData = async () => {

      if (!dexContract || !oracleTokenContract || !oracleLendContract || !isConnected) {
        setDataLoading(false)
        return
      }

      try {
        setDataLoading(true)

        // Get DEX reserves with error handling
        let dexTTrust = 0
        let dexOracle = 0
        
        try {
          const tTrustReserve = await dexContract.tTrustReserve()
          const oracleReserve = await dexContract.oracleReserve()
          
          dexTTrust = Number(tTrustReserve) / 1e18
          dexOracle = Number(oracleReserve) / 1e18
          
        } catch (dexError) {
          console.error('❌ DEX reserves error:', dexError)
        }

        // Get lending protocol balances
        let lendingTTrust = 0
        let lendingOracle = 0
        
        try {
          const ethBalance = await oracleLendContract.getContractETHBalance()
          const oracleBalance = await oracleLendContract.getContractOracleBalance()
          
          lendingTTrust = Number(ethBalance) / 1e18
          lendingOracle = Number(oracleBalance) / 1e18
          
        } catch (lendingError) {
          console.error('❌ Lending balances error:', lendingError)
        }

        // Calculate totals
        const totalTTrust = dexTTrust + lendingTTrust
        const totalOracle = dexOracle + lendingOracle
        

        // Get current price for USD calculation
        let currentPrice = 500000 // Default fallback
        try {
          const price = await oracleLendContract.getCurrentPrice()
          currentPrice = Number(price) / 1e18
        } catch (priceError) {
          console.error('❌ Price error:', priceError)
        }

        // Calculate USD value (approximate)
        const ttrust_usd_price = 2500 // Approximate TTRUST price in USD
        const oracle_usd_price = ttrust_usd_price / currentPrice // ORACLE price in USD
        const totalUSD = (totalTTrust * ttrust_usd_price + totalOracle * oracle_usd_price)

        const newData = {
          totalTVL: {
            tTRUST: totalTTrust.toFixed(2),
            ORACLE: totalOracle.toFixed(0),
            usd: totalUSD.toFixed(2)
          },
          totalTransactions: 0, // Would need event tracking
          volume24h: '0', // Would need event tracking  
          dexReserves: {
            tTRUST: dexTTrust.toFixed(2),
            ORACLE: dexOracle.toFixed(0)
          },
          lendingStats: {
            totalCollateral: lendingTTrust.toFixed(2),
            totalBorrowed: '0', // Would need tracking
            oracleBalance: lendingOracle.toFixed(0)
          }
        }

        setRealTimeData(newData)

      } catch (error) {
        console.error('❌ Error fetching real-time data:', error)
      } finally {
        setDataLoading(false)
      }
    }

    fetchRealTimeData()
    
    // Update every 30 seconds
    const interval = setInterval(fetchRealTimeData, 30000)
    return () => clearInterval(interval)
    
  }, [dexContract, oracleTokenContract, oracleLendContract, isConnected])

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  const formatCurrency = (value: string, decimals: number = 2) => {
    return parseFloat(value).toLocaleString(undefined, { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    })
  }

  const formatInteger = (value: string) => {
    return parseInt(parseFloat(value).toString()).toLocaleString()
  }

  const formatSmartPrecision = (value: string | number, significantDigits: number = 3) => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (num === 0) return '0'
    
    // For very small numbers, use significant digits after first non-zero
    if (Math.abs(num) < 1) {
      // Find the position of the first non-zero digit after decimal
      const str = num.toExponential()
      const [mantissa, exponent] = str.split('e')
      const exp = parseInt(exponent)
      
      if (exp < 0) {
        // Calculate decimal places needed for 3 significant digits
        const decimalPlaces = Math.abs(exp) + significantDigits - 1
        return num.toFixed(decimalPlaces)
      }
    }
    
    // For larger numbers, use regular precision
    if (Math.abs(num) >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (Math.abs(num) >= 1000) {
      return (num / 1000).toFixed(1) + 'K'  
    }
    if (Math.abs(num) >= 1) {
      return num.toFixed(2)
    }
    
    return num.toString()
  }

  // Calculate current price for display
  const currentPriceNum = parseFloat(protocolStats.currentPrice) / 1e18 || 0
  const currentPriceFormatted = formatNumber(currentPriceNum)

  const mainMetrics = [
    {
      title: 'Primary Pool Price',
      value: `1 tTRUST = ${formatCurrency(currentPriceNum.toString())} ORACLE`,
      change: null,
      icon: 'fas fa-chart-line',
      color: 'text-green-400',
      subtitle: `Main trading pair (tTRUST/ORACLE)`
    },
    {
      title: 'Main Pool Liquidity',
      value: `${formatCurrency(realTimeData.dexReserves.tTRUST)} tTRUST`,
      change: null,
      icon: 'fas fa-exchange-alt',
      color: 'text-blue-400',
      subtitle: `${formatInteger(realTimeData.dexReserves.ORACLE)} ORACLE`
    },
    {
      title: 'Primary Lending Pool',
      value: `${formatCurrency(realTimeData.lendingStats.totalCollateral)} tTRUST`,
      change: null,
      icon: 'fas fa-university',
      color: 'text-purple-400',
      subtitle: `${formatInteger(realTimeData.lendingStats.oracleBalance)} ORACLE available`
    }
  ]

  const protocolStatsData = [
    {
      category: 'Primary Lending Pool',
      stats: [
        { label: 'tTRUST Collateral', value: `${formatCurrency(realTimeData.lendingStats.totalCollateral)} tTRUST`, icon: '⚡' },
        { label: 'ORACLE Available', value: `${formatInteger(realTimeData.lendingStats.oracleBalance)} ORACLE`, icon: <TokenIcon token="ORACLE" size="sm" /> },
        { label: 'Exchange Rate', value: `${formatNumber(parseFloat(protocolStats.currentPrice) / 1e18)} ORACLE/tTRUST`, icon: '💰' },
        { label: 'Collateral Ratio', value: '120%', icon: '🛡️' }
      ]
    },
    {
      category: 'Main DEX Pool',
      stats: [
        { label: 'tTRUST Reserve', value: `${formatCurrency(realTimeData.dexReserves.tTRUST)} tTRUST`, icon: '⚡' },
        { label: 'ORACLE Reserve', value: `${formatInteger(realTimeData.dexReserves.ORACLE)} ORACLE`, icon: <TokenIcon token="ORACLE" size="sm" /> },
        { label: 'Pool Type', value: 'AMM (x*y=k)', icon: '🔄' },
        { label: 'Pool Status', value: 'Active', icon: '✅' }
      ]
    }
  ]



  return (
    <div className="space-y-6 sm:space-y-8 p-4 sm:p-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold gradient-text mb-2 sm:mb-4">Protocol Analytics</h1>
        <p className="text-sm sm:text-base lg:text-lg text-gray-400">Real-time data from Oracle Lend Protocol</p>
        
        {/* Debug Status */}
        <div className="mt-4 p-2 sm:p-3 glass-effect rounded-lg text-xs sm:text-sm">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-gray-400">
            <span className={`flex items-center ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            <span className={`flex items-center ${dexContract ? 'text-green-400' : 'text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${dexContract ? 'bg-green-400' : 'bg-red-400'}`}></div>
              DEX Contract
            </span>
            <span className={`flex items-center ${oracleLendContract ? 'text-green-400' : 'text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${oracleLendContract ? 'bg-green-400' : 'bg-red-400'}`}></div>
              Lending Contract
            </span>
            <span className={`flex items-center ${dataLoading ? 'text-yellow-400' : 'text-gray-400'}`}>
              {dataLoading && <div className="w-2 h-2 rounded-full mr-2 bg-yellow-400 animate-pulse"></div>}
              {dataLoading ? 'Loading...' : 'Ready'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {mainMetrics.map((metric, index) => (
          <div key={index} className="glass-effect rounded-xl p-4 sm:p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br ${metric.color} bg-opacity-20 flex items-center justify-center`}>
                <i className={`${metric.icon} ${metric.color} text-lg sm:text-xl`}></i>
              </div>
              {metric.change && <span className="text-green-400 text-sm font-medium">{metric.change}</span>}
            </div>
            <h3 className="text-gray-400 text-xs sm:text-sm mb-1 sm:mb-2">{metric.title}</h3>
            <p className="text-lg sm:text-xl font-bold text-white mb-1 sm:mb-2">
              {dataLoading ? (
                <div className="animate-pulse bg-gray-700 h-6 w-32 rounded"></div>
              ) : (
                metric.value
              )}
            </p>
            <p className="text-base sm:text-lg font-bold text-gray-300">{metric.subtitle}</p>
          </div>
        ))}
      </div>


  

      {/* Protocol Information */}
      <div className="glass-effect rounded-xl p-4 sm:p-6 border border-gray-700/50">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 flex items-center">
          <i className="fas fa-info-circle text-blue-400 mr-3"></i>
          Protocol Overview
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-3">
            <h3 className="text-base sm:text-lg font-semibold text-white">🏦 Lending Protocol</h3>
            <ul className="text-gray-300 text-xs sm:text-sm space-y-1 sm:space-y-2">
              <li>• Over-collateralized lending (120% ratio)</li>
              <li>• Multi-token support (tTRUST, ORACLE, INTUIT, TSWP, PINTU)</li>
              <li>• 10% liquidation bonus for liquidators</li>
              <li>• Real-time price discovery via DEX</li>
            </ul>
          </div>
          
          <div className="space-y-3">
            <h3 className="text-base sm:text-lg font-semibold text-white">🔄 DEX (AMM)</h3>
            <ul className="text-gray-300 text-xs sm:text-sm space-y-1 sm:space-y-2">
              <li>• Constant product formula (x * y = k)</li>
              <li>• Multiple trading pairs (tTRUST/ORACLE, INTUIT, TSWP, PINTU)</li>
              <li>• Serves as price oracle for lending</li>
              <li>• Multi-token ecosystem support</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Protocol Contracts */}
      <div className="glass-effect rounded-xl p-4 sm:p-6 border border-gray-700/50">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 flex items-center">
          <i className="fas fa-file-contract text-purple-400 mr-3"></i>
          Protocol Contracts
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/30">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <i className="fas fa-university text-green-400"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Lending Protocol</h3>
                <p className="text-xs text-gray-400">Core lending contract</p>
              </div>
            </div>
            <ContractAddressLink
              address={INTUITION_TESTNET.contracts.oracleLend}
              label="OracleLend"
              className="text-sm"
            />
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/30">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <i className="fas fa-exchange-alt text-blue-400"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Main DEX</h3>
                <p className="text-xs text-gray-400">tTRUST/ORACLE pair</p>
              </div>
            </div>
            <ContractAddressLink
              address={INTUITION_TESTNET.contracts.dex}
              label="DEX Contract"
              className="text-sm"
            />
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/30">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <TokenIcon token="ORACLE" size="sm" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">ORACLE Token</h3>
                <p className="text-xs text-gray-400">Primary borrowable asset</p>
              </div>
            </div>
            <ContractAddressLink
              address={INTUITION_TESTNET.contracts.oracleToken}
              label="Token Contract"
              className="text-sm"
            />
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/30">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <TokenIcon token="INTUIT" size="sm" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">INTUIT DEX</h3>
                <p className="text-xs text-gray-400">tTRUST/INTUIT pair</p>
              </div>
            </div>
            <ContractAddressLink
              address={INTUITION_TESTNET.contracts.dexIntuit}
              label="DEX Contract"
              className="text-sm"
            />
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/30">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <TokenIcon token="TSWP" size="sm" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">TSWP DEX</h3>
                <p className="text-xs text-gray-400">tTRUST/TSWP pair</p>
              </div>
            </div>
            <ContractAddressLink
              address={INTUITION_TESTNET.contracts.dexTswp}
              label="DEX Contract"
              className="text-sm"
            />
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/30">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center">
                <TokenIcon token="PINTU" size="sm" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">PINTU DEX</h3>
                <p className="text-xs text-gray-400">tTRUST/PINTU pair</p>
              </div>
            </div>
            <ContractAddressLink
              address={INTUITION_TESTNET.contracts.dexPintu}
              label="DEX Contract"
              className="text-sm"
            />
          </div>
        </div>

        <div className="mt-4 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
          <div className="flex items-start space-x-3">
            <i className="fas fa-shield-alt text-purple-400 mt-1"></i>
            <div className="text-sm text-gray-300">
              <p className="font-medium text-purple-300 mb-1">Security & Verification</p>
              <p>All protocol contracts are deployed on Intuition Testnet with full source code verification. Click any address to explore contract details, transactions, and interact directly with the blockchain.</p>
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
          className="inline-flex items-center space-x-2 sm:space-x-3 px-4 sm:px-6 py-2 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm sm:text-base font-medium rounded-lg transition-colors duration-200 shadow-lg hover:shadow-indigo-500/25 min-h-[44px]"
        >
          <i className="fab fa-discord text-xl"></i>
          <span>Join Intuition Discord</span>
          <i className="fas fa-external-link-alt text-sm opacity-75"></i>
        </a>
      </div>
    </div>
  )
}

export default Analytics
