import React from 'react'
import { INTUITION_TESTNET } from '../utils/constants'

interface ContractAddressLinkProps {
  address: string
  label?: string
  showIcon?: boolean
  className?: string
}

const ContractAddressLink: React.FC<ContractAddressLinkProps> = ({
  address,
  label = 'Contract',
  showIcon = true,
  className = ''
}) => {
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    return (
      <span className={`text-gray-500 ${className}`}>
        {label}: Native
      </span>
    )
  }

  const truncatedAddress = `${address.slice(0, 10)}...${address.slice(-4)}`
  const explorerUrl = `${INTUITION_TESTNET.blockExplorer}/address/${address}`

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span className="text-gray-500">{label}:</span>
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 transition-colors duration-200 flex items-center space-x-1 group"
        title={`View ${address} on Intuition Explorer`}
      >
        <span className="font-mono text-sm group-hover:underline">
          {truncatedAddress}
        </span>
        {showIcon && (
          <i className="fas fa-external-link-alt text-xs opacity-75 group-hover:opacity-100 transition-opacity" />
        )}
      </a>
    </div>
  )
}

export default ContractAddressLink