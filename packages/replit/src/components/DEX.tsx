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
  'function getPrice(address _token) external view returns (uint256 price)',
  'function getDEXStats() external view returns (uint256 _tTrustReserve, uint256 _intuitReserve, uint256 _totalVolume, uint256 _totalTrades, uint256 _totalLiquidity)',
  'function tTrustReserve() external view returns (uint256)',
  'function intuitReserve() external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function FEE_RATE() external view returns (uint256)'
]

const DEX_TSWP_ABI = [
  'function swapTrustForTswp(uint256 _amountIn, uint256 _minAmountOut) external payable',
  'function swapTswpForTrust(uint256 _amountIn, uint256 _minAmountOut) external',
  'function getAmountOut(address _tokenIn, uint256 _amountIn) external view returns (uint256 amountOut)',
  'function getPrice(address _token) external view returns (uint256 price)',
  'function getDEXStats() external view returns (uint256 _tTrustReserve, uint256 _tswpReserve, uint256 _totalVolume, uint256 _totalTrades, uint256 _totalLiquidity)',
  'function tTrustReserve() external view returns (uint256)',
  'function tswpReserve() external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function FEE_RATE() external view returns (uint256)'
]

const DEX_PINTU_ABI = [
  'function swapTrustForPintu(uint256 _amountIn, uint256 _minAmountOut) external payable',
  'function swapPintuForTrust(uint256 _amountIn, uint256 _minAmountOut) external',
  'function getAmountOut(address _tokenIn, uint256 _amountIn) external view returns (uint256 amountOut)',
  'function getPrice(address _token) external view returns (uint256 price)',
  'function getDEXStats() external view returns (uint256 _tTrustReserve, uint256 _pintuReserve, uint256 _totalVolume, uint256 _totalTrades, uint256 _totalLiquidity)',
  'function tTrustReserve() external view returns (uint256)',
  'function pintuReserve() external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function FEE_RATE() external view returns (uint256)'
]

// DEXRouter ABI - for multi-hop swaps between any token pairs
const DEX_ROUTER_ABI = [
  'function calculateMultiHopOutput(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut, address[] memory path)',
  'function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) external payable returns (uint256 amountOut)',
  'function getDEXForPair(address tokenA, address tokenB) external view returns (address dex)',
  'function getAggregatedPrice(address token) external view returns (uint256 price)',
  'function getRouterStats() external view returns (uint256 totalVolume, uint256 totalTrades, uint256 activePairs)'
]

// ERC20 Token ABI - for all tokens (ORACLE, INTUIT, TSWP, PINTU)
const ERC20_TOKEN_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)'
]

