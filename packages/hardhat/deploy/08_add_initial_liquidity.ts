import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";
import * as fs from "fs";
import * as path from "path";

// Load deployment configuration
const configPath = path.join(__dirname, "..", "config.json");
const deploymentConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

/**
 * Add initial liquidity to all new DEX pairs using official config.json ratios
 *
 * This script provides initial liquidity for:
 * - DEX_INTUIT: 2000 tTRUST + 10,000 INTUIT (1:5 ratio)
 * - DEX_TSWP: 2000 tTRUST + 5,000 TSWP (1:2.5 ratio)
 * - DEX_PINTU: 2000 tTRUST + 1,000 PINTU (1:0.5 ratio)
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const addInitialLiquidity: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  console.log("💧 Adding initial liquidity to new DEX pairs...");
  console.log("📋 Using liquidity configuration from:", path.basename(configPath));

  // Get deployed contracts
  const intuitToken = await hre.ethers.getContract<Contract>("INTUITToken", deployer);
  const tswpToken = await hre.ethers.getContract<Contract>("TSWPToken", deployer);
  const pintuToken = await hre.ethers.getContract<Contract>("PINTUToken", deployer);

  const dexIntuit = await hre.ethers.getContract<Contract>("DEX_INTUIT", deployer);
  const dexTswp = await hre.ethers.getContract<Contract>("DEX_TSWP", deployer);
  const dexPintu = await hre.ethers.getContract<Contract>("DEX_PINTU", deployer);

  // Parse liquidity amounts from config
  const tTrustAmount = hre.ethers.parseEther(deploymentConfig.distribution.dexLiquidity.ttrust);
  const intuitAmount = hre.ethers.parseEther(deploymentConfig.distribution.dexLiquidity.intuit);
  const tswpAmount = hre.ethers.parseEther(deploymentConfig.distribution.dexLiquidity.tswp);
  const pintuAmount = hre.ethers.parseEther(deploymentConfig.distribution.dexLiquidity.pintu);

  console.log("\n📊 Liquidity Configuration:");
  console.log(`   Base tTRUST amount: ${hre.ethers.formatEther(tTrustAmount)} tTRUST`);
  console.log(`   INTUIT amount: ${hre.ethers.formatEther(intuitAmount)} INTUIT (ratio 1:${deploymentConfig.distribution.dexLiquidity.intuit / deploymentConfig.distribution.dexLiquidity.ttrust})`);
  console.log(`   TSWP amount: ${hre.ethers.formatEther(tswpAmount)} TSWP (ratio 1:${deploymentConfig.distribution.dexLiquidity.tswp / deploymentConfig.distribution.dexLiquidity.ttrust})`);
  console.log(`   PINTU amount: ${hre.ethers.formatEther(pintuAmount)} PINTU (ratio 1:${deploymentConfig.distribution.dexLiquidity.pintu / deploymentConfig.distribution.dexLiquidity.ttrust})`);

  // 1. Add liquidity to DEX_INTUIT
  console.log("\n1️⃣ Adding liquidity to DEX_INTUIT (tTRUST/INTUIT)...");

  // Approve INTUIT tokens for DEX_INTUIT
  await intuitToken.approve(await dexIntuit.getAddress(), intuitAmount);
  console.log(`   ✅ Approved ${hre.ethers.formatEther(intuitAmount)} INTUIT for DEX_INTUIT`);

  // Add liquidity (native tTRUST + INTUIT tokens)
  const tx1 = await dexIntuit.addLiquidity(0, intuitAmount, { value: tTrustAmount });
  await tx1.wait();
  console.log(`   ✅ Added liquidity: ${hre.ethers.formatEther(tTrustAmount)} tTRUST + ${hre.ethers.formatEther(intuitAmount)} INTUIT`);

  // 2. Add liquidity to DEX_TSWP
  console.log("\n2️⃣ Adding liquidity to DEX_TSWP (tTRUST/TSWP)...");

  // Approve TSWP tokens for DEX_TSWP
  await tswpToken.approve(await dexTswp.getAddress(), tswpAmount);
  console.log(`   ✅ Approved ${hre.ethers.formatEther(tswpAmount)} TSWP for DEX_TSWP`);

  // Add liquidity (native tTRUST + TSWP tokens)
  const tx2 = await dexTswp.addLiquidity(0, tswpAmount, { value: tTrustAmount });
  await tx2.wait();
  console.log(`   ✅ Added liquidity: ${hre.ethers.formatEther(tTrustAmount)} tTRUST + ${hre.ethers.formatEther(tswpAmount)} TSWP`);

  // 3. Add liquidity to DEX_PINTU
  console.log("\n3️⃣ Adding liquidity to DEX_PINTU (tTRUST/PINTU)...");

  // Approve PINTU tokens for DEX_PINTU
  await pintuToken.approve(await dexPintu.getAddress(), pintuAmount);
  console.log(`   ✅ Approved ${hre.ethers.formatEther(pintuAmount)} PINTU for DEX_PINTU`);

  // Add liquidity (native tTRUST + PINTU tokens)
  const tx3 = await dexPintu.addLiquidity(0, pintuAmount, { value: tTrustAmount });
  await tx3.wait();
  console.log(`   ✅ Added liquidity: ${hre.ethers.formatEther(tTrustAmount)} tTRUST + ${hre.ethers.formatEther(pintuAmount)} PINTU`);

  // 4. Verify all pools have liquidity
  console.log("\n🔍 Verifying liquidity pools...");

  const intuitStats = await dexIntuit.getDEXStats();
  const tswpStats = await dexTswp.getDEXStats();
  const pintuStats = await dexPintu.getDEXStats();

  console.log("\n📊 DEX Pool Status:");
  console.log(`   DEX_INTUIT: ${hre.ethers.formatEther(intuitStats[0])} tTRUST + ${hre.ethers.formatEther(intuitStats[1])} INTUIT`);
  console.log(`   DEX_TSWP: ${hre.ethers.formatEther(tswpStats[0])} tTRUST + ${hre.ethers.formatEther(tswpStats[1])} TSWP`);
  console.log(`   DEX_PINTU: ${hre.ethers.formatEther(pintuStats[0])} tTRUST + ${hre.ethers.formatEther(pintuStats[1])} PINTU`);

  // 5. Log current exchange rates
  console.log("\n💱 Initial Exchange Rates:");
  console.log(`   1 tTRUST = ${deploymentConfig.distribution.dexLiquidity.intuit / deploymentConfig.distribution.dexLiquidity.ttrust} INTUIT`);
  console.log(`   1 tTRUST = ${deploymentConfig.distribution.dexLiquidity.tswp / deploymentConfig.distribution.dexLiquidity.ttrust} TSWP`);
  console.log(`   1 tTRUST = ${deploymentConfig.distribution.dexLiquidity.pintu / deploymentConfig.distribution.dexLiquidity.ttrust} PINTU`);

  console.log("\n✨ All liquidity pools created successfully!");
  console.log("\n🎯 Ready for trading:");
  console.log("• Users can now swap between tTRUST and any of the new tokens");
  console.log("• DEX contracts are fully functional with initial price discovery");
  console.log("• Liquidity providers can add/remove liquidity as needed");
  console.log("• All 4 trading pairs are now active in the ecosystem");
};

export default addInitialLiquidity;

// This deployment depends on the new tokens and DEX contracts
addInitialLiquidity.dependencies = ["NewTokens", "NewDEXs"];
addInitialLiquidity.tags = ["InitialLiquidity"];