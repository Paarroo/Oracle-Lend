import React from 'react'
import { TOKENS } from '../utils/constants'

// Token type from constants
type TokenSymbol = keyof typeof TOKENS

interface TokenIconProps {
  token: TokenSymbol
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const TokenIcon: React.FC<TokenIconProps> = ({ token, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  }

  // Get icon from TOKENS constant (now all are emojis)
  const tokenData = TOKENS[token]
  const emoji = tokenData.icon

  const textSize = {
    sm: 'text-sm',
    md: 'text-base', 
    lg: 'text-xl',
    xl: 'text-2xl'
  }

  return (
    <span className={`${textSize[size]} ${className}`}>
      {emoji}
    </span>
  )
}

export default TokenIcon