// Utility function to format large numbers responsively
const formatLargeNumber = (value: string | number, token: string = '', breakpoint: 'mobile' | 'desktop' = 'desktop'): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num) || num === 0) return '0'

  // For desktop, show more precision
  if (breakpoint === 'desktop') {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M ${token}`.trim()
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K ${token}`.trim()
    } else {
      return `${num.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${token}`.trim()
    }
  }

  // For mobile, more aggressive truncation
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}K`
  } else if (num >= 1) {
    return num.toFixed(1)
  } else {
    return num.toFixed(4)
  }
}

// Utility function to truncate routes for mobile
const formatRoute = (route: string, breakpoint: 'mobile' | 'desktop' = 'desktop'): string => {
  if (breakpoint === 'mobile') {
    // Simplify long routes for mobile
    return route
      .replace('ORACLE', 'ORC')
      .replace('tTRUST', 'TTR')
      .replace('INTUIT', 'INT')
      .replace('TSWP', 'TSP')
      .replace('PINTU', 'PIN')
      .replace(' (erreur)', '')
  }
  return route
}

// Utility function to truncate addresses responsively
const formatAddress = (address: string, breakpoint: 'mobile' | 'desktop' = 'desktop'): string => {
  if (!address || address.length < 10) return address

  if (breakpoint === 'mobile') {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }
  return `${address.slice(0, 10)}...${address.slice(-6)}`
}

// Diagnostic function to test DEX contract existence and functionality
const testDEXContract = async (contractAddress: string, contractName: string, provider: any): Promise<{
  exists: boolean,
  hasCode: boolean,
  liquidityCheck: { tTrust: string, otherToken: string } | null,
  getAmountOutWorks: boolean,
  error?: string
}> => {
  try {
    console.log(`🔍 Testing ${contractName} at ${contractAddress}...`)

    // Check if contract exists (has code)
    const code = await provider.getCode(contractAddress)
    const hasCode = code !== '0x'

    if (!hasCode) {
      console.log(`❌ ${contractName}: No contract code at address`)
      return { exists: false, hasCode: false, liquidityCheck: null, getAmountOutWorks: false, error: 'No contract code' }
    }

    console.log(`✅ ${contractName}: Contract exists`)

    // Try to get contract instance and test basic functions
    let liquidityCheck = null
    let getAmountOutWorks = false

    try {
      const contract = new ethers.Contract(contractAddress, DEX_ABI, provider)

      // Test liquidity reserves
      const tTrustReserve = await contract.tTrustReserve()
      console.log(`📊 ${contractName}: tTrustReserve = ${ethers.formatEther(tTrustReserve)}`)

      // For ORACLE DEX, check oracleReserve, for others check specific token reserve
      let otherTokenReserve = '0'
      if (contractName.includes('ORACLE')) {
        otherTokenReserve = await contract.oracleReserve()
      } else if (contractName.includes('INTUIT')) {
        const intuitContract = new ethers.Contract(contractAddress, DEX_INTUIT_ABI, provider)
        otherTokenReserve = await intuitContract.intuitReserve()
      } else if (contractName.includes('TSWP')) {
        const tswpContract = new ethers.Contract(contractAddress, DEX_TSWP_ABI, provider)
        otherTokenReserve = await tswpContract.tswpReserve()
      } else if (contractName.includes('PINTU')) {
        const pintuContract = new ethers.Contract(contractAddress, DEX_PINTU_ABI, provider)
        otherTokenReserve = await pintuContract.pintuReserve()
      }

      liquidityCheck = {
        tTrust: ethers.formatEther(tTrustReserve),
        otherToken: ethers.formatEther(otherTokenReserve)
      }

      console.log(`💧 ${contractName}: Liquidity - tTRUST: ${liquidityCheck.tTrust}, Other: ${liquidityCheck.otherToken}`)

      // Test getAmountOut with different tTRUST address patterns
      const testAmount = ethers.parseEther('1') // 1 tTRUST
      const addressesToTry = [
        '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // Our current address
        '0x0000000000000000000000000000000000000000', // address(0)
        '0x0000000000000000000000000000000000000001'  // address(1)
      ]

      for (const testAddress of addressesToTry) {
        try {
          const amountOut = await contract.getAmountOut(testAddress, testAmount)
          console.log(`✅ ${contractName}: getAmountOut works with ${testAddress} = ${ethers.formatEther(amountOut)}`)
          getAmountOutWorks = true
          break
        } catch (testError) {
          console.log(`❌ ${contractName}: getAmountOut failed with ${testAddress}:`, testError.message)
        }
      }

    } catch (contractError) {
      console.log(`❌ ${contractName}: Contract function calls failed:`, contractError.message)
      return {
        exists: true,
        hasCode: true,
        liquidityCheck,
        getAmountOutWorks: false,
        error: contractError.message
      }
    }

    return { exists: true, hasCode: true, liquidityCheck, getAmountOutWorks }

  } catch (error) {
    console.log(`❌ ${contractName}: Test failed:`, error.message)
    return { exists: false, hasCode: false, liquidityCheck: null, getAmountOutWorks: false, error: error.message }
  }
}

// Function to calculate AMM quote locally using Scaffold-ETH pattern
const calculateAMMQuote = (
  inputAmount: string,
  inputReserve: string,
  outputReserve: string,
  feeRate: number = 0.003 // 0.3% fee like Scaffold-ETH
): string => {
  try {
    const input = parseFloat(inputAmount)
    const reserveIn = parseFloat(inputReserve)
    const reserveOut = parseFloat(outputReserve)

    if (input <= 0 || reserveIn <= 0 || reserveOut <= 0) {
      return '0'
    }

    // Scaffold-ETH AMM formula: output = (input * 997 * outputReserve) / (inputReserve * 1000 + input * 997)
    // This accounts for 0.3% fee (997/1000 = 99.7%)
    const inputWithFee = input * (1 - feeRate)
    const numerator = inputWithFee * reserveOut
    const denominator = reserveIn + inputWithFee

    const output = numerator / denominator

    console.log('🧮 AMM Calculation:', {
      input,
      inputReserve: reserveIn,
      outputReserve: reserveOut,
      feeRate: `${feeRate * 100}%`,
      output
    })

    return output.toString()
  } catch (error) {
    console.error('❌ AMM calculation failed:', error)
    return '0'
  }
}

// Function to run comprehensive DEX diagnostics with Scaffold-ETH pattern testing
// PHASE 1: DIAGNOSTIC FONDAMENTAL - Test réalité vs suppositions
const runDEXDiagnostics = async (): Promise<void> => {
  if (!window.ethereum) {
    console.log('❌ No ethereum provider available')
    return
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum)

    console.log('🔍 PHASE 1: DIAGNOSTIC FONDAMENTAL DES CONTRATS')
    console.log('='.repeat(60))
    console.log('📋 Objectif: Tester la réalité vs suppositions du code')
    console.log('')

    // RÉELLES adresses des contrats depuis les constantes
    const REAL_CONTRACTS = {
      DEX_ORACLE: CONTRACTS.DEX,
      DEX_INTUIT: CONTRACTS.DEX_INTUIT,
      DEX_TSWP: CONTRACTS.DEX_TSWP,
      DEX_PINTU: CONTRACTS.DEX_PINTU,
      DEX_ROUTER: CONTRACTS.DEXRouter
    }

    // ÉTAPE 1: Vérifier l'existence des contrats
    console.log('📋 ÉTAPE 1: VÉRIFICATION D\'EXISTENCE DES CONTRATS')
    console.log('-'.repeat(50))

    const contractResults = {}

    for (const [name, address] of Object.entries(REAL_CONTRACTS)) {
      console.log(`🧪 Test ${name}: ${address}`)

      try {
        const code = await provider.getCode(address)
        const exists = code !== '0x'

        contractResults[name] = {
          address,
          exists,
          codeSize: code.length,
          functions: []
        }

        if (exists) {
          console.log(`  ✅ Contrat existe (${code.length} chars de bytecode)`)
        } else {
          console.log(`  ❌ Aucun contrat déployé`)
        }
      } catch (error) {
        console.log(`  ❌ Erreur: ${error.message}`)
        contractResults[name] = {
          address,
          exists: false,
          error: error.message
        }
      }
    }

    console.log('')

    // ÉTAPE 2: Tester fonctions supposées vs réalité pour contrats existants
    console.log('📋 ÉTAPE 2: TEST DES FONCTIONS SUPPOSÉES')
    console.log('-'.repeat(50))

    const SUPPOSED_FUNCTIONS = {
      DEX_ORACLE: ['swapTrustForOracle', 'swapOracleForTrust', 'getAmountOut', 'tTrustReserve', 'oracleReserve'],
      DEX_INTUIT: ['swapTrustForIntuit', 'swapIntuitForTrust', 'getAmountOut', 'tTrustReserve', 'intuitReserve'],
      DEX_TSWP: ['swapTrustForTswp', 'swapTswpForTrust', 'getAmountOut', 'tTrustReserve', 'tswpReserve'],
      DEX_PINTU: ['swapTrustForPintu', 'swapPintuForTrust', 'getAmountOut', 'tTrustReserve', 'pintuReserve'],
      DEX_ROUTER: ['calculateMultiHopOutput', 'swap', 'getDEXForPair']
    }

    for (const [contractName, info] of Object.entries(contractResults)) {
      if (!info.exists) {
        console.log(`⏭️ Skip ${contractName}: Contrat n'existe pas`)
        continue
      }

      console.log(`🔧 Test des fonctions supposées pour ${contractName}:`)

      const supposedFunctions = SUPPOSED_FUNCTIONS[contractName] || []
      const workingFunctions = []
      const failedFunctions = []

      for (const funcName of supposedFunctions) {
        try {
          // Test basique avec l'ABI correspondante du code actuel
          const currentABI = contractName === 'DEX_ORACLE' ? DEX_ABI :
                           contractName === 'DEX_INTUIT' ? DEX_INTUIT_ABI :
                           contractName === 'DEX_TSWP' ? DEX_TSWP_ABI :
                           contractName === 'DEX_PINTU' ? DEX_PINTU_ABI :
                           DEX_ROUTER_ABI

          const contract = new ethers.Contract(info.address, currentABI, provider)

          // Vérifier si la fonction existe dans l'interface
          const funcFragment = contract.interface.getFunction(funcName)
          if (funcFragment) {
            // Fonction existe dans l'ABI - maintenant tester si elle fonctionne vraiment
            try {
              if (funcName.includes('Reserve')) {
                // Test view functions qui retournent des reserves
                const result = await contract[funcName]()
                workingFunctions.push(`${funcName}() -> ${ethers.formatEther(result)} ETH`)
              } else if (funcName === 'getAmountOut') {
                // Test spécial pour getAmountOut avec différents patterns
                try {
                  const result = await contract[funcName](TOKENS.tTRUST.address, ethers.parseEther('1'))
                  workingFunctions.push(`${funcName}(address,uint256) -> ${ethers.formatEther(result)} ETH`)
                } catch {
                  try {
                    const result = await contract[funcName](ethers.parseEther('1'), ethers.parseEther('1000'), ethers.parseEther('500000'))
                    workingFunctions.push(`${funcName}(uint256,uint256,uint256) -> ${ethers.formatEther(result)} ETH`)
                  } catch {
                    failedFunctions.push(`${funcName}() - params incorrects`)
                  }
                }
              } else {
                // Pour swap functions, juste vérifier que la signature existe
                workingFunctions.push(`${funcName}() - signature existe`)
              }
            } catch (callError) {
              failedFunctions.push(`${funcName}() - existe mais échec: ${callError.message.substring(0, 30)}...`)
            }
          } else {
            failedFunctions.push(`${funcName}() - n'existe pas dans l'ABI`)
          }
        } catch (error) {
          failedFunctions.push(`${funcName}() - erreur ABI: ${error.message.substring(0, 30)}...`)
        }
      }

      if (workingFunctions.length > 0) {
        console.log(`  ✅ Fonctions qui marchent (${workingFunctions.length}):`)
        workingFunctions.forEach(func => console.log(`    - ${func}`))
      }

      if (failedFunctions.length > 0) {
        console.log(`  ❌ Fonctions qui échouent (${failedFunctions.length}):`)
        failedFunctions.forEach(func => console.log(`    - ${func}`))
      }

      contractResults[contractName].workingFunctions = workingFunctions
      contractResults[contractName].failedFunctions = failedFunctions
      console.log('')
    }

    // ÉTAPE 3: Test des patterns d'adresses tTRUST
    console.log('📋 ÉTAPE 3: TEST DES PATTERNS D\'ADRESSES tTRUST')
    console.log('-'.repeat(50))

    const tTrustPatterns = [
      { name: 'Current (0xEee...eE)', address: TOKENS.tTRUST.address },
      { name: 'Zero (0x000...000)', address: '0x0000000000000000000000000000000000000000' },
      { name: 'One (0x000...001)', address: '0x0000000000000000000000000000000000000001' }
    ]

    // Test avec DEX_ORACLE s'il existe
    if (contractResults.DEX_ORACLE?.exists) {
      console.log('🧪 Test patterns avec DEX_ORACLE:')
      try {
        const contract = new ethers.Contract(contractResults.DEX_ORACLE.address, DEX_ABI, provider)

        for (const pattern of tTrustPatterns) {
          try {
            const result = await contract.getAmountOut(pattern.address, ethers.parseEther('1'))
            console.log(`  ✅ ${pattern.name}: ${pattern.address} -> ${ethers.formatEther(result)} tokens`)
          } catch (error) {
            console.log(`  ❌ ${pattern.name}: ${pattern.address} -> ${error.message.substring(0, 50)}...`)
          }
        }
      } catch (error) {
        console.log(`  ❌ Erreur générale: ${error.message}`)
      }
    } else {
      console.log('⚠️ DEX_ORACLE n\'existe pas, impossible de tester les patterns tTRUST')
    }

    console.log('')

    // RÉSUMÉ FINAL ET RECOMMANDATIONS
    console.log('📊 RÉSUMÉ DU DIAGNOSTIC')
    console.log('='.repeat(60))

    const existingContracts = Object.entries(contractResults).filter(([name, info]) => info.exists)
    const missingContracts = Object.entries(contractResults).filter(([name, info]) => !info.exists)

    console.log(`✅ Contrats existants (${existingContracts.length}/5):`)
    existingContracts.forEach(([name, info]) => {
      const workingCount = info.workingFunctions?.length || 0
      const failedCount = info.failedFunctions?.length || 0
      console.log(`  - ${name}: ${info.address}`)
      console.log(`    📊 ${workingCount} fonctions OK, ${failedCount} fonctions KO`)
    })

    if (missingContracts.length > 0) {
      console.log(`❌ Contrats manquants (${missingContracts.length}/5):`)
      missingContracts.forEach(([name, info]) => {
        console.log(`  - ${name}: ${info.address}`)
      })
    }

    console.log('')
    console.log('🎯 RECOMMANDATIONS IMMÉDIATES:')

    if (existingContracts.length === 0) {
      console.log('❌ CRITIQUE: Aucun contrat n\'existe - Vérifier réseau et adresses')
    } else {
      console.log(`✅ ${existingContracts.length}/5 contrats existent`)

      // Analyse des fonctions qui marchent
      const totalWorkingFunctions = existingContracts.reduce((sum, [name, info]) => sum + (info.workingFunctions?.length || 0), 0)

      if (totalWorkingFunctions === 0) {
        console.log('❌ PROBLÈME: Aucune fonction supposée ne fonctionne')
        console.log('   → Les ABIs dans le code sont probablement incorrectes')
        console.log('   → PHASE 2: Analyser le bytecode pour découvrir les vraies signatures')
      } else {
        console.log(`✅ ${totalWorkingFunctions} fonctions fonctionnent`)
        console.log('   → Problème partiel - certaines ABIs sont correctes')
        console.log('   → PHASE 2: Se concentrer sur les contrats/fonctions qui marchent')

        // Identifier le meilleur candidat pour commencer
        const bestContract = existingContracts.reduce((best, [name, info]) => {
          const workingCount = info.workingFunctions?.length || 0
          const bestCount = best[1]?.workingFunctions?.length || 0
          return workingCount > bestCount ? [name, info] : best
        }, [null, null])

        if (bestContract[0]) {
          console.log(`   → PRIORITÉ: Commencer avec ${bestContract[0]} (${bestContract[1].workingFunctions?.length} fonctions OK)`)
        }
      }
    }

    console.log('')
    console.log('📋 Action suivante: PHASE 2 - Adapter le code selon ces résultats')

    // Sauvegarder les résultats pour les phases suivantes
    ;(window as any).diagnosticResults = contractResults

  } catch (error) {
    console.error('❌ ERREUR FATALE dans le diagnostic:', error)
  }
}

