import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys the new DEX contracts for each token pair
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployNewDEXs: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("🚀 Deploying new DEX contracts for token pairs...");

  // Get deployed token addresses
  const intuitToken = await hre.ethers.getContract<Contract>("INTUITToken", deployer);
  const tswpToken = await hre.ethers.getContract<Contract>("TSWPToken", deployer);
  const pintuToken = await hre.ethers.getContract<Contract>("PINTUToken", deployer);

  const intuitAddress = await intuitToken.getAddress();
  const tswpAddress = await tswpToken.getAddress();
  const pintuAddress = await pintuToken.getAddress();

  // tTRUST is native token (using zero address)
  const tTrustAddress = "0x0000000000000000000000000000000000000000";

  console.log("\n📋 Token Addresses:");
  console.log(`   tTRUST (native): ${tTrustAddress}`);
  console.log(`   INTUIT: ${intuitAddress}`);
  console.log(`   TSWP: ${tswpAddress}`);
  console.log(`   PINTU: ${pintuAddress}`);

  // Deploy DEX_INTUIT
  console.log("\n1️⃣ Deploying DEX_INTUIT (tTRUST/INTUIT pair)...");
  await deploy("DEX_INTUIT", {
    from: deployer,
    args: [tTrustAddress, intuitAddress],
    log: true,
    autoMine: true,
  });

  const dexIntuit = await hre.ethers.getContract<Contract>("DEX_INTUIT", deployer);
  console.log("✅ DEX_INTUIT deployed at:", await dexIntuit.getAddress());

  // Deploy DEX_TSWP
  console.log("\n2️⃣ Deploying DEX_TSWP (tTRUST/TSWP pair)...");
  await deploy("DEX_TSWP", {
    from: deployer,
    args: [tTrustAddress, tswpAddress],
    log: true,
    autoMine: true,
  });

  const dexTswp = await hre.ethers.getContract<Contract>("DEX_TSWP", deployer);
  console.log("✅ DEX_TSWP deployed at:", await dexTswp.getAddress());

  // Deploy DEX_PINTU
  console.log("\n3️⃣ Deploying DEX_PINTU (tTRUST/PINTU pair)...");
  await deploy("DEX_PINTU", {
    from: deployer,
    args: [tTrustAddress, pintuAddress],
    log: true,
    autoMine: true,
  });

  const dexPintu = await hre.ethers.getContract<Contract>("DEX_PINTU", deployer);
  console.log("✅ DEX_PINTU deployed at:", await dexPintu.getAddress());

  console.log("\n✨ All new DEX contracts deployed successfully!");
  console.log("\n📋 DEX Summary:");
  console.log("• DEX_INTUIT: AMM for tTRUST/INTUIT trading pair");
  console.log("• DEX_TSWP: AMM for tTRUST/TSWP trading pair");
  console.log("• DEX_PINTU: AMM for tTRUST/PINTU trading pair");
  console.log("\n⚠️ Note: Liquidity needs to be added to these DEXs before trading can begin");
};

export default deployNewDEXs;

// This deployment depends on the new tokens being deployed first
deployNewDEXs.dependencies = ["NewTokens"];
deployNewDEXs.tags = ["NewDEXs"];