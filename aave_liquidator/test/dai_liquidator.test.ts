
import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Liquidator__factory, Liquidator, IERC20__factory, IERC20, ILendingPoolAddressesProvider__factory, ILendingPoolAddressesProvider, ILendingPool__factory, ILendingPool } from "../typechain";
import { ContractReceipt } from "@ethersproject/contracts";

import { IERC20Interface } from "../typechain/IERC20";
import { LogDescription, Result } from "@ethersproject/abi";

//TODO: check transaction logs and test against that to make sure every step was sucessfull.


describe("Liquidator", async function () {
    let liquidatorContract: Liquidator;
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;

    let daiToken: IERC20;
    let daiTokenInterface: IERC20Interface;
    let aaveLendingPool: ILendingPool;
    let aaveAddressProvider: ILendingPoolAddressesProvider;

    let initBlock: number;

    let txHash: ContractReceipt;
   


    before("Deploy contract using alice", async function () {

        [owner, alice, bob] = await ethers.getSigners();
        const LiquidatorFactory = (await ethers.getContractFactory("Liquidator", alice)) as Liquidator__factory;
        liquidatorContract = await LiquidatorFactory.deploy(process.env.MAINNET_AAVE_ADDRESS_PROVIDER!, process.env.MAINNET_UNISWAP_ROUTER!, process.env.MAINNET_WETH!);
        await liquidatorContract.deployed();

        // setupd dai IERC20 interface
        daiToken = IERC20__factory.connect(process.env.MAINNET_DAI!, alice);
        daiTokenInterface = daiToken.interface;
        // setup aaave interfaces
        aaveAddressProvider = ILendingPoolAddressesProvider__factory.connect(process.env.MAINNET_AAVE_ADDRESS_PROVIDER!, alice);
        const lendingPoolAddress = await aaveAddressProvider.getLendingPool();
        aaveLendingPool = ILendingPool__factory.connect(lendingPoolAddress, alice);

        await daiToken.deployed();
        await aaveAddressProvider.deployed();
        await aaveLendingPool.deployed();

        initBlock = await ethers.provider.getBlockNumber();
        console.log("blocknumber is: ", initBlock);

    });

    describe("Liquidator Contract Deployement", async () => {
        it("Should have a proper address for liquidator contract.", async () => {
            expect(liquidatorContract.address).to.be.properAddress;
        });

        it("Should have a proper address for DAI token contract.", async () => {
            expect(daiToken.address).to.be.properAddress;
        });

        it("Should have the correct address for DAI token contract.", async () => {
            expect(daiToken.address).to.be.equal(process.env.MAINNET_DAI);
        });

        it("All Token balance should be empty for liquidator contract.", async () => {
            expect(await daiToken.balanceOf(liquidatorContract.address)).to.be.equal(BigInt(0));
        });
        it("All Token balance should be empty for alice.", async () => {
            expect(await daiToken.balanceOf(alice.address)).to.be.equal(BigInt(0));
            //TODO: should contract hold ETH for gas or should msg.sender?
        });
    });


    describe("Liquidation Execution", async () => {

        before("call FlashLoan", async () => {
            console.log("DAI:DAI liquidation @block:", initBlock);
            const newParams = ethers.utils.defaultAbiCoder.encode(
                ["address", "address", "address", "uint256", "bool"],
                [process.env.MAINNET_DAI, process.env.MAINNET_DAI, process.env.TEST_TARGET_USER_ADDRESS_0, process.env.TEST_TARGET_DEBT_TO_COVER_DAI, false]
            );


            const flashLoan = await liquidatorContract.requestFlashLoan([process.env.MAINNET_DAI!], [process.env.TEST_LOAN_AMOUNT_DAI!], [0], newParams);
            txHash = await flashLoan.wait();

            console.log("logs:", txHash.logs);
        });

        describe("RequestFlashLoan", () => {

            let parsedLogs: LogDescription;
            before("Filter and decode logs", () => {
                const loanedTransferTx = txHash.logs.find((transaction) => { return transaction.logIndex == 0 });

                const data: string = loanedTransferTx?.data!;
                const topics: string[] = loanedTransferTx?.topics!;
                parsedLogs = daiTokenInterface.parseLog({ data, topics });
            });

            it("Should have the liquidator contract as the loan receiver.", () => {
                expect(parsedLogs.args["to"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });

            it("Should have received the requested loan amount.", () => {
                expect(parsedLogs.args["value"]).to.be.equal(BigInt(process.env.TEST_LOAN_AMOUNT_DAI!));
            });
        });

        describe("Approve Dai Spending by Lending pool contract", () => {

            it("Should approve spending of borrowed asset by Lending pool in the amount of debt to cover.", () => {
                // find first approval where owner is liquidator and spender is lending pool.
                const approvalFragment = daiTokenInterface.getEvent("Approval");
                const encodedData = daiTokenInterface.encodeEventLog(
                    approvalFragment,
                    [liquidatorContract.address, aaveLendingPool.address, BigInt(process.env.TEST_TARGET_DEBT_TO_COVER_DAI!)]
                );
                const daiSpendingApprovalTx = txHash.logs.find((transaction) => {
                    return (transaction.topics[0] == encodedData.topics[0]) && (transaction.topics[1] == encodedData.topics[1]) && (transaction.data == encodedData.data)
                });

                expect(daiSpendingApprovalTx?.data).to.be.equal(encodedData.data);
            });
        });

        describe("Transfer DAI to Aave DAI Reserve", () => {
            let txLogs: any;
            let parsedLogs: LogDescription;
            before("Find relevant log.", () => {
                //find all logs of token transfer  of token in [debtToCover] amount to [lending pool]
                // check to see if transaction at log index 19
                txLogs = txHash.logs.find((transaction) => { return transaction.logIndex == 19 });
                const data: string = txLogs?.data;
                const topics: string[] = txLogs?.topics;
                parsedLogs = daiTokenInterface.parseLog({ data, topics });

            });
            it("Should be transfering DAI Token.", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(daiToken.address.toLowerCase());
            });
            it("Should be a 'Transfer' event log.", () => {
                expect(parsedLogs.name).to.be.equal("Transfer");
            });
            it("Should transfer DAI from liquidation contract.", () => {
                expect(parsedLogs.args["from"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should transfer DAI to aave DAI reserve.", () => {
                expect(parsedLogs.args["to"].toLowerCase()).to.be.equal('0x028171bca77440897b824ca71d1c56cac55b68a3');
            });
            it("Should transfer DAI in amount of [debtToCover].", () => {
                expect(parsedLogs.args["value"]).to.be.equal(process.env.TEST_TARGET_DEBT_TO_COVER_DAI!);
            });
        });

        describe("executeOperation", () => {

            let parsedLogs: LogDescription;
            let txLogs: any;
            const collateralAsset = process.env.MAINNET_DAI!;
            const debtAsset = process.env.MAINNET_DAI!;
            const debtToCover = process.env.TEST_TARGET_DEBT_TO_COVER_DAI!;
            const liquidatedCollateral = process.env.TEST_TARGET_LIQUIDATED_DAI!;
            const receiveAToken = false;
            before("Find liquidation call log.", () => {

                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 20;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = aaveLendingPool.interface.parseLog({ data, topics });
            });

            it("Should be a liquidation call event log.", () => {
                expect(parsedLogs.name).to.be.equal("LiquidationCall");
            });
            it("Should be emmited by aave Lending pool.", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(aaveLendingPool.address.toLowerCase());
            });
            it("Should have liquidated DAI debt.", () => {
                expect(parsedLogs.args["debtAsset"].toLowerCase()).to.be.equal(debtAsset.toLowerCase());
            });
            it("Should have liquidated the correct amount of DAI token.", () => {
                expect(parsedLogs.args["debtToCover"]).to.be.equal(debtToCover);
            });
            it("Should have received DAI token in return.", () => {
                expect(parsedLogs.args["collateralAsset"].toLowerCase()).to.be.equal(collateralAsset.toLowerCase());
            });
            it("Should have received correct amount of DAI token.", () => {
                expect(parsedLogs.args["liquidatedCollateralAmount"]).to.be.equal(liquidatedCollateral);

            });
            it("Should have been liquidated by liquidator contract.", () => {
                expect(parsedLogs.args["liquidator"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());

            });
            it("Should have not received AToken.", () => {
                expect(parsedLogs.args["receiveAToken"]).to.be.equal(receiveAToken);
            });


        });


        // describe("Swap between collateral and debt asset", () => {
        //     //TODO: swap can happen etween multiple assets before completing
        //     it("Should Approve spending of collateral asset by exchange in value of amount to swap", () => { });
        //     it("Should transfer collateral asset to exchange", () => { });
        //     it("Should execute a swap for an exact token amount", () => { });
        // });

        describe("Approve Dai transfer for paying back loan.", () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("Find log where approval should have happened.", () => {

                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 21;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = daiTokenInterface.parseLog({ data, topics });

            });
            it("Should be a [Approval] event log.", () => {
                expect(parsedLogs.name).to.be.equal("Approval")
            });
            it("Should approve spending of DAI.", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(daiToken.address.toLowerCase())
            });
            it("Should approve spending of [FlashLoanDebt] amount.", () => {
                expect(Number(parsedLogs.args["value"])).to.be.greaterThan(Number(process.env.TEST_LOAN_AMOUNT_DAI!));
            });

            it("Should be approved by liquidator contract.", () => {
                expect(parsedLogs.args["owner"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should approve aave lending pool contract to spend token.", () => {
                expect(parsedLogs.args["spender"].toLowerCase()).to.be.equal(aaveLendingPool.address.toLowerCase());
            });

        });

        describe("Transfer DAI to Aave DAI reserve.", () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("Find log where approval should have happened.", () => {

                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 24;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = daiTokenInterface.parseLog({ data, topics });

            });
            it("Should be a [Transfer] event log.", () => {
                expect(parsedLogs.name).to.be.equal("Transfer");
            });
            it("Should have sent DAI token.", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(daiToken.address.toLowerCase());
            });

            it("Should have been in amount of flashLoan debt.", () => {
                expect(Number(parsedLogs.args["value"])).to.be.greaterThan(Number(process.env.TEST_LOAN_AMOUNT_DAI!));
            });

            it("Should be transfered by liquidator contract", () => {
                expect(parsedLogs.args["from"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should transfer flashLoan debt to aave dai token reserve", () => {
                expect(parsedLogs.args["to"].toLowerCase()).to.be.equal('0x028171bca77440897b824ca71d1c56cac55b68a3');
            });
        });
        describe("Conclude FlashLoan.", () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("Find log where approval should have happened.", () => {

                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 25;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = aaveLendingPool.interface.parseLog({ data, topics });

            });
            it("Should be a [FlashLoan] event log.", () => {
                expect(parsedLogs.name).to.be.equal("FlashLoan");
            });
            it("Should have been initiated by the liquidator contract.", () => {
                expect(parsedLogs.args['initiator'].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should have sent DAI.", () => {
                expect(parsedLogs.args["asset"].toLowerCase()).to.equal(daiToken.address.toLowerCase());
            });
            it("Should have sent amount to the liquidator contract.", () => {
                expect(parsedLogs.args["amount"]).to.be.equal(process.env.TEST_LOAN_AMOUNT_DAI);
            });

        });


        describe("Transfer remaining DAI to msg.sender", async () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("Find log where transfer should have happened.", () => {

                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 26;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = daiTokenInterface.parseLog({ data, topics });

            });
            it("Should be a transfer log DAI", () => {
                expect(parsedLogs.name).to.be.equal("Transfer");
            });
            it("Should have transfered DAI", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(daiToken.address.toLowerCase());
            });
            it("Should have transfered to msg.sender", () => {
                expect(parsedLogs.args["to"].toLowerCase()).to.equal(alice.address.toLowerCase());
            });
            it("Should have transfered from liquidator contract", () => {
                expect(parsedLogs.args["from"].toLowerCase()).to.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should have transfered all Dai owned by contract", async () => {
                expect(parsedLogs.args["value"]).to.equal(await daiToken.balanceOf(alice.address));
            });
            it("Should have zero DAI left in the contract", async () => {
                expect(await daiToken.balanceOf(liquidatorContract.address)).to.equal(BigInt(0))
            });

        });

    });

});