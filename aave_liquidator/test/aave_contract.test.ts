import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ILendingPoolAddressesProvider__factory, ILendingPoolAddressesProvider, ILendingPool__factory, ILendingPool } from "../typechain"

describe("aave Lending Pool", function () {
    let aaveLendingPool: ILendingPool;
    let aaveAddressProvider: ILendingPoolAddressesProvider;
    let aave: SignerWithAddress;
    let initBlock: number;

    before("connect to contracts", async () => {
        [aave] = await ethers.getSigners();
        aaveAddressProvider = ILendingPoolAddressesProvider__factory.connect(process.env.MAINNET_AAVE_ADDRESS_PROVIDER!, aave);
        const lendingPoolAddress = await aaveAddressProvider.getLendingPool();
        aaveLendingPool = ILendingPool__factory.connect(lendingPoolAddress, aave);
        initBlock = await ethers.provider.getBlockNumber();

    });
    describe("aave deployed", async () => {
        it("should provide user account data", async () => {
            if (initBlock == 12485341) {
                const userData = await aaveLendingPool.getUserAccountData(process.env.TEST_TARGET_USER_ADDRESS_0!);
                const hf_eth = ethers.utils.formatEther(userData.healthFactor);
                const totalCollateralInETH = ethers.utils.formatEther(userData.totalCollateralETH);
                const totaldebtInETH = ethers.utils.formatEther(userData.totalDebtETH);

                console.log("user total collateral:", totalCollateralInETH);
                console.log("user total det:", totaldebtInETH);
                console.log("user health factor:", hf_eth);
            } else if (initBlock == 12645947) {
                const userData = await aaveLendingPool.getUserAccountData(process.env.TEST_TARGET_USER_ADDRESS_1!);
                const hf_eth = ethers.utils.formatEther(userData.healthFactor);
                const totalCollateralInETH = ethers.utils.formatEther(userData.totalCollateralETH);
                const totaldebtInETH = ethers.utils.formatEther(userData.totalDebtETH);

                console.log("user total collateral:", totalCollateralInETH);
                console.log("user total det:", totaldebtInETH);
                console.log("user health factor:", hf_eth);
            } else if (initBlock == 12401787) {
                const userData = await aaveLendingPool.getUserAccountData(process.env.TEST_TARGET_USER_ADDRESS_2!);
                const hf_eth = ethers.utils.formatEther(userData.healthFactor);
                const totalCollateralInETH = ethers.utils.formatEther(userData.totalCollateralETH);
                const totaldebtInETH = ethers.utils.formatEther(userData.totalDebtETH);

                console.log("user total collateral:", totalCollateralInETH);
                console.log("user total det:", totaldebtInETH);
                console.log("user health factor:", hf_eth);
            } else { console.log("warning!") }
        });

    });
});