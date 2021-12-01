
import { config, ethers } from "hardhat";
import { utils } from "ethers";
import * as R from "ramda";
import * as fs from "fs";

async function main() {

  console.log("\n\n 📡 Deploying...\n");
  // const lendingPoolAddressProviderContract = "0x88757f2f99175387aB4C6a4b3067c77A695b0349";
  // const UniswapRouterContract = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  // const wethAddressContract = "0xd0A1E359811322d97991E03f863a0C30C2cF029C";

  const liquidator = await deploy("Liquidator", [process.env.MAINNET_AAVE_ADDRESS_PROVIDER!, process.env.MAINNET_UNISWAP_ROUTER!, process.env.MAINNET_WETH!]);

}

async function deploy(contractName: string, _args: [string, string, string], overrides = {}, libraries = {}) {
  console.log(` 🛰  Deploying: ${contractName}`);

  const contractArgs = _args || [];
  const contractArtifacts = await ethers.getContractFactory(contractName, { libraries: libraries });
  console.log("factory");
  const deployed = await contractArtifacts.deploy(...contractArgs, overrides);
  await deployed.deployed();
  console.log("contract deployed at:" + deployed.address);
  const encoded = abiEncodeArgs(deployed, contractArgs);
  fs.writeFileSync(`artifacts/${contractName}.address`, deployed.address);

  let extraGasInfo = ""
  if (deployed && deployed.deployTransaction) {
    const gasUsed = deployed.deployTransaction.gasLimit.mul(deployed.deployTransaction.gasPrice!)
    extraGasInfo = "(" + utils.formatEther(gasUsed) + " ETH)"
  }

  console.log(
    " 📄",
    contractName,
    "deployed to:",
    deployed.address,
    extraGasInfo
  );

  if (!encoded || encoded.length <= 2) return deployed;
  fs.writeFileSync(`artifacts/${contractName}.args`, encoded.slice(2));

  return deployed;

}


// ------ utils -------

// abi encodes contract arguments
// useful when you want to manually verify the contracts
// for example, on Etherscan
const abiEncodeArgs = (deployed: any, contractArgs: [string, string, string]) => {
  // not writing abi encoded args if this does not pass
  if (
    !contractArgs ||
    !deployed ||
    !R.hasPath(["interface", "deploy"], deployed)
  ) {
    return "";
  }
  const encoded = utils.defaultAbiCoder.encode(
    deployed.interface.deploy.inputs,
    contractArgs
  );
  return encoded;
};

// checks if it is a Solidity file
const isSolidity = (fileName: string) =>
  fileName.indexOf(".sol") >= 0 && fileName.indexOf(".swp") < 0 && fileName.indexOf(".swap") < 0;

const readArgsFile = (contractName: any) => {
  let args: any[] = [];
  try {
    const argsFile = `./contracts/${contractName}.args`;
    if (!fs.existsSync(argsFile)) return args;
    args = JSON.parse(fs.readFileSync(argsFile).toString());
  } catch (e) {
    console.log(e);
  }
  return args;
};

function sleep(ms: any) {
  return new Promise(resolve => setTimeout(resolve, ms));
}



// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
