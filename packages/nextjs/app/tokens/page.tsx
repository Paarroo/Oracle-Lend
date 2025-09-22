"use client";

import { useState, useEffect } from "react";
import type { NextPage } from "next";
import { formatEther } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

interface TokenInfo {
  name: string;
  symbol: string;
  supply: string;
  maxSupply: string;
  features: string[];
  contractName: string;
  color: string;
  icon: string;
}

const TOKENS: TokenInfo[] = [
  {
    name: "Oracle Token",
    symbol: "ORACLE",
    supply: "10000000",
    maxSupply: "10000000",
    features: ["Lending Protocol", "Burnable", "Pausable"],
    contractName: "OracleToken",
    color: "bg-purple-500",
    icon: "🔮"
  },
  {
    name: "INTUIT Token",
    symbol: "INTUIT",
    supply: "100000000",
    maxSupply: "100000000",
    features: ["Prediction Markets", "Burnable", "Deflationary"],
    contractName: "INTUITToken",
    color: "bg-blue-500",
    icon: "🧠"
  },
  {
    name: "TSWP Token",
    symbol: "TSWP",
    supply: "50000000",
    maxSupply: "50000000",
    features: ["Governance", "Voting", "Proposals"],
    contractName: "TSWPToken",
    color: "bg-green-500",
    icon: "🗳️"
  },
  {
    name: "PINTU Token",
    symbol: "PINTU",
    supply: "10000000",
    maxSupply: "15000000",
    features: ["12% APR Staking", "Rewards", "Monthly Burn"],
    contractName: "PINTUToken",
    color: "bg-yellow-500",
    icon: "💎"
  }
];

const TokenCard: React.FC<{ token: TokenInfo; address: string | undefined }> = ({ token, address }) => {
  const [balance, setBalance] = useState<string>("0");
  const [stakedAmount, setStakedAmount] = useState<string>("0");
  const [pendingRewards, setPendingRewards] = useState<string>("0");

  // Read token balance
  const { data: tokenBalance } = useScaffoldReadContract({
    contractName: token.contractName as any,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  // For PINTU, read staking info
  const { data: stakingInfo } = useScaffoldReadContract({
    contractName: "PINTUToken",
    functionName: "getStakingInfo",
    args: address ? [address] : undefined,
    enabled: token.symbol === "PINTU" && !!address,
  });

  useEffect(() => {
    if (tokenBalance) {
      setBalance(formatEther(tokenBalance as bigint));
    }
    if (stakingInfo && token.symbol === "PINTU") {
      const [staked, pending] = stakingInfo as [bigint, bigint];
      setStakedAmount(formatEther(staked));
      setPendingRewards(formatEther(pending));
    }
  }, [tokenBalance, stakingInfo, token.symbol]);

  return (
    <div className="card bg-base-200 shadow-xl hover:shadow-2xl transition-all">
      <div className={`h-2 ${token.color}`}></div>
      <div className="card-body">
        <div className="flex items-center justify-between">
          <h2 className="card-title text-2xl">
            <span className="text-4xl mr-2">{token.icon}</span>
            {token.name}
          </h2>
          <div className="badge badge-lg badge-outline">{token.symbol}</div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Total Supply:</span>
            <span className="font-mono">{parseInt(token.supply).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Max Supply:</span>
            <span className="font-mono">{parseInt(token.maxSupply).toLocaleString()}</span>
          </div>
          {address && (
            <div className="flex justify-between">
              <span className="text-gray-500">Your Balance:</span>
              <span className="font-mono text-primary">{parseFloat(balance).toFixed(4)}</span>
            </div>
          )}
        </div>

        {token.symbol === "PINTU" && address && (
          <div className="mt-4 p-3 bg-base-300 rounded-lg">
            <h3 className="font-bold mb-2">🎯 Staking Info</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Staked:</span>
                <span className="font-mono">{parseFloat(stakedAmount).toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span>Pending Rewards:</span>
                <span className="font-mono text-success">{parseFloat(pendingRewards).toFixed(6)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {token.features.map((feature, idx) => (
              <div key={idx} className="badge badge-sm badge-primary">
                {feature}
              </div>
            ))}
          </div>
        </div>

        <div className="card-actions justify-end mt-4">
          {token.symbol === "ORACLE" && (
            <button className="btn btn-sm btn-primary">Open Lending</button>
          )}
          {token.symbol === "INTUIT" && (
            <button className="btn btn-sm btn-primary">Burn Tokens</button>
          )}
          {token.symbol === "TSWP" && (
            <button className="btn btn-sm btn-primary">Vote</button>
          )}
          {token.symbol === "PINTU" && (
            <button className="btn btn-sm btn-primary">Stake</button>
          )}
          <button className="btn btn-sm btn-outline">Trade</button>
        </div>
      </div>
    </div>
  );
};

const TokensPage: NextPage = () => {
  const { address: connectedAddress } = useAccount();

  return (
    <div className="flex flex-col items-center pt-10 px-4">
      <div className="w-full max-w-7xl">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold mb-4">🌟 Oracle-Lend Token Ecosystem</h1>
          <p className="text-xl text-gray-600">
            Explore our multi-token DeFi ecosystem with unique utilities
          </p>
          {connectedAddress && (
            <div className="mt-4">
              <p className="text-sm text-gray-500">Connected Wallet:</p>
              <Address address={connectedAddress} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {TOKENS.map((token) => (
            <TokenCard key={token.symbol} token={token} address={connectedAddress} />
          ))}
        </div>

        <div className="card bg-base-200 shadow-xl p-6 mb-10">
          <h2 className="text-2xl font-bold mb-4">🔄 Trading Pairs</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-base-300 rounded">
              <p className="font-mono">tTRUST/ORACLE</p>
              <p className="text-xs text-gray-500">Direct</p>
            </div>
            <div className="text-center p-3 bg-base-300 rounded">
              <p className="font-mono">tTRUST/INTUIT</p>
              <p className="text-xs text-gray-500">Direct</p>
            </div>
            <div className="text-center p-3 bg-base-300 rounded">
              <p className="font-mono">tTRUST/TSWP</p>
              <p className="text-xs text-gray-500">Direct</p>
            </div>
            <div className="text-center p-3 bg-base-300 rounded">
              <p className="font-mono">tTRUST/PINTU</p>
              <p className="text-xs text-gray-500">Direct</p>
            </div>
            <div className="text-center p-3 bg-base-300 rounded">
              <p className="font-mono">ORACLE/INTUIT</p>
              <p className="text-xs text-gray-500">Via Router</p>
            </div>
            <div className="text-center p-3 bg-base-300 rounded">
              <p className="font-mono">ORACLE/TSWP</p>
              <p className="text-xs text-gray-500">Via Router</p>
            </div>
            <div className="text-center p-3 bg-base-300 rounded">
              <p className="font-mono">INTUIT/PINTU</p>
              <p className="text-xs text-gray-500">Via Router</p>
            </div>
            <div className="text-center p-3 bg-base-300 rounded">
              <p className="font-mono">TSWP/PINTU</p>
              <p className="text-xs text-gray-500">Via Router</p>
            </div>
          </div>
        </div>

        <div className="text-center text-gray-500 mb-10">
          <p>💡 Use DEXRouter for multi-hop swaps between any token pairs</p>
          <p className="text-sm mt-2">All indirect pairs route through tTRUST for optimal liquidity</p>
        </div>
      </div>
    </div>
  );
};

export default TokensPage;