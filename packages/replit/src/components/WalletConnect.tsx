import React, { useState, useEffect, useRef } from 'react'
import ContractAddressLink from './ContractAddressLink'

interface WalletConnectProps {
  isConnected: boolean
  account: string | null
  connectWallet: () => void
  disconnectWallet: () => void
  isInitializing?: boolean
}

const WalletConnect: React.FC<WalletConnectProps> = ({
  isConnected,
  account,
  connectWallet,
  disconnectWallet,
  isInitializing = false
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDropdownOpen && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('click', handleClickOutside)
    }

    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isDropdownOpen])

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  // Show loading state during initialization
  if (isInitializing) {
    return (
      <button
        disabled
        className="flex items-center space-x-2 px-4 py-2 bg-gray-600/50 text-gray-400 rounded-lg cursor-not-allowed"
      >
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        <span className="font-medium">Checking...</span>
      </button>
    )
  }

  if (!isConnected) {
    return (
      <button
        onClick={connectWallet}
        className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-purple-500/25"
      >
        <i className="fas fa-wallet"></i>
        <span className="font-medium">Connect Wallet</span>
      </button>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-2 px-4 py-2 glass-effect border border-green-500/30 text-green-300 rounded-lg transition-all duration-200 hover:bg-green-500/10"
      >
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        <span className="font-medium">{formatAddress(account!)}</span>
        <i className={`fas fa-chevron-${isDropdownOpen ? 'up' : 'down'} text-xs`}></i>
      </button>

      {isDropdownOpen && (
        <div
          className="absolute right-0 mt-2 w-80 bg-black/95 backdrop-blur-xl border border-gray-600/60 rounded-xl shadow-2xl z-[60] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Section */}
          <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-gray-700/50 p-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
                <i className="fas fa-wallet text-white text-lg"></i>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">Wallet Connected</h3>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-400 font-medium">Active Session</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4">
            {/* Address Section */}
            <div className="mb-6">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                Wallet Address
              </label>
              <div className="bg-gradient-to-r from-gray-800/95 to-gray-700/95 rounded-lg p-3 border border-gray-600/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                      <i className="fas fa-user text-white text-xs"></i>
                    </div>
                    <span className="text-sm font-mono text-white font-medium">{formatAddress(account!)}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(account!)}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      copySuccess
                        ? 'bg-green-500/40 text-green-400 border border-green-500/50'
                        : 'hover:bg-gray-600/80 text-gray-400 hover:text-white'
                    }`}
                    title={copySuccess ? "Copied!" : "Copy address"}
                  >
                    <i className={`fas ${copySuccess ? 'fa-check' : 'fa-copy'} text-xs`}></i>
                  </button>
                </div>
              </div>
            </div>

            {/* Network Information */}
            <div className="mb-6">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 block">
                Network Details
              </label>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-800/90 rounded-lg border border-gray-600/70">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-green-500/40 to-emerald-500/40 flex items-center justify-center border border-green-500/50">
                      <i className="fas fa-network-wired text-green-400 text-sm"></i>
                    </div>
                    <span className="text-sm text-gray-400">Network</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-sm font-medium text-green-400">Intuition Testnet</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-800/90 rounded-lg border border-gray-600/70">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500/40 to-cyan-500/40 flex items-center justify-center border border-blue-500/50">
                      <i className="fas fa-hashtag text-blue-400 text-sm"></i>
                    </div>
                    <span className="text-sm text-gray-400">Chain ID</span>
                  </div>
                  <span className="text-sm font-mono text-white font-medium">13579</span>
                </div>
              </div>
            </div>

            {/* Actions Section */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                Quick Actions
              </label>

              {/* View on Explorer Button */}
              <div className="bg-gray-800/90 rounded-lg p-3 border border-gray-600/70">
                <ContractAddressLink
                  address={account!}
                  label="View Address on Explorer"
                  className="text-sm w-full"
                  showIcon={true}
                />
              </div>

              {/* Disconnect Button */}
              <button
                onClick={() => {
                  disconnectWallet()
                  setIsDropdownOpen(false)
                }}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-red-600/20 to-red-500/20 border border-red-500/40 text-red-300 rounded-lg hover:from-red-600/30 hover:to-red-500/30 hover:border-red-500/60 transition-all duration-200 group"
              >
                <i className="fas fa-sign-out-alt group-hover:scale-110 transition-transform"></i>
                <span className="font-medium">Disconnect Wallet</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop visuel seulement */}
      {isDropdownOpen && (
        <div className="fixed inset-0 z-35 bg-black/40 transition-all duration-200 pointer-events-none"></div>
      )}
    </div>
  )
}

export default WalletConnect
