import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";
import * as fs from "fs";
import * as path from "path";

// Load deployment configuration
const configPath = path.join(__dirname, "..", "config.json");

/**
 * Deploys the DEXRouter and sets up the multi-token ecosystem
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployDEXRouter: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("🚀 Deploying DEXRouter and setting up multi-token ecosystem...");

  // Get all deployed contracts
  const oracleToken = await hre.ethers.getContract<Contract>("OracleToken", deployer);
  const intuitToken = await hre.ethers.getContract<Contract>("INTUITToken", deployer);
  const tswpToken = await hre.ethers.getContract<Contract>("TSWPToken", deployer);
  const pintuToken = await hre.ethers.getContract<Contract>("PINTUToken", deployer);

  const dexOracle = await hre.ethers.getContract<Contract>("DEX", deployer);
  const dexIntuit = await hre.ethers.getContract<Contract>("DEX_INTUIT", deployer);
  const dexTswp = await hre.ethers.getContract<Contract>("DEX_TSWP", deployer);
  const dexPintu = await hre.ethers.getContract<Contract>("DEX_PINTU", deployer);

  // Get addresses
  const tTrustAddress = "0x0000000000000000000000000000000000000000"; // Native token
  const oracleAddress = await oracleToken.getAddress();
  const intuitAddress = await intuitToken.getAddress();
  const tswpAddress = await tswpToken.getAddress();
  const pintuAddress = await pintuToken.getAddress();

  const dexOracleAddress = await dexOracle.getAddress();
  const dexIntuitAddress = await dexIntuit.getAddress();
  const dexTswpAddress = await dexTswp.getAddress();
  const dexPintuAddress = await dexPintu.getAddress();

  console.log("\n📋 Contract Addresses:");
  console.log("   Tokens:");
  console.log(`     tTRUST (native): ${tTrustAddress}`);
  console.log(`     ORACLE: ${oracleAddress}`);
  console.log(`     INTUIT: ${intuitAddress}`);
  console.log(`     TSWP: ${tswpAddress}`);
  console.log(`     PINTU: ${pintuAddress}`);
  console.log("   DEXs:");
  console.log(`     DEX (ORACLE): ${dexOracleAddress}`);
  console.log(`     DEX_INTUIT: ${dexIntuitAddress}`);
  console.log(`     DEX_TSWP: ${dexTswpAddress}`);
  console.log(`     DEX_PINTU: ${dexPintuAddress}`);

  // Deploy DEXRouter
  console.log("\n🔧 Deploying DEXRouter...");
  await deploy("DEXRouter", {
    from: deployer,
    args: [
      dexOracleAddress,
      dexIntuitAddress,
      dexTswpAddress,
      dexPintuAddress,
      tTrustAddress,
      oracleAddress,
      intuitAddress,
      tswpAddress,
      pintuAddress
    ],
    log: true,
    autoMine: true,
  });

  const dexRouter = await hre.ethers.getContract<Contract>("DEXRouter", deployer);
  console.log("✅ DEXRouter deployed at:", await dexRouter.getAddress());

  // Load config for liquidity amounts
  const deploymentConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

  console.log("\n💱 Setting up initial liquidity for new DEXs...");

  // Add liquidity to each new DEX with minimal amounts for testing
  const ethForEachDex = hre.ethers.parseEther("0.00001"); // Minimal ETH for each pool

  // Setup DEX_INTUIT liquidity
  console.log("\n1️⃣ Adding liquidity to DEX_INTUIT...");
  const intuitLiquidity = hre.ethers.parseEther("10000"); // 10K INTUIT
  await intuitToken.approve(dexIntuitAddress, intuitLiquidity);
  await dexIntuit.addLiquidity(0, intuitLiquidity, { value: ethForEachDex });
  console.log(`   Added: ${hre.ethers.formatEther(ethForEachDex)} tTRUST + ${hre.ethers.formatEther(intuitLiquidity)} INTUIT`);

  // Setup DEX_TSWP liquidity
  console.log("\n2️⃣ Adding liquidity to DEX_TSWP...");
  const tswpLiquidity = hre.ethers.parseEther("5000"); // 5K TSWP
  await tswpToken.approve(dexTswpAddress, tswpLiquidity);
  await dexTswp.addLiquidity(0, tswpLiquidity, { value: ethForEachDex });
  console.log(`   Added: ${hre.ethers.formatEther(ethForEachDex)} tTRUST + ${hre.ethers.formatEther(tswpLiquidity)} TSWP`);

  // Setup DEX_PINTU liquidity
  console.log("\n3️⃣ Adding liquidity to DEX_PINTU...");
  const pintuLiquidity = hre.ethers.parseEther("1000"); // 1K PINTU
  await pintuToken.approve(dexPintuAddress, pintuLiquidity);
  await dexPintu.addLiquidity(0, pintuLiquidity, { value: ethForEachDex });
  console.log(`   Added: ${hre.ethers.formatEther(ethForEachDex)} tTRUST + ${hre.ethers.formatEther(pintuLiquidity)} PINTU`);

  // Get final statistics
  console.log("\n📊 Final Ecosystem Statistics:");

  // Check DEX statistics
  const oracleStats = await dexOracle.getDEXStats();
  const intuitStats = await dexIntuit.getDEXStats();
  const tswpStats = await dexTswp.getDEXStats();
  const pintuStats = await dexPintu.getDEXStats();

  console.log("\n💱 DEX Liquidity:");
  console.log(`   DEX (ORACLE): ${hre.ethers.formatEther(oracleStats[0])} tTRUST / ${hre.ethers.formatEther(oracleStats[1])} ORACLE`);
  console.log(`   DEX_INTUIT: ${hre.ethers.formatEther(intuitStats[0])} tTRUST / ${hre.ethers.formatEther(intuitStats[1])} INTUIT`);
  console.log(`   DEX_TSWP: ${hre.ethers.formatEther(tswpStats[0])} tTRUST / ${hre.ethers.formatEther(tswpStats[1])} TSWP`);
  console.log(`   DEX_PINTU: ${hre.ethers.formatEther(pintuStats[0])} tTRUST / ${hre.ethers.formatEther(pintuStats[1])} PINTU`);

  console.log("\n✨ Multi-Token Ecosystem Setup Complete!");
  console.log("\n🎯 Available Features:");
  console.log("1. 💱 Direct swaps between tTRUST and any token");
  console.log("2. 🔄 Multi-hop swaps between any two tokens via DEXRouter");
  console.log("3. 📈 Price discovery across all trading pairs");
  console.log("4. 💰 Liquidity provision and LP token rewards");
  console.log("5. 🗳️ TSWP governance voting capabilities");
  console.log("6. 💎 PINTU staking with 12% APR rewards");
  console.log("\n📋 How to interact:");
  console.log("• Use DEXRouter.swap() for any token-to-token swaps");
  console.log("• Use individual DEXs for direct pair trading");
  console.log("• Stake PINTU tokens in PINTUToken contract for rewards");
  console.log("• Create governance proposals with TSWPToken");
};

export default deployDEXRouter;

// This deployment depends on all tokens and DEXs being deployed
deployDEXRouter.dependencies = ["NewTokens", "NewDEXs", "OracleToken", "DEX"];
deployDEXRouter.tags = ["DEXRouter", "MultiTokenEcosystem"];