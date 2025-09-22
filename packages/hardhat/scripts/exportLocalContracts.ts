import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

async function main() {
  const contracts = {
    31337: {
      OracleToken: {
        address: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      },
      DEX: {
        address: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
      },
      OracleLend: {
        address: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
      },
      INTUITToken: {
        address: "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6",
      },
      TSWPToken: {
        address: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318",
      },
      PINTUToken: {
        address: "0x610178dA211FEF7D417bC0e6FeD39F05609AD788",
      },
      DEX_INTUIT: {
        address: "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
      },
      DEX_TSWP: {
        address: "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0",
      },
      DEX_PINTU: {
        address: "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82",
      },
      DEXRouter: {
        address: "0x9A676e781A523b5d0C0e43731313A708CB607508",
      },
    },
  };

  const outputPath = path.join(__dirname, "../../nextjs/contracts/localContracts.ts");

  const content = `/**
 * Local Hardhat Network Contracts
 * Chain ID: 31337
 */
export const localContracts = ${JSON.stringify(contracts, null, 2)};
`;

  fs.writeFileSync(outputPath, content);
  console.log("✅ Local contracts exported to:", outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});