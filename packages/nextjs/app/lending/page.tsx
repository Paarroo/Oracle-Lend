"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const LendingPage: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const [collateralAmount, setCollateralAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"deposit" | "borrow" | "repay">("deposit");

  // Read user position
  const { data: userPosition } = useScaffoldReadContract({
    contractName: "OracleLend",
    functionName: "getUserPosition",
    args: connectedAddress ? [connectedAddress] : undefined,
  });

  // Read Oracle price
  const { data: oraclePrice } = useScaffoldReadContract({
    contractName: "DEX",
    functionName: "getPrice",
    args: ["0x0000000000000000000000000000000000000000"], // tTRUST address
  });

  // Read contract Oracle balance
  const { data: contractOracleBalance } = useScaffoldReadContract({
    contractName: "OracleLend",
    functionName: "getContractOracleBalance",
  });

  const collateral = userPosition ? formatEther(userPosition[0] as bigint) : "0";
  const debt = userPosition ? formatEther(userPosition[1] as bigint) : "0";
  const maxBorrow = parseFloat(collateral) > 0 && oraclePrice
    ? (parseFloat(collateral) * parseFloat(formatEther(oraclePrice as bigint)) / 1.2).toFixed(4)
    : "0";

  const healthFactor = parseFloat(collateral) > 0 && parseFloat(debt) > 0
    ? ((parseFloat(collateral) * (oraclePrice ? parseFloat(formatEther(oraclePrice as bigint)) : 1)) / (parseFloat(debt) * 1.2)).toFixed(2)
    : "∞";

  const { writeContractAsync: addCollateral } = useScaffoldWriteContract("OracleLend");
  const { writeContractAsync: borrowOracle } = useScaffoldWriteContract("OracleLend");
  const { writeContractAsync: repayOracle } = useScaffoldWriteContract("OracleLend");
  const { writeContractAsync: withdrawCollateral } = useScaffoldWriteContract("OracleLend");

  const handleAddCollateral = async () => {
    if (!collateralAmount || parseFloat(collateralAmount) <= 0) {
      notification.error("Please enter a valid amount");
      return;
    }

    try {
      await addCollateral({
        functionName: "addCollateral",
        value: parseEther(collateralAmount),
      });
      notification.success("Collateral added successfully!");
      setCollateralAmount("");
    } catch (error) {
      notification.error("Failed to add collateral");
    }
  };

  const handleBorrow = async () => {
    if (!borrowAmount || parseFloat(borrowAmount) <= 0) {
      notification.error("Please enter a valid amount");
      return;
    }

    try {
      await borrowOracle({
        functionName: "borrowOracle",
        args: [parseEther(borrowAmount)],
      });
      notification.success("ORACLE tokens borrowed successfully!");
      setBorrowAmount("");
    } catch (error) {
      notification.error("Failed to borrow");
    }
  };

  const handleRepay = async () => {
    if (!repayAmount || parseFloat(repayAmount) <= 0) {
      notification.error("Please enter a valid amount");
      return;
    }

    try {
      await repayOracle({
        functionName: "repayOracle",
        args: [parseEther(repayAmount)],
      });
      notification.success("Debt repaid successfully!");
      setRepayAmount("");
    } catch (error) {
      notification.error("Failed to repay");
    }
  };

  return (
    <div className="flex flex-col items-center pt-10 px-4">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold mb-4">🏦 Oracle Lending Protocol</h1>
          <p className="text-xl text-gray-600">
            Borrow ORACLE tokens with ETH collateral
          </p>
          {connectedAddress && (
            <div className="mt-4">
              <Address address={connectedAddress} />
            </div>
          )}
        </div>

        {/* User Position Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          <div className="card bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-xl">
            <div className="card-body p-4">
              <h3 className="text-sm opacity-90">Collateral (ETH)</h3>
              <p className="text-2xl font-bold">{parseFloat(collateral).toFixed(4)}</p>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-purple-400 to-purple-600 text-white shadow-xl">
            <div className="card-body p-4">
              <h3 className="text-sm opacity-90">Debt (ORACLE)</h3>
              <p className="text-2xl font-bold">{parseFloat(debt).toFixed(4)}</p>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-400 to-green-600 text-white shadow-xl">
            <div className="card-body p-4">
              <h3 className="text-sm opacity-90">Health Factor</h3>
              <p className="text-2xl font-bold">{healthFactor}</p>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-xl">
            <div className="card-body p-4">
              <h3 className="text-sm opacity-90">Max Borrow</h3>
              <p className="text-2xl font-bold">{maxBorrow}</p>
            </div>
          </div>
        </div>

        {/* Main Interface */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <div className="tabs tabs-boxed mb-6">
              <a
                className={`tab ${activeTab === "deposit" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("deposit")}
              >
                Deposit
              </a>
              <a
                className={`tab ${activeTab === "borrow" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("borrow")}
              >
                Borrow
              </a>
              <a
                className={`tab ${activeTab === "repay" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("repay")}
              >
                Repay
              </a>
            </div>

            {activeTab === "deposit" && (
              <div>
                <h3 className="text-2xl font-bold mb-4">Deposit ETH Collateral</h3>
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">Amount (ETH)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="0.0"
                    className="input input-bordered w-full"
                    value={collateralAmount}
                    onChange={(e) => setCollateralAmount(e.target.value)}
                  />
                </div>

                <div className="bg-base-300 rounded-lg p-3 mt-4">
                  <p className="text-sm">Collateralization Ratio: 120%</p>
                  <p className="text-sm">You can borrow up to 83.33% of your collateral value in ORACLE</p>
                </div>

                <button
                  className="btn btn-primary w-full mt-6"
                  onClick={handleAddCollateral}
                  disabled={!connectedAddress || !collateralAmount}
                >
                  Deposit Collateral
                </button>
              </div>
            )}

            {activeTab === "borrow" && (
              <div>
                <h3 className="text-2xl font-bold mb-4">Borrow ORACLE Tokens</h3>
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">Amount (ORACLE)</span>
                    <span className="label-text-alt">Max: {maxBorrow}</span>
                  </label>
                  <input
                    type="number"
                    placeholder="0.0"
                    className="input input-bordered w-full"
                    value={borrowAmount}
                    onChange={(e) => setBorrowAmount(e.target.value)}
                  />
                </div>

                <div className="bg-base-300 rounded-lg p-3 mt-4">
                  <p className="text-sm">Available to Borrow: {contractOracleBalance ? formatEther(contractOracleBalance as bigint) : "0"} ORACLE</p>
                  <p className="text-sm">Interest Rate: Variable</p>
                </div>

                <button
                  className="btn btn-primary w-full mt-6"
                  onClick={handleBorrow}
                  disabled={!connectedAddress || !borrowAmount || parseFloat(collateral) === 0}
                >
                  Borrow ORACLE
                </button>
              </div>
            )}

            {activeTab === "repay" && (
              <div>
                <h3 className="text-2xl font-bold mb-4">Repay ORACLE Debt</h3>
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">Amount (ORACLE)</span>
                    <span className="label-text-alt">Debt: {debt}</span>
                  </label>
                  <input
                    type="number"
                    placeholder="0.0"
                    className="input input-bordered w-full"
                    value={repayAmount}
                    onChange={(e) => setRepayAmount(e.target.value)}
                  />
                </div>

                <button
                  className="btn btn-sm btn-outline mt-2"
                  onClick={() => setRepayAmount(debt)}
                >
                  Repay All
                </button>

                <button
                  className="btn btn-primary w-full mt-6"
                  onClick={handleRepay}
                  disabled={!connectedAddress || !repayAmount || parseFloat(debt) === 0}
                >
                  Repay Debt
                </button>

                {parseFloat(debt) === 0 && parseFloat(collateral) > 0 && (
                  <button
                    className="btn btn-secondary w-full mt-3"
                    onClick={async () => {
                      try {
                        await withdrawCollateral({
                          functionName: "withdrawCollateral",
                          args: [parseEther(collateral)],
                        });
                        notification.success("Collateral withdrawn!");
                      } catch (error) {
                        notification.error("Withdrawal failed");
                      }
                    }}
                  >
                    Withdraw Collateral
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Protocol Info */}
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
            <h3 className="font-bold">Liquidation Risk</h3>
            <div className="text-sm">
              Keep your Health Factor above 1.0 to avoid liquidation. Liquidators earn a 10% bonus.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LendingPage;