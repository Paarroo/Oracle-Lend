import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await deployer.provider.getBalance(deployer.address);

  console.log("Deployer address:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "tTRUST");
  console.log("Balance (wei):", balance.toString());

  // Check if we have enough for deployment
  const requiredGas = ethers.parseEther("0.1"); // Estimated requirement
  if (balance < requiredGas) {
    console.log("\n⚠️  Insufficient funds!");
    console.log("Required:", ethers.formatEther(requiredGas), "tTRUST");
    console.log("Need to add:", ethers.formatEther(requiredGas - balance), "tTRUST");
  } else {
    console.log("\n✅ Sufficient funds for deployment");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});