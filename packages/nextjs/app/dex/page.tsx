"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { ArrowsUpDownIcon } from "@heroicons/react/24/outline";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

interface Token {
  symbol: string;
  name: string;
  contractName: string;
  icon: string;
}

const TOKENS: Token[] = [
  { symbol: "tTRUST", name: "Native Token", contractName: "", icon: "🌐" },
  { symbol: "ORACLE", name: "Oracle Token", contractName: "OracleToken", icon: "🔮" },
  { symbol: "INTUIT", name: "INTUIT Token", contractName: "INTUITToken", icon: "🧠" },
  { symbol: "TSWP", name: "TSWP Token", contractName: "TSWPToken", icon: "🗳️" },
  { symbol: "PINTU", name: "PINTU Token", contractName: "PINTUToken", icon: "💎" },
];

const DEX_PAIRS = [
  { token1: "tTRUST", token2: "ORACLE", dexContract: "DEX" },
  { token1: "tTRUST", token2: "INTUIT", dexContract: "DEX_INTUIT" },
  { token1: "tTRUST", token2: "TSWP", dexContract: "DEX_TSWP" },
  { token1: "tTRUST", token2: "PINTU", dexContract: "DEX_PINTU" },
];

const DEXPage: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const [fromToken, setFromToken] = useState<Token>(TOKENS[0]);
  const [toToken, setToToken] = useState<Token>(TOKENS[1]);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [activePool, setActivePool] = useState("tTRUST/ORACLE");

  // Read balances
  const { data: fromTokenBalance } = useScaffoldReadContract({
    contractName: fromToken.contractName as any,
    functionName: "balanceOf",
    args: connectedAddress ? [connectedAddress] : undefined,
    enabled: !!fromToken.contractName && !!connectedAddress,
  });

  const { data: toTokenBalance } = useScaffoldReadContract({
    contractName: toToken.contractName as any,
    functionName: "balanceOf",
    args: connectedAddress ? [connectedAddress] : undefined,
    enabled: !!toToken.contractName && !!connectedAddress,
  });

  // Read DEX reserves for active pool
  const { data: dexStats } = useScaffoldReadContract({
    contractName: "DEX",
    functionName: "getDEXStats",
  });

  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleSwap = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      notification.error("Please enter a valid amount");
      return;
    }

    // Determine which DEX to use based on the pair
    const isDirect = DEX_PAIRS.some(
      pair =>
        (pair.token1 === fromToken.symbol && pair.token2 === toToken.symbol) ||
        (pair.token1 === toToken.symbol && pair.token2 === fromToken.symbol)
    );

    if (isDirect) {
      notification.info("Direct swap available!");
    } else {
      notification.info("Multi-hop swap via DEXRouter");
    }

    // TODO: Implement actual swap logic here
    notification.success("Swap functionality coming soon!");
  };

  return (
    <div className="flex flex-col items-center pt-10 px-4">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold mb-4">💱 Oracle-Lend DEX</h1>
          <p className="text-xl text-gray-600">
            Swap tokens instantly with automated market makers
          </p>
          {connectedAddress && (
            <div className="mt-4">
              <Address address={connectedAddress} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Swap Interface */}
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">Swap Tokens</h2>

              {/* From Token */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">From</span>
                  <span className="label-text-alt">
                    Balance: {fromToken.symbol === "tTRUST" ? "Native" :
                             fromTokenBalance ? formatEther(fromTokenBalance as bigint) : "0"}
                  </span>
                </label>
                <div className="flex gap-2">
                  <select
                    className="select select-bordered flex-1"
                    value={fromToken.symbol}
                    onChange={(e) => setFromToken(TOKENS.find(t => t.symbol === e.target.value) || TOKENS[0])}
                  >
                    {TOKENS.map(token => (
                      <option key={token.symbol} value={token.symbol}>
                        {token.icon} {token.symbol}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="0.0"
                    className="input input-bordered flex-1"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                  />
                </div>
              </div>

              {/* Swap Button */}
              <div className="flex justify-center my-4">
                <button
                  className="btn btn-circle btn-sm"
                  onClick={handleSwapTokens}
                >
                  <ArrowsUpDownIcon className="h-5 w-5" />
                </button>
              </div>

              {/* To Token */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">To</span>
                  <span className="label-text-alt">
                    Balance: {toToken.symbol === "tTRUST" ? "Native" :
                             toTokenBalance ? formatEther(toTokenBalance as bigint) : "0"}
                  </span>
                </label>
                <div className="flex gap-2">
                  <select
                    className="select select-bordered flex-1"
                    value={toToken.symbol}
                    onChange={(e) => setToToken(TOKENS.find(t => t.symbol === e.target.value) || TOKENS[1])}
                  >
                    {TOKENS.map(token => (
                      <option key={token.symbol} value={token.symbol}>
                        {token.icon} {token.symbol}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="0.0"
                    className="input input-bordered flex-1"
                    value={toAmount}
                    onChange={(e) => setToAmount(e.target.value)}
                    readOnly
                  />
                </div>
              </div>

              {/* Swap Info */}
              <div className="bg-base-300 rounded-lg p-3 mt-4 text-sm">
                <div className="flex justify-between mb-1">
                  <span>Price Impact</span>
                  <span className="text-warning">~0.3%</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Trading Fee</span>
                  <span>0.3%</span>
                </div>
                <div className="flex justify-between">
                  <span>Route</span>
                  <span className="text-primary">
                    {fromToken.symbol} → {toToken.symbol}
                  </span>
                </div>
              </div>

              <button
                className="btn btn-primary w-full mt-6"
                onClick={handleSwap}
                disabled={!connectedAddress || !fromAmount}
              >
                {!connectedAddress ? "Connect Wallet" : "Swap"}
              </button>
            </div>
          </div>

          {/* Liquidity Pools */}
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">Liquidity Pools</h2>

              <div className="space-y-3">
                {DEX_PAIRS.map((pair) => (
                  <div
                    key={`${pair.token1}/${pair.token2}`}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${
                      activePool === `${pair.token1}/${pair.token2}`
                        ? "bg-primary text-primary-content"
                        : "bg-base-300 hover:bg-base-100"
                    }`}
                    onClick={() => setActivePool(`${pair.token1}/${pair.token2}`)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold">{pair.token1}/{pair.token2}</p>
                        <p className="text-sm opacity-75">Direct Pool</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">TVL</p>
                        <p className="font-mono">$0.00</p>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="divider">Multi-Hop Pairs</div>

                <div className="p-4 rounded-lg bg-base-300">
                  <p className="font-bold mb-2">Available via Router:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>• ORACLE ↔ INTUIT</div>
                    <div>• ORACLE ↔ TSWP</div>
                    <div>• ORACLE ↔ PINTU</div>
                    <div>• INTUIT ↔ TSWP</div>
                    <div>• INTUIT ↔ PINTU</div>
                    <div>• TSWP ↔ PINTU</div>
                  </div>
                </div>
              </div>

              <button className="btn btn-outline w-full mt-6">
                Add Liquidity
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="card bg-base-200 shadow-xl mt-6">
          <div className="card-body">
            <h3 className="text-xl font-bold mb-4">📊 DEX Statistics</h3>
            <div className="stats shadow w-full">
              <div className="stat">
                <div className="stat-title">Total Volume</div>
                <div className="stat-value">$0</div>
                <div className="stat-desc">24h</div>
              </div>
              <div className="stat">
                <div className="stat-title">Total Trades</div>
                <div className="stat-value">0</div>
                <div className="stat-desc">All time</div>
              </div>
              <div className="stat">
                <div className="stat-title">Active Pools</div>
                <div className="stat-value">4</div>
                <div className="stat-desc">Direct pairs</div>
              </div>
              <div className="stat">
                <div className="stat-title">Total TVL</div>
                <div className="stat-value">$0</div>
                <div className="stat-desc">Across all pools</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DEXPage;