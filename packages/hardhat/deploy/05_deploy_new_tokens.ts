import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deploys the new token contracts: INTUIT, TSWP, and PINTU
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployNewTokens: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("🚀 Deploying new tokens: INTUIT, TSWP, and PINTU...");

  // Deploy INTUIT Token
  console.log("\n1️⃣ Deploying INTUIT Token...");
  await deploy("INTUITToken", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  const intuitToken = await hre.ethers.getContract("INTUITToken", deployer);
  console.log("✅ INTUIT Token deployed at:", await intuitToken.getAddress());

  const intuitInfo = await intuitToken.getTokenInfo();
  console.log("📊 INTUIT Token Info:");
  console.log(`   Name: ${intuitInfo[0]}`);
  console.log(`   Symbol: ${intuitInfo[1]}`);
  console.log(`   Total Supply: ${hre.ethers.formatEther(intuitInfo[3])} INTUIT`);
  console.log(`   Max Supply: ${hre.ethers.formatEther(intuitInfo[4])} INTUIT`);

  // Deploy TSWP Token
  console.log("\n2️⃣ Deploying TSWP Token...");
  await deploy("TSWPToken", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  const tswpToken = await hre.ethers.getContract("TSWPToken", deployer);
  console.log("✅ TSWP Token deployed at:", await tswpToken.getAddress());

  const tswpInfo = await tswpToken.getTokenInfo();
  console.log("📊 TSWP Token Info:");
  console.log(`   Name: ${tswpInfo[0]}`);
  console.log(`   Symbol: ${tswpInfo[1]}`);
  console.log(`   Total Supply: ${hre.ethers.formatEther(tswpInfo[3])} TSWP`);
  console.log(`   Max Supply: ${hre.ethers.formatEther(tswpInfo[4])} TSWP`);
  console.log(`   Features: Governance voting capabilities`);

  // Deploy PINTU Token
  console.log("\n3️⃣ Deploying PINTU Token...");
  await deploy("PINTUToken", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  const pintuToken = await hre.ethers.getContract("PINTUToken", deployer);
  console.log("✅ PINTU Token deployed at:", await pintuToken.getAddress());

  const pintuInfo = await pintuToken.getTokenInfo();
  console.log("📊 PINTU Token Info:");
  console.log(`   Name: ${pintuInfo[0]}`);
  console.log(`   Symbol: ${pintuInfo[1]}`);
  console.log(`   Total Supply: ${hre.ethers.formatEther(pintuInfo[3])} PINTU`);
  console.log(`   Max Supply: ${hre.ethers.formatEther(pintuInfo[4])} PINTU`);
  console.log(`   Staking APR: ${pintuInfo[5].toString() / 100}%`);
  console.log(`   Features: 12% APR staking rewards`);

  console.log("\n✨ All new tokens deployed successfully!");
  console.log("\n📋 Token Summary:");
  console.log("• INTUIT: 100M supply - Utility token for intuition-based predictions");
  console.log("• TSWP: 50M supply - Governance token with voting rights");
  console.log("• PINTU: 10M supply - Staking token with 12% APR rewards");
};

export default deployNewTokens;

// This deployment can run independently
deployNewTokens.tags = ["NewTokens"];