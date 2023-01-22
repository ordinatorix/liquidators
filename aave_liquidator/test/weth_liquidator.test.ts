import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Liquidator__factory, Liquidator, IERC20__factory, IERC20, ILendingPoolAddressesProvider__factory, ILendingPoolAddressesProvider, ILendingPool__factory, ILendingPool, IUniswapV2Router02, IUniswapV2Router02__factory } from "../typechain";
import { ContractReceipt } from "@ethersproject/contracts";

import { IERC20Interface } from "../typechain/IERC20";
import { LogDescription, Result } from "@ethersproject/abi";

//TODO: check transaction logs and test against that to make sure every step was sucessfull.


describe("Liquidator", async function () {
    let liquidatorContract: Liquidator;
    // let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    // let bob: SignerWithAddress;


    const daiWethLpAddress: string = '0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11';
    // const wbtcWethLpAddress: string = '0x0000000000000000000000000000000000000000';
    const aDAITokenV2: string = '0x028171bca77440897b824ca71d1c56cac55b68a3';
    const liquidatedWeth: string = '19547068301473';
    const swappedWeth: string = '18698584728455';
    const wethSwapDai: string = '45763361222088819';

    let daiToken: IERC20;
    let daiTokenInterface: IERC20Interface;

    let wethToken: IERC20;
    let wethTokenInterface: IERC20Interface;

    let aaveLendingPool: ILendingPool;
    let aaveAddressProvider: ILendingPoolAddressesProvider;

    let uniswapRouterV2: IUniswapV2Router02;


    let initBlock: number;

    let txHash: ContractReceipt;



    before("Deploy contract using alice", async function () {
        initBlock = await ethers.provider.getBlockNumber();
        [alice] = await ethers.getSigners();
        const LiquidatorFactory = (await ethers.getContractFactory("Liquidator", alice)) as Liquidator__factory;
        liquidatorContract = await LiquidatorFactory.deploy(process.env.MAINNET_AAVE_ADDRESS_PROVIDER!, process.env.MAINNET_UNISWAP_ROUTER!, process.env.MAINNET_WETH!);
        await liquidatorContract.deployed();

        // setup USDC IERC20 interface
        daiToken = IERC20__factory.connect(process.env.MAINNET_DAI!, alice);
        daiTokenInterface = daiToken.interface;

        // setup WETH IERC20 interface
        wethToken = IERC20__factory.connect(process.env.MAINNET_WETH!, alice);
        wethTokenInterface = wethToken.interface;

        // setup aaave interfaces
        aaveAddressProvider = ILendingPoolAddressesProvider__factory.connect(process.env.MAINNET_AAVE_ADDRESS_PROVIDER!, alice);
        const lendingPoolAddress = await aaveAddressProvider.getLendingPool();
        aaveLendingPool = ILendingPool__factory.connect(lendingPoolAddress, alice);

        // setup uniswap interface
        uniswapRouterV2 = IUniswapV2Router02__factory.connect(process.env.MAINNET_UNISWAP_ROUTER!, alice);


        await wethToken.deployed();
        await daiToken.deployed();
        await aaveAddressProvider.deployed();
        await aaveLendingPool.deployed();


        console.log("blocknumber is: ", initBlock);

    });

    describe("check initial state", () => {
        it("should expect block number to be correct", async () => {
            expect(initBlock).to.be.equal(Number(process.env.TARGET_BLOCK_3));
        });
    });

    describe("Liquidator Contract Deployement", async () => {
        it("Should have a proper address for liquidator contract.", async () => {
            expect(liquidatorContract.address).to.be.properAddress;
        });

        it("Should have a proper address for WETH token contract.", async () => {
            expect(wethToken.address).to.be.properAddress;
        });

        it("Should have the correct address for WETH token contract.", async () => {
            expect(wethToken.address.toLowerCase()).to.be.equal(process.env.MAINNET_WETH);
        });
        it("Should have a proper address for DAI token contract.", async () => {
            expect(daiToken.address).to.be.properAddress;
        });

        it("Should have the correct address for DAI token contract.", async () => {
            expect(daiToken.address.toLowerCase()).to.be.equal(process.env.MAINNET_DAI);
        });

        it("All WETH Token balance should be empty for liquidator contract.", async () => {
            expect(await wethToken.balanceOf(liquidatorContract.address)).to.be.equal(BigInt(0));
        });
        it("All WETH Token balance should be empty for alice.", async () => {
            expect(await wethToken.balanceOf(alice.address)).to.be.equal(BigInt(0));
            //TODO: should contract hold ETH for gas or should msg.sender?
        });
        it("All DAI Token balance should be empty for liquidator contract.", async () => {
            expect(await daiToken.balanceOf(liquidatorContract.address)).to.be.equal(BigInt(0));
        });
        it("All DAI Token balance should be empty for alice.", async () => {
            expect(await daiToken.balanceOf(alice.address)).to.be.equal(BigInt(0));
            //TODO: should contract hold ETH for gas or should msg.sender?
        });
    });

    describe("Liquidation Execution", async () => {
        before("call FlashLoan", async () => {
            console.log("WETH:DAI liquidation @block:", initBlock);
            const newParams = ethers.utils.defaultAbiCoder.encode(
                ["address", "address", "address", "uint256", "bool"],
                [process.env.MAINNET_WETH, process.env.MAINNET_DAI, process.env.TEST_TARGET_USER_ADDRESS_3, process.env.TEST_LOAN_AMOUNT_DAI, false]
            );


            const flashLoan = await liquidatorContract.requestFlashLoan([process.env.MAINNET_DAI!], [process.env.TEST_LOAN_AMOUNT_DAI!], [0], newParams);
            txHash = await flashLoan.wait();

            // console.log("logs:", txHash.logs);
        });
        describe("RequestFlashLoan", () => {
            let loanedTransferTx: any;
            let parsedLogs: LogDescription;
            before("Filter and decode logs", () => {
                loanedTransferTx = txHash.logs.find((transaction) => { return transaction.logIndex == 0 });

                const data: string = loanedTransferTx?.data!;
                const topics: string[] = loanedTransferTx?.topics!;
                parsedLogs = wethTokenInterface.parseLog({ data, topics });
            });

            it("Should be a transfer log.", () => {
                expect(parsedLogs.name).to.be.equal("Transfer");
            });
            it("Should be a transfer of DAI.", () => {
                expect(loanedTransferTx?.address.toLowerCase()).to.be.equal(process.env.MAINNET_DAI?.toLowerCase());
            });
            it("Should have the liquidator contract as the loan receiver.", () => {
                expect(parsedLogs.args["to"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });

            it("Should have received the requested loan amount.", () => {
                expect(parsedLogs.args["value"]).to.be.equal(BigInt(process.env.TEST_LOAN_AMOUNT_DAI!));
            });
        });
        describe("Approve DAI Spending by Lending pool contract", () => {
            let txLogs: any;
            let parsedLogs: LogDescription;
            before("Find relevant log.", () => {
                //find all logs of token transfer  of token in [debtToCover] amount to [lending pool]
                // check to see if transaction at log index 1
                txLogs = txHash.logs.find((transaction) => { return transaction.logIndex == 1 });
                const data: string = txLogs?.data;
                const topics: string[] = txLogs?.topics;
                parsedLogs = daiTokenInterface.parseLog({ data, topics });

            });
            it("Should approve spending of DAI.", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(daiToken.address.toLowerCase());
            });
            it("Should approve spending of DAI by Lending pool.", () => {
                expect(parsedLogs.args["spender"].toLowerCase()).to.be.equal(aaveLendingPool.address.toLowerCase());
            });
            it("liquidator contract Should approve spending of its DAI.", () => {
                expect(parsedLogs.args["owner"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should approve spending in amount of [loanAmount].", () => {
                expect(parsedLogs.args["value"]).to.be.equal(process.env.TEST_LOAN_AMOUNT_DAI!);
            });
        });
        describe("Transfer DAI to Aave DAI Reserve", () => {
            let txLogs: any;
            let parsedLogs: LogDescription;
            before("Find relevant log.", () => {
                //find all logs of token transfer  of token in [debtToCover] amount to [lending pool]
                // check to see if transaction at log index 24
                txLogs = txHash.logs.find((transaction) => { return transaction.logIndex == 24 });
                const data: string = txLogs?.data;
                const topics: string[] = txLogs?.topics;
                parsedLogs = daiTokenInterface.parseLog({ data, topics });

            });
            it("Should be a 'Transfer' event log.", () => {
                expect(parsedLogs.name).to.be.equal("Transfer");
            });
            it("Should be transfering DAI Token.", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(daiToken.address.toLowerCase());
            });
            it("Should transfer DAI from liquidation contract.", () => {
                expect(parsedLogs.args["from"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should transfer DAI to aave DAI reserve.", () => {
                expect(parsedLogs.args["to"].toLowerCase()).to.be.equal(aDAITokenV2.toLowerCase());
            });
            it("Should transfer DAI in amount of [debtToCover].", () => {
                expect(parsedLogs.args["value"]).to.be.equal(process.env.TEST_TARGET_DEBT_TO_COVER_DAI!);
            });
        });
        describe("executeOperation", () => {

            let parsedLogs: LogDescription;
            let txLogs: any;
            const collateralAsset = process.env.MAINNET_WETH!;
            const debtAsset = process.env.MAINNET_DAI!;
            const debtToCover = process.env.TEST_TARGET_DEBT_TO_COVER_DAI!;

            const receiveAToken = false;
            before("Find liquidation call log.", () => {

                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 25;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = aaveLendingPool.interface.parseLog({ data, topics });
                console.log(parsedLogs);
                // console.log(BigInt(parsedLogs.args["debtToCover"]));
                console.log(ethers.utils.formatEther(parsedLogs.args["liquidatedCollateralAmount"]));
                console.log(BigInt(parsedLogs.args["liquidatedCollateralAmount"]));
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
            it("Should have received WETH token in return.", () => {
                expect(parsedLogs.args["collateralAsset"].toLowerCase()).to.be.equal(collateralAsset.toLowerCase());
            });
            // it("Should have received the correct amount of WETH", () => { expect(parsedLogs.args["liquidatedCollateralAmount"]) });

            it("Should have been liquidated by liquidator contract.", () => {
                expect(parsedLogs.args["liquidator"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should have not received AToken.", () => {
                expect(parsedLogs.args["receiveAToken"]).to.be.equal(receiveAToken);
            });
        });
        describe("Approve spending of WETH by uniswap Router.", () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("get approval log for swap.", () => {
                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 27;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = wethTokenInterface.parseLog({ data, topics });
            });
            it("Should be an approval event", () => {
                expect(parsedLogs.name).to.be.equal("Approval");
            });
            it("Should have approved USDC", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(wethToken.address.toLowerCase());
            });
            it("Should have been approved for uniswap router", () => {
                expect(parsedLogs.args["spender"].toLowerCase()).to.be.equal(uniswapRouterV2.address.toLowerCase());
            });
            it("Should have been approved by liquidator contract", () => {
                expect(parsedLogs.args["owner"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should have approved the correct amount.", () => {
                expect(parsedLogs.args["value"]).to.be.equal(BigInt(liquidatedWeth));
            });
        });
        describe("Transfer WETH from liquidator contract to DAI/WETC LP reserve.", () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("get transfer log.", () => {
                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 28;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = wethTokenInterface.parseLog({ data, topics });
                // console.log(parsedLogs);
                // console.log(BigInt(parsedLogs.args["value"]));
            });
            it("Should be a transfer event log.", () => {
                expect(parsedLogs.name).to.be.equal("Transfer");
            });
            it("Should have transfered WETH.", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(wethToken.address.toLowerCase());
            });
            it("Should have transfered to uniswap reserve.", () => {
                expect(parsedLogs.args["to"].toLowerCase()).to.be.equal(daiWethLpAddress.toLowerCase());
            });
            it("Should have transfered from liquidator contract", () => {
                expect(parsedLogs.args["from"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should have transfered correct amount.", () => {
                expect(parsedLogs.args["value"]).to.be.equal(BigInt(swappedWeth));
            });

        });

        describe("Transfer DAI from DAI/WETH LP reserve to liquidator contract.", () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("get transfer log.", () => {
                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 29;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = daiTokenInterface.parseLog({ data, topics });

            });
            it("Should be an transfer event", () => {
                expect(parsedLogs.name).to.be.equal("Transfer");
            });
            it("Should have transfered WETH", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(daiToken.address.toLowerCase());
            });
            it("Should have been transfered from uniswap router", () => {
                expect(parsedLogs.args["from"].toLowerCase()).to.be.equal(daiWethLpAddress.toLowerCase());
            });
            it("Should have been transfered to liquidator contract", () => {
                expect(parsedLogs.args["to"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should have transfered the correct amount.", () => {
                expect(parsedLogs.args["value"]).to.be.equal(BigInt(wethSwapDai));
            });
        });
        describe("Completed swap from WETH to DAI.", () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("Find log where swap should have happened.", () => {

                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 32;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = liquidatorContract.interface.parseLog({ data, topics });
                // console.log(parsedLogs);
                // console.log(BigInt(parsedLogs.args["receivedAmount"]));
                // console.log(BigInt(parsedLogs.args["fromAmount"]));

            });
            it("Should be a [Swapped] event log.", () => {
                expect(parsedLogs.name).to.be.equal("Swapped")
            });
            it("Should have swapped from WETH.", () => {
                expect(parsedLogs.args["fromAsset"].toLowerCase()).to.be.equal(wethToken.address.toLowerCase())
            });
            it("Should have swapped to DAI.", () => {
                expect(parsedLogs.args["toAsset"].toLowerCase()).to.be.equal(daiToken.address.toLowerCase());
            });

            it("Should have swapped WETH correct amount.", () => {
                expect(parsedLogs.args["fromAmount"]).to.be.equal(BigInt(swappedWeth));
            });
            it("Should have swapped for exact DAI.", () => {
                expect(parsedLogs.args["receivedAmount"]).to.be.equal(BigInt(wethSwapDai));
            });

        });
        describe("Approve DAI transfer for paying back loan.", () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("Find log where approval should have happened.", () => {

                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 33;
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
            before("Find log where transfer should have happened.", () => {

                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 36;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = daiTokenInterface.parseLog({ data, topics });
                // console.log(parsedLogs);
                // console.log(BigInt(parsedLogs.args["value"]));
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
            it("Should transfer flashLoan debt to aave DAI token reserve", () => {
                expect(parsedLogs.args["to"].toLowerCase()).to.be.equal(aDAITokenV2.toLowerCase());
            });
        });
        describe("Conclude FlashLoan.", () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("Find log where approval should have happened.", () => {

                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 37;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = aaveLendingPool.interface.parseLog({ data, topics });
                // console.log("parsed logs", parsedLogs);
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
        describe("Transfer remaining collateral asset to msg.sender", async () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("Find log where transfer should have happened.", () => {

                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 38;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = wethTokenInterface.parseLog({ data, topics });
                // console.log("parsed logs", parsedLogs);
                // console.log("parsed logs", BigInt(parsedLogs.args["value"]));
            });
            it("Should be a transfer log", () => {
                expect(parsedLogs.name).to.be.equal("Transfer");
            });
            it("Should have transfered collateral asset", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(wethToken.address.toLowerCase());
            });
            it("Should have transfered to msg.sender", () => {
                expect(parsedLogs.args["to"].toLowerCase()).to.equal(alice.address.toLowerCase());
            });
            it("Should have transfered from liquidator contract", () => {
                expect(parsedLogs.args["from"].toLowerCase()).to.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should have transfered all collateral assets owned by contract", async () => {
                expect(parsedLogs.args["value"]).to.equal(await wethToken.balanceOf(alice.address));
            });
            it("Should have zero debt assets left in msg.sender", async () => {
                expect(await daiToken.balanceOf(alice.address)).to.equal(BigInt(0))
            });
            it("Should have zero collateral assets left in the contract", async () => {
                expect(await wethToken.balanceOf(liquidatorContract.address)).to.equal(BigInt(0))
            });
            it("Should have zero debt assets left in the contract", async () => {
                expect(await daiToken.balanceOf(liquidatorContract.address)).to.equal(BigInt(0))
            });


        });

    });

});