// Utility functions to determine correct DEX contract and methods
const getDEXContractInfo = (fromToken: TokenSymbol, toToken: TokenSymbol) => {
  // Check if this is a direct pair (includes tTRUST) or requires multi-hop routing
  if (fromToken !== 'tTRUST' && toToken !== 'tTRUST') {
    // Return multi-hop routing info for non-tTRUST pairs
    return {
      isMultiHop: true,
      contractAddress: CONTRACTS.DEXRouter,
      abi: DEX_ROUTER_ABI,
      intermediateToken: 'tTRUST',
      fromToken,
      toToken,
      error: null
    }
  }

  // Determine the non-tTRUST token
  const otherToken = fromToken === 'tTRUST' ? toToken : fromToken

  switch (otherToken) {
    case 'ORACLE':
      return {
        isMultiHop: false,
        contractAddress: CONTRACTS.DEX,
        abi: DEX_ABI,
        swapToTokenFunction: 'swapTrustForOracle',
        swapFromTokenFunction: 'swapOracleForTrust',
        tokenContract: CONTRACTS.OracleToken,
        fromToken,
        toToken,
        error: null
      }
    case 'INTUIT':
      return {
        isMultiHop: false,
        contractAddress: CONTRACTS.DEX_INTUIT,
        abi: DEX_INTUIT_ABI,
        swapToTokenFunction: 'swapTrustForIntuit',
        swapFromTokenFunction: 'swapIntuitForTrust',
        tokenContract: CONTRACTS.IntuitToken,
        fromToken,
        toToken,
        error: null
      }
    case 'TSWP':
      return {
        isMultiHop: false,
        contractAddress: CONTRACTS.DEX_TSWP,
        abi: DEX_TSWP_ABI,
        swapToTokenFunction: 'swapTrustForTswp',
        swapFromTokenFunction: 'swapTswpForTrust',
        tokenContract: CONTRACTS.TswpToken,
        fromToken,
        toToken,
        error: null
      }
    case 'PINTU':
      return {
        isMultiHop: false,
        contractAddress: CONTRACTS.DEX_PINTU,
        abi: DEX_PINTU_ABI,
        swapToTokenFunction: 'swapTrustForPintu',
        swapFromTokenFunction: 'swapPintuForTrust',
        tokenContract: CONTRACTS.PintuToken,
        fromToken,
        toToken,
        error: null
      }
    default:
      return {
        isMultiHop: false,
        contractAddress: '',
        abi: [],
        swapToTokenFunction: '',
        swapFromTokenFunction: '',
        tokenContract: '',
        fromToken,
        toToken,
        error: `Token non supporté: ${otherToken}`
      }
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
  const [quoteMethod, setQuoteMethod] = useState<'scaffold-eth' | 'original' | null>(null)
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
          const tokenContract = new ethers.Contract(contractAddress, ERC20_TOKEN_ABI, provider)
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

  // New Scaffold-ETH pattern quote function
  const getQuoteScaffoldETH = async (): Promise<boolean> => {
    if (!fromAmount || parseFloat(fromAmount) <= 0 || !window.ethereum || !isCorrectNetwork) {
      setToAmount('')
      setQuote(null)
      return false
    }

    console.log(`🏗 getQuoteScaffoldETH: Starting quote calculation for ${fromAmount} ${fromToken} → ${toToken}`)

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const dexInfo = getDEXContractInfo(fromToken, toToken)

      if (dexInfo.error) {
        console.warn('❌ getQuoteScaffoldETH: Paire non supportée:', dexInfo.error)
        setToAmount('')
        setQuote(null)
        return false
      }

      // For direct pairs (includes tTRUST), use Scaffold-ETH approach
      if (!dexInfo.isMultiHop) {
        console.log('🏗 getQuoteScaffoldETH: Direct pair, getting reserves...')
        const dexContract = new ethers.Contract(dexInfo.contractAddress, dexInfo.abi, provider)

        try {
          // Get reserves directly (Scaffold-ETH pattern)
          const tTrustReserve = await dexContract.tTrustReserve()

          let otherTokenReserve = '0'
          const otherToken = fromToken === 'tTRUST' ? toToken : fromToken

          switch (otherToken) {
            case 'ORACLE':
              otherTokenReserve = await dexContract.oracleReserve()
              break
            case 'INTUIT':
              otherTokenReserve = await dexContract.intuitReserve()
              break
            case 'TSWP':
              otherTokenReserve = await dexContract.tswpReserve()
              break
            case 'PINTU':
              otherTokenReserve = await dexContract.pintuReserve()
              break
          }

          const tTrustReserveFormatted = ethers.formatEther(tTrustReserve)
          const otherReserveFormatted = ethers.formatEther(otherTokenReserve)

          console.log('🏗 getQuoteScaffoldETH: Reserves:', {
            tTrustReserve: tTrustReserveFormatted,
            [`${otherToken}Reserve`]: otherReserveFormatted
          })

          // Check if reserves are sufficient
          if (parseFloat(tTrustReserveFormatted) <= 0 || parseFloat(otherReserveFormatted) <= 0) {
            console.warn('❌ getQuoteScaffoldETH: Insufficient liquidity in reserves')
            setToAmount('0')
            setQuote(null)
            return false
          }

          // Calculate quote using local AMM formula (Scaffold-ETH pattern)
          let outputAmount: string
          if (fromToken === 'tTRUST') {
            // tTRUST → Token
            outputAmount = calculateAMMQuote(fromAmount, tTrustReserveFormatted, otherReserveFormatted)
          } else {
            // Token → tTRUST
            outputAmount = calculateAMMQuote(fromAmount, otherReserveFormatted, tTrustReserveFormatted)
          }

          if (parseFloat(outputAmount) <= 0) {
            console.warn('❌ getQuoteScaffoldETH: AMM calculation returned 0')
            setToAmount('0')
            setQuote(null)
            return false
          }

          // Calculate price impact
          const input = parseFloat(fromAmount)
          const output = parseFloat(outputAmount)
          const inputReserve = fromToken === 'tTRUST' ? parseFloat(tTrustReserveFormatted) : parseFloat(otherReserveFormatted)
          const priceImpact = (input / (inputReserve + input)) * 100

          // Calculate exchange rate
          const exchangeRate = output / input

          console.log('✅ getQuoteScaffoldETH: Calculation successful:', {
            input: `${input} ${fromToken}`,
            output: `${output} ${toToken}`,
            priceImpact: `${priceImpact.toFixed(2)}%`,
            exchangeRate
          })

          setToAmount(outputAmount)
          setQuote({
            inputAmount: fromAmount,
            outputAmount: outputAmount,
            priceImpact: priceImpact,
            minimumReceived: (output * (1 - slippage / 100)).toFixed(6),
            exchangeRate: exchangeRate
          })
          setQuoteMethod('scaffold-eth')

          return true

        } catch (error) {
          console.error('❌ getQuoteScaffoldETH: Error getting reserves or calculating:', error.message)
          setToAmount('')
          setQuote(null)
          return false
        }
      }

      // Multi-hop not implemented yet for Scaffold-ETH pattern
      console.warn('⚠️ getQuoteScaffoldETH: Multi-hop not yet implemented in Scaffold-ETH pattern')
      setToAmount('')
      setQuote(null)
      return false

    } catch (error) {
      console.error('❌ getQuoteScaffoldETH: Global error:', error.message)
      setToAmount('')
      setQuote(null)
      return false
    }
  }

  // Original quote function (fallback)
  const getQuote = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0 || !window.ethereum || !isCorrectNetwork) {
      setToAmount('')
      setQuote(null)
      return
    }

    console.log(`🔄 getQuote: Starting quote calculation for ${fromAmount} ${fromToken} → ${toToken}`)

    try {
      // Get the appropriate DEX contract info
      const dexInfo = getDEXContractInfo(fromToken, toToken)
      console.log(`📋 getQuote: DEX Info:`, {
        isMultiHop: dexInfo.isMultiHop,
        contractAddress: dexInfo.contractAddress,
        fromToken,
        toToken,
        error: dexInfo.error
      })

      // Check for errors in dexInfo
      if (dexInfo.error) {
        console.warn('❌ getQuote: Paire de tokens non supportée:', dexInfo.error)
        setToAmount('')
        setQuote(null)
        return
      }

      // For multi-hop swaps, use DEXRouter to calculate real quotes
      if (dexInfo.isMultiHop) {
        console.log('🔀 getQuote: Multi-hop swap détecté:', fromToken, '→', toToken)
        console.log('🔀 getQuote: DEXRouter address:', dexInfo.contractAddress)

        const provider = new ethers.BrowserProvider(window.ethereum)
        const routerContract = new ethers.Contract(dexInfo.contractAddress, dexInfo.abi, provider)

        const inputAmount = ethers.parseEther(fromAmount)
        const tokenInAddress = TOKENS[fromToken].address
        const tokenOutAddress = TOKENS[toToken].address

        console.log('🔀 getQuote: Multi-hop params:', {
          tokenInAddress,
          tokenOutAddress,
          inputAmount: ethers.formatEther(inputAmount)
        })

        try {
          // Get multi-hop quote from DEXRouter
          console.log('🔀 getQuote: Calling calculateMultiHopOutput...')
          const [amountOut, path] = await routerContract.calculateMultiHopOutput(
            tokenInAddress,
            tokenOutAddress,
            inputAmount
          )

          console.log('✅ getQuote: Multi-hop calculation successful:', {
            amountOut: ethers.formatEther(amountOut),
            path
          })

          const outputAmount = ethers.formatEther(amountOut)

          // Calculate price impact (estimated based on 2-hop routing)
          // This is approximate since multi-hop pricing is complex
          const directRate = 1 // Simplified - would need more complex calculation
          const actualRate = parseFloat(outputAmount) / parseFloat(fromAmount)
          const priceImpact = Math.abs((directRate - actualRate) / directRate) * 100

          setToAmount(outputAmount)
          setQuote({
            inputAmount: fromAmount,
            outputAmount: outputAmount,
            priceImpact: Math.min(priceImpact, 15), // Cap at 15% for display
            minimumReceived: (parseFloat(outputAmount) * (1 - slippage / 100)).toFixed(6),
            exchangeRate: actualRate,
            isMultiHop: true,
            route: `${fromToken} → tTRUST → ${toToken}`
          })
        } catch (error) {
          console.error('❌ getQuote: Erreur lors du calcul multi-hop:', error.message)
          setToAmount('0.00')
          setQuote({
            inputAmount: fromAmount,
            outputAmount: '0.00',
            priceImpact: 0,
            minimumReceived: '0.00',
            exchangeRate: 0,
            isMultiHop: true,
            route: `${fromToken} → tTRUST → ${toToken} (erreur)`
          })
        }
        return
      }

      // Direct swap (includes tTRUST)
      console.log('🔄 getQuote: Direct swap calculation:', fromToken, '→', toToken)
      console.log('🔄 getQuote: DEX contract address:', dexInfo.contractAddress)

      const provider = new ethers.BrowserProvider(window.ethereum)
      const dexContract = new ethers.Contract(dexInfo.contractAddress, dexInfo.abi, provider)

      const inputAmount = ethers.parseEther(fromAmount)

      // Smart token address resolution for native tokens
      let tokenInAddress
      if (fromToken === 'tTRUST') {
        // Try multiple address patterns for native tTRUST token
        tokenInAddress = TOKENS.tTRUST.address
      } else {
        tokenInAddress = TOKENS[fromToken].address
      }

      console.log('🔄 getQuote: Direct swap params:', {
        tokenInAddress,
        inputAmount: ethers.formatEther(inputAmount),
        dexAbi: dexInfo.abi.length + ' functions'
      })

      // Try to get quote with fallback for native token address patterns
      let amountOut
      try {
        console.log('🔄 getQuote: Calling getAmountOut with primary address...')
        amountOut = await dexContract.getAmountOut(tokenInAddress, inputAmount)
        console.log('✅ getQuote: Primary getAmountOut successful:', ethers.formatEther(amountOut))
      } catch (error) {
        console.warn('❌ getQuote: Premier essai échoué avec', tokenInAddress, '- Tentative avec patterns alternatifs')
        console.warn('❌ getQuote: Error details:', error.message)

        // If initial address fails and we're dealing with tTRUST, try alternative patterns
        if (fromToken === 'tTRUST' || toToken === 'tTRUST') {
          const alternativeAddresses = [
            '0x0000000000000000000000000000000000000000', // address(0)
            '0x0000000000000000000000000000000000000001', // address(1)
            TOKENS.tTRUST.address // Keep current as fallback
          ]

          for (const altAddress of alternativeAddresses) {
            try {
              const testTokenIn = fromToken === 'tTRUST' ? altAddress : TOKENS[fromToken].address
              console.log(`🔄 getQuote: Trying alternative address: ${altAddress}`)
              amountOut = await dexContract.getAmountOut(testTokenIn, inputAmount)
              console.log('✅ getQuote: Succès avec adresse alternative:', altAddress, '=', ethers.formatEther(amountOut))
              tokenInAddress = testTokenIn
              break
            } catch (altError) {
              console.warn('❌ getQuote: Échec avec adresse alternative:', altAddress, '-', altError.message)
              continue
            }
          }
        }

        // If all patterns fail, throw the original error
        if (!amountOut) {
          console.error('❌ getQuote: All address patterns failed, throwing original error')
          throw error
        }
      }

      const outputAmount = ethers.formatEther(amountOut)
      console.log('✅ getQuote: Direct swap calculation successful:', outputAmount, toToken)

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

      console.log('📊 getQuote: Price calculation:', {
        expectedOutput,
        actualOutput,
        priceImpact: `${priceImpact.toFixed(2)}%`,
        exchangeRate: fromToken === 'tTRUST' ? currentRate : 1 / currentRate
      })

      setToAmount(outputAmount)
      setQuote({
        inputAmount: fromAmount,
        outputAmount: outputAmount,
        priceImpact: priceImpact,
        minimumReceived: (parseFloat(outputAmount) * (1 - slippage / 100)).toFixed(6),
        exchangeRate: fromToken === 'tTRUST' ? currentRate : 1 / currentRate
      })
      setQuoteMethod('original')

      console.log('✅ getQuote: Quote set successfully for', fromToken, '→', toToken)

    } catch (error) {
      console.error('❌ getQuote: Final error - Failed to get quote:', error.message)
      console.error('❌ getQuote: Error stack:', error.stack)
      setToAmount('')
      setQuote(null)
    }
  }

  // Calculate quote when amounts change - try Scaffold-ETH pattern first
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      console.log('🔄 Quote calculation triggered...')

      // Try Scaffold-ETH pattern first
      const scaffoldSuccess = await getQuoteScaffoldETH()

      if (!scaffoldSuccess) {
        console.log('🔄 Scaffold-ETH pattern failed, trying original method...')
        getQuote()
      } else {
        console.log('✅ Scaffold-ETH pattern succeeded!')
      }
    }, 500) // Debounce API calls

    return () => clearTimeout(timeoutId)
  }, [fromAmount, fromToken, toToken, slippage, dexStats])

  const handleSwapTokens = () => {
    setFromToken(toToken)
    setToToken(fromToken)
    setFromAmount(toAmount)
    setToAmount(fromAmount)
  }

  // New Scaffold-ETH pattern swap function
  const handleSwapScaffoldETH = async (): Promise<boolean> => {
    if (!quote || !isConnected || !account || !window.ethereum) return false

    console.log(`🏗 handleSwapScaffoldETH: Starting swap ${fromAmount} ${fromToken} → ${toToken}`)

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const dexInfo = getDEXContractInfo(fromToken, toToken)

      if (dexInfo.error) {
        console.error('❌ handleSwapScaffoldETH: DEX info error:', dexInfo.error)
        return false
      }

      // Only handle direct swaps (no multi-hop for now)
      if (dexInfo.isMultiHop) {
        console.warn('⚠️ handleSwapScaffoldETH: Multi-hop not implemented yet')
        return false
      }

      const dexContract = new ethers.Contract(dexInfo.contractAddress, dexInfo.abi, signer)
      const inputAmount = ethers.parseEther(fromAmount)
      const minAmountOut = ethers.parseEther(quote.minimumReceived)

      let tx

      if (fromToken === 'tTRUST') {
        // tTRUST → Token (Native token input, use msg.value)
        console.log(`🏗 handleSwapScaffoldETH: Swapping tTRUST → ${toToken} using ${dexInfo.swapToTokenFunction}`)

        if (toToken === 'ORACLE') {
          tx = await dexContract.swapTrustForOracle(inputAmount, minAmountOut, {
            value: inputAmount,
            gasLimit: 300000
          })
        } else if (toToken === 'INTUIT') {
          tx = await dexContract.swapTrustForIntuit(inputAmount, minAmountOut, {
            value: inputAmount,
            gasLimit: 300000
          })
        } else if (toToken === 'TSWP') {
          tx = await dexContract.swapTrustForTswp(inputAmount, minAmountOut, {
            value: inputAmount,
            gasLimit: 300000
          })
        } else if (toToken === 'PINTU') {
          tx = await dexContract.swapTrustForPintu(inputAmount, minAmountOut, {
            value: inputAmount,
            gasLimit: 300000
          })
        } else {
          console.error('❌ handleSwapScaffoldETH: Unsupported toToken:', toToken)
          return false
        }

      } else if (toToken === 'tTRUST') {
        // Token → tTRUST (ERC20 input, need approval)
        console.log(`🏗 handleSwapScaffoldETH: Swapping ${fromToken} → tTRUST using ${dexInfo.swapFromTokenFunction}`)

        const tokenContract = new ethers.Contract(dexInfo.tokenContract, ERC20_TOKEN_ABI, signer)
        const allowance = await tokenContract.allowance(account, dexInfo.contractAddress)

        if (allowance < inputAmount) {
          console.log(`🏗 handleSwapScaffoldETH: Approving ${fromToken} tokens...`)
          const approveTx = await tokenContract.approve(dexInfo.contractAddress, inputAmount)
          await approveTx.wait()
          console.log(`✅ handleSwapScaffoldETH: ${fromToken} tokens approved`)
        }

        if (fromToken === 'ORACLE') {
          tx = await dexContract.swapOracleForTrust(inputAmount, minAmountOut, {
            gasLimit: 300000
          })
        } else if (fromToken === 'INTUIT') {
          tx = await dexContract.swapIntuitForTrust(inputAmount, minAmountOut, {
            gasLimit: 300000
          })
        } else if (fromToken === 'TSWP') {
          tx = await dexContract.swapTswpForTrust(inputAmount, minAmountOut, {
            gasLimit: 300000
          })
        } else if (fromToken === 'PINTU') {
          tx = await dexContract.swapPintuForTrust(inputAmount, minAmountOut, {
            gasLimit: 300000
          })
        } else {
          console.error('❌ handleSwapScaffoldETH: Unsupported fromToken:', fromToken)
          return false
        }

      } else {
        console.error('❌ handleSwapScaffoldETH: Token → Token swaps not supported in direct pattern')
        return false
      }

      console.log(`🏗 handleSwapScaffoldETH: Transaction submitted: ${tx.hash}`)

      // Wait for transaction confirmation
      const receipt = await tx.wait()
      console.log(`✅ handleSwapScaffoldETH: Swap confirmed in block ${receipt.blockNumber}`)

      // Track transaction for analytics
      try {
        if (account && receipt.hash) {
          const volumeTTRUST = fromToken === 'tTRUST' ? fromAmount : toAmount
          trackTransaction(
            receipt.hash,
            'swap',
            account,
            `${fromToken}→${toToken} (Scaffold-ETH)`,
            `${fromAmount} ${fromToken}`,
            volumeTTRUST
          )
        }
      } catch (analyticsError) {
        console.error('Analytics tracking failed:', analyticsError)
      }

      // Success notification
      if (typeof window !== 'undefined' && (window as any).showNotification) {
        (window as any).showNotification('success', `Scaffold-ETH swap réussi: ${fromAmount} ${fromToken} → ${quote.outputAmount} ${toToken}`, receipt.hash)
      }

      // Reset form and refresh data
      setFromAmount('')
      setToAmount('')
      setQuote(null)

      // Refresh balances and DEX stats
      await fetchBalances()
      await fetchDexStats()

      return true

    } catch (error: any) {
      console.error('❌ handleSwapScaffoldETH: Swap error:', error.message)

      if (error.code === 4001 || error.message.includes('rejected')) {
        if (typeof window !== 'undefined' && (window as any).showNotification) {
          (window as any).showNotification('rejected', 'Transaction was rejected by user')
        }
      } else {
        if (typeof window !== 'undefined' && (window as any).showNotification) {
          (window as any).showNotification('error', `Scaffold-ETH swap error: ${error.message}`)
        }
      }

      return false
    }
  }

  // Original swap function (fallback)
  const handleSwap = async () => {
    if (!quote || !isConnected || !account || !window.ethereum) return

    setIsLoading(true)

    // Try Scaffold-ETH pattern first
    const scaffoldSuccess = await handleSwapScaffoldETH()

    if (scaffoldSuccess) {
      console.log('✅ Scaffold-ETH swap succeeded!')
      setIsLoading(false)
      return
    }

    console.log('🔄 Scaffold-ETH swap failed, trying original method...')

    try {
      // Get the appropriate DEX contract info
      const dexInfo = getDEXContractInfo(fromToken, toToken)

      // Check for errors in dexInfo
      if (dexInfo.error) {
        if (typeof window !== 'undefined' && (window as any).showNotification) {
          (window as any).showNotification('error', dexInfo.error)
        }
        setIsLoading(false)
        return
      }

      // For multi-hop swaps, use DEXRouter
      if (dexInfo.isMultiHop) {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const routerContract = new ethers.Contract(dexInfo.contractAddress, dexInfo.abi, signer)

        const inputAmount = ethers.parseEther(fromAmount)
        const minAmountOut = ethers.parseEther(quote.minimumReceived)
        const tokenInAddress = TOKENS[fromToken].address
        const tokenOutAddress = TOKENS[toToken].address

        try {
          let tx

          if (fromToken === 'tTRUST') {
            // tTRUST → Token (native token input)
            tx = await routerContract.swap(
              tokenInAddress,
              tokenOutAddress,
              0, // amountIn = 0 for native token, sent via msg.value
              minAmountOut,
              {
                value: inputAmount,
                gasLimit: 500000 // Higher gas limit for multi-hop
              }
            )
          } else if (toToken === 'tTRUST') {
            // Token → tTRUST (ERC20 input)
            const tokenContract = new ethers.Contract(tokenInAddress, ERC20_TOKEN_ABI, signer)
            const allowance = await tokenContract.allowance(account, dexInfo.contractAddress)

            if (allowance < inputAmount) {
              console.log(`Approving ${fromToken} tokens for DEXRouter...`)
              const approveTx = await tokenContract.approve(dexInfo.contractAddress, inputAmount)
              await approveTx.wait()
              console.log(`${fromToken} tokens approved successfully`)
            }

            tx = await routerContract.swap(
              tokenInAddress,
              tokenOutAddress,
              inputAmount,
              minAmountOut,
              {
                gasLimit: 500000
              }
            )
          } else {
            // Token → Token (multi-hop via tTRUST)
            const tokenContract = new ethers.Contract(tokenInAddress, ERC20_TOKEN_ABI, signer)
            const allowance = await tokenContract.allowance(account, dexInfo.contractAddress)

            if (allowance < inputAmount) {
              console.log(`Approving ${fromToken} tokens for DEXRouter...`)
              const approveTx = await tokenContract.approve(dexInfo.contractAddress, inputAmount)
              await approveTx.wait()
              console.log(`${fromToken} tokens approved successfully`)
            }

            tx = await routerContract.swap(
              tokenInAddress,
              tokenOutAddress,
              inputAmount,
              minAmountOut,
              {
                gasLimit: 600000 // Even higher gas for full multi-hop
              }
            )
          }

          console.log(`Multi-hop swap transaction submitted: ${tx.hash}`)

          // Wait for transaction confirmation
          const receipt = await tx.wait()
          console.log(`Multi-hop swap confirmed in block ${receipt.blockNumber}`)

          // Track multi-hop transaction for analytics
          try {
            if (account && receipt.hash) {
              const volumeTTRUST = fromToken === 'tTRUST' ? fromAmount :
                                  toToken === 'tTRUST' ? toAmount :
                                  (parseFloat(fromAmount) + parseFloat(toAmount)) / 2 // Estimate for token-token
              trackTransaction(
                receipt.hash,
                'swap',
                account,
                `${fromToken}→${toToken} (multi-hop)`,
                `${fromAmount} ${fromToken}`,
                volumeTTRUST
              )
            }
          } catch (analyticsError) {
            console.error('Analytics tracking failed:', analyticsError)
          }

          // Success notification
          if (typeof window !== 'undefined' && (window as any).showNotification) {
            (window as any).showNotification('success', `Multi-hop swap réussi: ${fromAmount} ${fromToken} → ${quote.outputAmount} ${toToken}`, receipt.hash)
          }

          // Reset form and refresh data
          setFromAmount('')
          setToAmount('')
          setQuote(null)

          // Refresh balances and DEX stats
          await fetchBalances()
          await fetchDexStats()

          setIsLoading(false)
          return
        } catch (error) {
          console.error('Multi-hop swap error:', error)
          if (typeof window !== 'undefined' && (window as any).showNotification) {
            (window as any).showNotification('error', `Erreur multi-hop: ${error.message || 'Swap échoué'}`)
          }
          setIsLoading(false)
          return
        }
      }
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

  const slippageOptions = [0.1, 0.5, 1.0, 2.0] // Multi-token support complet

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
                <button
                  onClick={runDEXDiagnostics}
                  className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 glass-effect border border-yellow-600/50 rounded-lg text-yellow-400 hover:text-yellow-300 hover:border-yellow-500/50 transition-all min-h-[44px]"
                  title="Test DEX contracts functionality with Scaffold-ETH pattern"
                >
                  <i className="fas fa-stethoscope"></i>
                  <span className="text-sm hidden sm:inline">Diagnostic</span>
                  <span className="text-sm sm:hidden">Test</span>
                </button>
                <button
                  onClick={async () => {
                    console.log('🏗 Testing Scaffold-ETH quote calculation...')
                    await getQuoteScaffoldETH()
                  }}
                  className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 glass-effect border border-green-600/50 rounded-lg text-green-400 hover:text-green-300 hover:border-green-500/50 transition-all min-h-[44px]"
                  title="Test Scaffold-ETH quote calculation"
                >
                  <i className="fas fa-calculator"></i>
                  <span className="text-sm hidden sm:inline">Quote Test</span>
                  <span className="text-sm sm:hidden">Quote</span>
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
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm text-slate-200 font-medium">From</label>
                    <span className="text-xs text-slate-300 font-medium">
                      Balance: {parseFloat(balances[fromToken]).toFixed(4)}
                    </span>
                  </div>
                  <div className="glass-effect rounded-lg p-3 sm:p-4 border border-gray-600/30">
                    <div className="flex items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
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
                        className="bg-transparent text-base sm:text-lg font-semibold text-white placeholder-slate-400 flex-1 outline-none w-full py-2 min-w-0"
                      />
                      <div className="relative flex-shrink-0">
                        <select
                          value={fromToken}
                          onChange={(e) => setFromToken(e.target.value as TokenSymbol)}
                          className="appearance-none glass-effect rounded-lg pl-2 pr-8 py-1 text-sm sm:text-base text-white font-semibold cursor-pointer hover:border-cyan-400/50 transition-all duration-200 border border-purple-500/30 focus:border-cyan-400/70 outline-none min-h-[40px]"
                        >
                          {(Object.keys(TOKENS) as TokenSymbol[]).map((token) => (
                            <option key={token} value={token} className="bg-gray-800">
                              {`${getTokenTextIcon(token)} ${token}`}
                            </option>
                          ))}
                        </select>
                        <i className="fas fa-chevron-down absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1 sm:gap-2">
                      <button
                        onClick={() => setFromAmount((parseFloat(balances[fromToken]) * 0.25).toString())}
                        className="py-2 sm:py-3 px-1 sm:px-2 text-xs font-semibold text-cyan-300 hover:text-white rounded-lg glass-effect border border-cyan-500/40 hover:border-cyan-400/70 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-400/30 min-h-[36px] sm:min-h-[44px]"
                      >
                        25%
                      </button>
                      <button
                        onClick={() => setFromAmount((parseFloat(balances[fromToken]) * 0.5).toString())}
                        className="py-2 sm:py-3 px-1 sm:px-2 text-xs font-semibold text-cyan-300 hover:text-white rounded-lg glass-effect border border-cyan-500/40 hover:border-cyan-400/70 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-400/30 min-h-[36px] sm:min-h-[44px]"
                      >
                        50%
                      </button>
                      <button
                        onClick={() => setFromAmount((parseFloat(balances[fromToken]) * 0.75).toString())}
                        className="py-2 sm:py-3 px-1 sm:px-2 text-xs font-semibold text-cyan-300 hover:text-white rounded-lg glass-effect border border-cyan-500/40 hover:border-cyan-400/70 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-400/30 min-h-[36px] sm:min-h-[44px]"
                      >
                        75%
                      </button>
                      <button
                        onClick={() => setFromAmount(balances[fromToken])}
                        className="py-2 sm:py-3 px-1 sm:px-2 text-xs font-semibold text-cyan-300 hover:text-white rounded-lg glass-effect border border-cyan-500/40 hover:border-cyan-400/70 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-400/30 min-h-[36px] sm:min-h-[44px]"
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                </div>

                {/* Swap Button - Improved spacing */}
                <div className="flex justify-center py-2">
                  <button
                    onClick={handleSwapTokens}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full glass-effect border-2 border-cyan-500/40 hover:border-cyan-400/70 text-cyan-300 hover:text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-cyan-400/30 font-medium flex items-center justify-center"
                    title="Swap token positions"
                  >
                    <i className="fas fa-arrow-down text-sm sm:text-base"></i>
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
                  <div className="glass-effect rounded-lg p-3 sm:p-4 border border-gray-600/30">
                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                      <input
                        type="number"
                        value={toAmount}
                        readOnly
                        placeholder="0.00"
                        className="bg-transparent text-base sm:text-lg font-semibold text-white placeholder-slate-400 flex-1 outline-none w-full py-2 min-w-0"
                      />
                      <div className="relative flex-shrink-0">
                        <select
                          value={toToken}
                          onChange={(e) => setToToken(e.target.value as TokenSymbol)}
                          className="appearance-none glass-effect rounded-lg pl-2 pr-8 py-1 text-sm sm:text-base text-white font-semibold cursor-pointer hover:border-cyan-400/50 transition-all duration-200 border border-purple-500/30 focus:border-cyan-400/70 outline-none min-h-[40px]"
                        >
                          {(Object.keys(TOKENS) as TokenSymbol[]).map((token) => (
                            <option key={token} value={token} className="bg-gray-800">
                              {`${getTokenTextIcon(token)} ${token}`}
                            </option>
                          ))}
                        </select>
                        <i className="fas fa-chevron-down absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Swap Details */}
                {quote && (
                  <div className={`glass-effect rounded-lg p-4 space-y-2 text-sm border ${quote.isMultiHop ? 'border-purple-500/50' : quoteMethod === 'scaffold-eth' ? 'border-green-500/50' : 'border-gray-600/30'}`}>
                    {/* Quote Method Indicator */}
                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-500/30">
                      {quoteMethod === 'scaffold-eth' ? (
                        <span className="text-green-300 font-medium text-xs">🏗 Scaffold-ETH Pattern</span>
                      ) : quoteMethod === 'original' ? (
                        <span className="text-blue-300 font-medium text-xs">🔧 Original Pattern</span>
                      ) : (
                        <span className="text-gray-300 font-medium text-xs">📊 Quote Details</span>
                      )}
                      {quote.isMultiHop && (
                        <div className="text-purple-400 text-xs overflow-hidden">
                          <span className="hidden sm:inline">{quote.route}</span>
                          <span className="sm:hidden" title={quote.route}>
                            {formatRoute(quote.route || '', 'mobile')}
                          </span>
                        </div>
                      )}
                    </div>
                    {quote.isMultiHop && (
                      <div className="flex justify-between items-center mb-2 pb-2 border-b border-purple-500/30">
                        <span className="text-purple-300 font-medium">🔀 Multi-Hop Swap</span>
                        <div className="text-purple-400 text-xs overflow-hidden">
                          <span className="hidden sm:inline">{quote.route}</span>
                          <span className="sm:hidden" title={quote.route}>
                            {formatRoute(quote.route || '', 'mobile')}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">Exchange Rate:</span>
                      <span className="text-white">
                        1 {fromToken} = {quote.exchangeRate.toFixed(fromToken === 'TTRUST' ? 0 : 6)} {toToken}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Price Impact:</span>
                      <span className={`${quote.priceImpact < 1 ? 'text-green-400' : quote.priceImpact < 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {quote.priceImpact.toFixed(2)}%{quote.isMultiHop ? ' (composé)' : ''}
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
                    {quote.isMultiHop && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Frais estimés:</span>
                        <span className="text-orange-400">~0.6% (2 swaps)</span>
                      </div>
                    )}
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
                  <div className="text-xl sm:text-2xl font-bold text-green-400 overflow-hidden">
                    <span className="hidden sm:inline">
                      1 : {dexStats.currentPrice > 0 ? formatLargeNumber(dexStats.currentPrice, '', 'desktop') : '500K'}
                    </span>
                    <span className="sm:hidden">
                      1 : {dexStats.currentPrice > 0 ? formatLargeNumber(dexStats.currentPrice, '', 'mobile') : '500K'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 mt-1 overflow-hidden">
                    <span className="hidden sm:inline">
                      1 TTRUST = {dexStats.currentPrice > 0 ? formatLargeNumber(dexStats.currentPrice, 'ORACLE', 'desktop') : '500K ORACLE'}
                    </span>
                    <span className="sm:hidden">
                      1 TTR = {dexStats.currentPrice > 0 ? formatLargeNumber(dexStats.currentPrice, 'ORC', 'mobile') : '500K ORC'}
                    </span>
                  </div>
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
                  <div className="text-xl sm:text-2xl font-bold text-cyan-400 overflow-hidden">
                    <span className="hidden sm:inline">
                      {dexStats.currentPrice > 0 ? formatLargeNumber(dexStats.currentPrice, '', 'desktop') : '500K'} : 1
                    </span>
                    <span className="sm:hidden">
                      {dexStats.currentPrice > 0 ? formatLargeNumber(dexStats.currentPrice, '', 'mobile') : '500K'} : 1
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 mt-1 overflow-hidden">
                    <span className="hidden sm:inline">
                      {dexStats.currentPrice > 0 ? formatLargeNumber(dexStats.currentPrice, 'ORACLE', 'desktop') : '500K ORACLE'} = 1 TTRUST
                    </span>
                    <span className="sm:hidden">
                      {dexStats.currentPrice > 0 ? formatLargeNumber(dexStats.currentPrice, 'ORC', 'mobile') : '500K ORC'} = 1 TTR
                    </span>
                  </div>
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
                      <div className="font-mono">
                        <span className="hidden sm:inline">{parseFloat(dexStats.ethReserve).toFixed(4)} TTRUST</span>
                        <span className="sm:hidden">{formatLargeNumber(dexStats.ethReserve, 'TTR', 'mobile')}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-blue-200">ORACLE Reserve:</p>
                      <div className="font-mono overflow-hidden">
                        <span className="hidden sm:inline">{formatLargeNumber(dexStats.oracleReserve, 'ORACLE', 'desktop')}</span>
                        <span className="sm:hidden">{formatLargeNumber(dexStats.oracleReserve, 'ORC', 'mobile')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-gray-300 mt-2">
                    <div>
                      <p className="text-blue-200">Total Volume:</p>
                      <div className="font-mono overflow-hidden">
                        <span className="hidden sm:inline">{formatLargeNumber(dexStats.totalVolume, 'TTRUST', 'desktop')}</span>
                        <span className="sm:hidden">{formatLargeNumber(dexStats.totalVolume, 'TTR', 'mobile')}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-blue-200">Total Trades:</p>
                      <div className="font-mono overflow-hidden">
                        <span className="hidden sm:inline">{formatLargeNumber(dexStats.totalTrades, '', 'desktop')}</span>
                        <span className="sm:hidden">{formatLargeNumber(dexStats.totalTrades, '', 'mobile')}</span>
                      </div>
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

                    // Handle errors gracefully
                    if (dexInfo.error) {
                      return (
                        <div className="bg-red-900/20 rounded-lg p-4 border border-red-500/30">
                          <div className="mb-3">
                            <span className="text-sm text-red-400">Erreur:</span>
                            <p className="text-lg font-bold text-red-300">{dexInfo.error}</p>
                          </div>
                        </div>
                      );
                    }

                    const pairName = dexInfo.isMultiHop
                      ? `${fromToken} → tTRUST → ${toToken} (Multi-hop)`
                      : fromToken === 'tTRUST' && toToken === 'ORACLE' ? 'tTRUST/ORACLE' :
                        fromToken === 'tTRUST' && toToken === 'INTUIT' ? 'tTRUST/INTUIT' :
                        fromToken === 'tTRUST' && toToken === 'TSWP' ? 'tTRUST/TSWP' :
                        fromToken === 'tTRUST' && toToken === 'PINTU' ? 'tTRUST/PINTU' :
                        `${fromToken}/${toToken}`;

                    return (
                      <div className={`bg-gray-800/50 rounded-lg p-4 border ${dexInfo.isMultiHop ? 'border-purple-500/30' : 'border-gray-600/30'}`}>
                        <div className="mb-3">
                          <span className="text-sm text-gray-400">Trading Pair:</span>
                          <p className="text-lg font-bold text-white">{pairName}</p>
                          {dexInfo.isMultiHop && (
                            <p className="text-sm text-purple-400 mt-1">
                              🔀 Routage via DEXRouter (en développement)
                            </p>
                          )}
                        </div>
                        {dexInfo.contractAddress && (
                          <ContractAddressLink
                            address={dexInfo.contractAddress}
                            label={dexInfo.isMultiHop ? "DEX Router" : "DEX Contract"}
                            className="text-sm"
                          />
                        )}
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
