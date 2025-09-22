"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/24/outline";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const StakingPage: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"stake" | "unstake">("stake");

  // Read PINTU balance
  const { data: pintuBalance } = useScaffoldReadContract({
    contractName: "PINTUToken",
    functionName: "balanceOf",
    args: connectedAddress ? [connectedAddress] : undefined,
  });

  // Read staking info
  const { data: stakingInfo } = useScaffoldReadContract({
    contractName: "PINTUToken",
    functionName: "getStakingInfo",
    args: connectedAddress ? [connectedAddress] : undefined,
  });

  // Read global stats
  const { data: globalStats } = useScaffoldReadContract({
    contractName: "PINTUToken",
    functionName: "getGlobalStats",
  });

  // Write functions
  const { writeContractAsync: stake, isPending: isStaking } = useScaffoldWriteContract("PINTUToken");
  const { writeContractAsync: unstake, isPending: isUnstaking } = useScaffoldWriteContract("PINTUToken");
  const { writeContractAsync: claimRewards, isPending: isClaiming } = useScaffoldWriteContract("PINTUToken");

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      notification.error("Please enter a valid amount");
      return;
    }

    try {
      await stake({
        functionName: "stake",
        args: [parseEther(stakeAmount)],
      });
      notification.success("Successfully staked PINTU tokens!");
      setStakeAmount("");
    } catch (error) {
      notification.error("Staking failed");
    }
  };

  const handleUnstake = async () => {
    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) {
      notification.error("Please enter a valid amount");
      return;
    }

    try {
      await unstake({
        functionName: "unstake",
        args: [parseEther(unstakeAmount)],
      });
      notification.success("Successfully unstaked PINTU tokens!");
      setUnstakeAmount("");
    } catch (error) {
      notification.error("Unstaking failed");
    }
  };

  const handleClaimRewards = async () => {
    try {
      await claimRewards({
        functionName: "claimRewards",
        args: [],
      });
      notification.success("Rewards claimed successfully!");
    } catch (error) {
      notification.error("Claiming rewards failed");
    }
  };

  const stakedAmount = stakingInfo ? formatEther(stakingInfo[0] as bigint) : "0";
  const pendingRewards = stakingInfo ? formatEther(stakingInfo[1] as bigint) : "0";
  const totalStakedGlobal = globalStats ? formatEther(globalStats[0] as bigint) : "0";
  const totalRewardsPaid = globalStats ? formatEther(globalStats[1] as bigint) : "0";

  return (
    <div className="flex flex-col items-center pt-10 px-4">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold mb-4">💎 PINTU Staking</h1>
          <p className="text-xl text-gray-600">
            Earn 12% APR by staking your PINTU tokens
          </p>
          {connectedAddress && (
            <div className="mt-4">
              <Address address={connectedAddress} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="card bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-xl">
            <div className="card-body">
              <h3 className="text-lg opacity-90">Your Staked Balance</h3>
              <p className="text-3xl font-bold">{parseFloat(stakedAmount).toFixed(4)}</p>
              <p className="text-sm opacity-75">PINTU</p>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-400 to-green-600 text-white shadow-xl">
            <div className="card-body">
              <h3 className="text-lg opacity-90">Pending Rewards</h3>
              <p className="text-3xl font-bold">{parseFloat(pendingRewards).toFixed(6)}</p>
              <p className="text-sm opacity-75">PINTU</p>
              {parseFloat(pendingRewards) > 0 && (
                <button
                  className="btn btn-sm btn-outline btn-white mt-2"
                  onClick={handleClaimRewards}
                  disabled={isClaiming}
                >
                  {isClaiming ? "Claiming..." : "Claim Rewards"}
                </button>
              )}
            </div>
          </div>

          <div className="card bg-gradient-to-br from-purple-400 to-purple-600 text-white shadow-xl">
            <div className="card-body">
              <h3 className="text-lg opacity-90">APR</h3>
              <p className="text-3xl font-bold">12%</p>
              <p className="text-sm opacity-75">Annual Percentage Rate</p>
            </div>
          </div>
        </div>

        <div className="card bg-base-200 shadow-xl mb-10">
          <div className="card-body">
            <div className="tabs tabs-boxed mb-6">
              <a
                className={`tab ${activeTab === "stake" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("stake")}
              >
                <ArrowDownIcon className="w-4 h-4 mr-2" />
                Stake
              </a>
              <a
                className={`tab ${activeTab === "unstake" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("unstake")}
              >
                <ArrowUpIcon className="w-4 h-4 mr-2" />
                Unstake
              </a>
            </div>

            {activeTab === "stake" && (
              <div>
                <h3 className="text-2xl font-bold mb-4">Stake PINTU Tokens</h3>
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">Amount to Stake</span>
                    <span className="label-text-alt">
                      Balance: {pintuBalance ? formatEther(pintuBalance as bigint) : "0"} PINTU
                    </span>
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      placeholder="0.0"
                      className="input input-bordered flex-1"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                    />
                    <button
                      className="btn btn-sm"
                      onClick={() => setStakeAmount(pintuBalance ? formatEther(pintuBalance as bigint) : "0")}
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <button
                  className="btn btn-primary w-full mt-6"
                  onClick={handleStake}
                  disabled={isStaking || !connectedAddress || !stakeAmount}
                >
                  {isStaking ? "Staking..." : "Stake PINTU"}
                </button>
              </div>
            )}

            {activeTab === "unstake" && (
              <div>
                <h3 className="text-2xl font-bold mb-4">Unstake PINTU Tokens</h3>
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">Amount to Unstake</span>
                    <span className="label-text-alt">
                      Staked: {stakedAmount} PINTU
                    </span>
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      placeholder="0.0"
                      className="input input-bordered flex-1"
                      value={unstakeAmount}
                      onChange={(e) => setUnstakeAmount(e.target.value)}
                    />
                    <button
                      className="btn btn-sm"
                      onClick={() => setUnstakeAmount(stakedAmount)}
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <button
                  className="btn btn-primary w-full mt-6"
                  onClick={handleUnstake}
                  disabled={isUnstaking || !connectedAddress || !unstakeAmount}
                >
                  {isUnstaking ? "Unstaking..." : "Unstake PINTU"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h3 className="text-2xl font-bold mb-4">📊 Global Staking Statistics</h3>
            <div className="stats shadow">
              <div className="stat">
                <div className="stat-title">Total Staked</div>
                <div className="stat-value text-primary">
                  {parseFloat(totalStakedGlobal).toFixed(2)}
                </div>
                <div className="stat-desc">PINTU tokens</div>
              </div>

              <div className="stat">
                <div className="stat-title">Total Rewards Paid</div>
                <div className="stat-value text-success">
                  {parseFloat(totalRewardsPaid).toFixed(2)}
                </div>
                <div className="stat-desc">PINTU tokens</div>
              </div>

              <div className="stat">
                <div className="stat-title">Pool APR</div>
                <div className="stat-value">12%</div>
                <div className="stat-desc">Annual returns</div>
              </div>
            </div>
          </div>
        </div>

        <div className="alert alert-info mt-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="stroke-current shrink-0 w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <div>
            <h3 className="font-bold">How it works:</h3>
            <div className="text-sm">
              Stake your PINTU tokens to earn 12% APR. Rewards are calculated per second and can be claimed anytime.
              There's no lock-up period - unstake whenever you want!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StakingPage;