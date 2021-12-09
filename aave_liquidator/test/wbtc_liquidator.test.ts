
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

    let daiToken: IERC20;
    let daiTokenInterface: IERC20Interface;
    const daiWethLpAddress: string = '0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11';
    const wbtcWethLpAddress: string = '0xBb2b8038a1640196FbE3e38816F3e67Cba72D940';
    const awbtcTokenV2: string = '0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656';


    let wbtcToken: IERC20;
    let wbtcTokenInterface: IERC20Interface;

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

        // setup DAI IERC20 interface
        daiToken = IERC20__factory.connect(process.env.MAINNET_DAI!, alice);
        daiTokenInterface = daiToken.interface;

        // setup WETH IERC20 interface
        wethToken = IERC20__factory.connect(process.env.MAINNET_WETH!, alice);
        wethTokenInterface = wethToken.interface;

        // setup WBTC IERC20 interface
        wbtcToken = IERC20__factory.connect(process.env.MAINNET_WBTC!, alice);
        wbtcTokenInterface = wbtcToken.interface;

        // setup aaave interfaces
        aaveAddressProvider = ILendingPoolAddressesProvider__factory.connect(process.env.MAINNET_AAVE_ADDRESS_PROVIDER!, alice);
        const lendingPoolAddress = await aaveAddressProvider.getLendingPool();
        aaveLendingPool = ILendingPool__factory.connect(lendingPoolAddress, alice);

        // setup uniswap interface
        uniswapRouterV2 = IUniswapV2Router02__factory.connect(process.env.MAINNET_UNISWAP_ROUTER!, alice);


        await wbtcToken.deployed();
        await daiToken.deployed();
        await wethToken.deployed();
        await aaveAddressProvider.deployed();
        await aaveLendingPool.deployed();


        console.log("blocknumber is: ", initBlock);

    });

    describe("check initial state", () => {
        it("should expect block number to be correct", async () => {
            expect(initBlock).to.be.equal(Number(process.env.TARGET_BLOCK_1));
        });
    });

    describe("Liquidator Contract Deployement", async () => {
        it("Should have a proper address for liquidator contract.", async () => {
            expect(liquidatorContract.address).to.be.properAddress;
        });

        it("Should have a proper address for WBTC token contract.", async () => {
            expect(daiToken.address).to.be.properAddress;
        });

        it("Should have the correct address for WBTC token contract.", async () => {
            expect(daiToken.address.toLowerCase()).to.be.equal(process.env.MAINNET_DAI);
        });
        it("Should have a proper address for WBTC token contract.", async () => {
            expect(wbtcToken.address).to.be.properAddress;
        });

        it("Should have the correct address for WBTC token contract.", async () => {
            expect(wbtcToken.address.toLowerCase()).to.be.equal(process.env.MAINNET_WBTC);
        });

        it("All DAI Token balance should be empty for liquidator contract.", async () => {
            expect(await daiToken.balanceOf(liquidatorContract.address)).to.be.equal(BigInt(0));
        });
        it("All DAI Token balance should be empty for alice.", async () => {
            expect(await daiToken.balanceOf(alice.address)).to.be.equal(BigInt(0));
            //TODO: should contract hold ETH for gas or should msg.sender?
        });
        it("All WBTC Token balance should be empty for liquidator contract.", async () => {
            expect(await wbtcToken.balanceOf(liquidatorContract.address)).to.be.equal(BigInt(0));
        });
        it("All WBTC Token balance should be empty for alice.", async () => {
            expect(await wbtcToken.balanceOf(alice.address)).to.be.equal(BigInt(0));
            //TODO: should contract hold ETH for gas or should msg.sender?
        });
    });

    describe("Liquidation Execution", async () => {
        before("call FlashLoan", async () => {
            console.log("DAI:WBTC liquidation @block:", initBlock);
            const newParams = ethers.utils.defaultAbiCoder.encode(
                ["address", "address", "address", "uint256", "bool"],
                [process.env.MAINNET_DAI, process.env.MAINNET_WBTC, process.env.TEST_TARGET_USER_ADDRESS_1, process.env.TEST_LOAN_AMOUNT_WBTC, true]
            );

            console.log(newParams);
            const flashLoan = await liquidatorContract.requestFlashLoan(
                [process.env.MAINNET_WBTC!],
                [process.env.TEST_LOAN_AMOUNT_WBTC!],
                [0],
                newParams,
            );
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
                parsedLogs = wbtcTokenInterface.parseLog({ data, topics });
            });

            it("Should be a transfer log.", () => {
                expect(parsedLogs.name).to.be.equal("Transfer");
            });
            it("Should be a transfer of WBTC.", () => {
                expect(loanedTransferTx?.address.toLowerCase()).to.be.equal(process.env.MAINNET_WBTC?.toLowerCase());
            });
            it("Should have the liquidator contract as the loan receiver.", () => {
                expect(parsedLogs.args["to"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });

            it("Should have received the requested loan amount.", () => {
                expect(parsedLogs.args["value"]).to.be.equal(BigInt(process.env.TEST_LOAN_AMOUNT_WBTC!));
            });
        });
        describe("Approve WBTC Spending by Lending pool contract", () => {
            let txLogs: any;
            let parsedLogs: LogDescription;
            before("Find relevant log.", () => {
                //find all logs of token transfer  of token in [debtToCover] amount to [lending pool]
                // check to see if transaction at log index 1
                txLogs = txHash.logs.find((transaction) => { return transaction.logIndex == 1 });
                const data: string = txLogs?.data;
                const topics: string[] = txLogs?.topics;
                parsedLogs = wbtcTokenInterface.parseLog({ data, topics });
                // console.log("parsed", parsedLogs);
                // console.log("txLog", txLogs);
            });
            it("Should approve spending of WBTC.", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(wbtcToken.address.toLowerCase());
            });
            it("Should approve spending of WBTC by Lending pool.", () => {
                expect(parsedLogs.args["spender"].toLowerCase()).to.be.equal(aaveLendingPool.address.toLowerCase());
            });
            it("liquidator contract Should approve spending of its WBTC.", () => {
                expect(parsedLogs.args["owner"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should approve spending in amount of [loanAmount].", () => {
                expect(parsedLogs.args["value"]).to.be.equal(process.env.TEST_LOAN_AMOUNT_WBTC);
            });
        });
        describe("Transfer WBTC to Aave WBTC Reserve", () => {
            let txLogs: any;
            let parsedLogs: LogDescription;
            before("Find relevant log.", () => {
                //find all logs of token transfer  of token in [debtToCover] amount to [lending pool]
                // check to see if transaction at log index 19
                txLogs = txHash.logs.find((transaction) => { return transaction.logIndex == 25 });
                const data: string = txLogs?.data;
                const topics: string[] = txLogs?.topics;
                parsedLogs = wbtcTokenInterface.parseLog({ data, topics });

            });
            it("Should be a 'Transfer' event log.", () => {
                expect(parsedLogs.name).to.be.equal("Transfer");
            });
            it("Should be transfering WBTC Token.", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(wbtcToken.address.toLowerCase());
            });
            it("Should transfer WBTC from liquidation contract.", () => {
                expect(parsedLogs.args["from"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should transfer WBTC to aave WBTC reserve.", () => {
                expect(parsedLogs.args["to"].toLowerCase()).to.be.equal(awbtcTokenV2.toLowerCase());
            });
            it("Should transfer WBTC in amount of [debtToCover].", () => {
                expect(parsedLogs.args["value"]).to.be.equal(process.env.TEST_TARGET_DEBT_TO_COVER_WBTC!);
            });
        });
        describe("executeOperation", () => {

            let parsedLogs: LogDescription;
            let txLogs: any;
            const collateralAsset = process.env.MAINNET_DAI!;
            const debtAsset = process.env.MAINNET_WBTC!;
            const debtToCover = process.env.TEST_TARGET_DEBT_TO_COVER_WBTC!;
            // const liquidatedCollateral = process.env.TEST_TARGET_LIQUIDATED_DAI!;
            const receiveAToken = false;
            before("Find liquidation call log.", () => {

                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 26;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = aaveLendingPool.interface.parseLog({ data, topics });
                // console.log(parsedLogs);
                // console.log(BigInt(parsedLogs.args["debtToCover"]));
            });

            it("Should be a liquidation call event log.", () => {
                expect(parsedLogs.name).to.be.equal("LiquidationCall");
            });
            it("Should be emmited by aave Lending pool.", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(aaveLendingPool.address.toLowerCase());
            });
            it("Should have liquidated WBTC debt.", () => {
                expect(parsedLogs.args["debtAsset"].toLowerCase()).to.be.equal(debtAsset.toLowerCase());
            });
            it("Should have liquidated the correct amount of WBTC token.", () => {
                expect(parsedLogs.args["debtToCover"]).to.be.equal(debtToCover);
            });
            it("Should have received DAI token in return.", () => {
                expect(parsedLogs.args["collateralAsset"].toLowerCase()).to.be.equal(collateralAsset.toLowerCase());
            });

            it("Should have been liquidated by liquidator contract.", () => {
                expect(parsedLogs.args["liquidator"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should have not received AToken.", () => {
                expect(parsedLogs.args["receiveAToken"]).to.be.equal(receiveAToken);
            });
        });
        describe("Approve spending of DAI by uniswap Router.", () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("get approval log for swap.", () => {
                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 28;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = daiTokenInterface.parseLog({ data, topics });
                // console.log(parsedLogs);
                // console.log(BigInt(parsedLogs.args["value"]));
            });
            it("Should be an approval event", () => {
                expect(parsedLogs.name).to.be.equal("Approval");
            });
            it("Should have approved DAI", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(daiToken.address.toLowerCase());
            });
            it("Should have been approved for uniswap router", () => {
                expect(parsedLogs.args["spender"].toLowerCase()).to.be.equal(uniswapRouterV2.address.toLowerCase());
            });
            it("Should have been approved by liquidator contract", () => {
                expect(parsedLogs.args["owner"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should have approved the correct amount.", () => {
                expect(parsedLogs.args["value"]).to.be.equal(BigInt('2788206960646720141'));
            });
        });
        describe("Transfer DAI from liquidator contract to DAI/WETC LP reserve.", () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("get transfer log.", () => {
                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 29;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = daiTokenInterface.parseLog({ data, topics });
                // console.log(parsedLogs);
                // console.log(BigInt(parsedLogs.args["value"]));
            });
            it("Should be a transfer event log.", () => {
                expect(parsedLogs.name).to.be.equal("Transfer");
            });
            it("Should have transfered DAI.", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(daiToken.address.toLowerCase());
            });
            it("Should have transfered to uniswap reserve.", () => {
                expect(parsedLogs.args["to"].toLowerCase()).to.be.equal(daiWethLpAddress.toLowerCase());
            });
            it("Should have transfered from liquidator contract", () => {
                expect(parsedLogs.args["from"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should have transfered correct amount.", () => {
                expect(parsedLogs.args["value"]).to.be.equal(BigInt('2699761706685493051'));
            });

        });
        describe("Transfer WETH from DAI/WETH LP reserve to WBTC/WETH LP reserve.", () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("get transfer log.", () => {
                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 30;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = wethTokenInterface.parseLog({ data, topics });
                // console.log("log", parsedLogs);
                // console.log("val", BigInt(parsedLogs.args["value"]));
            });
            it("Should be a transfer event.", () => {
                expect(parsedLogs.name).to.be.equal("Transfer");
            });
            it("Should be a transfer of WETH.", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(wethToken.address.toLowerCase());
            });
            it("Should have transfered from DAI/WETH LP reserve.", () => {
                expect(parsedLogs.args["from"].toLowerCase()).to.be.equal(daiWethLpAddress.toLowerCase());
            });
            it("Should have transfered to WBTC/WETH LP reserve.", () => {
                expect(parsedLogs.args["to"].toLowerCase()).to.be.equal(wbtcWethLpAddress.toLowerCase());
            });
            it("Should have transfered correct amount.", () => {
                expect(parsedLogs.args["value"]).to.be.equal(BigInt('1098356062954707'));
            });
        });
        describe("Transfer WBTC from WBTC/WETH LP reserve to liquidator contract.", () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("get transfer log.", () => {
                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 33;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = wbtcTokenInterface.parseLog({ data, topics });

            });
            it("Should be an transfer event", () => {
                expect(parsedLogs.name).to.be.equal("Transfer");
            });
            it("Should have transfered WBTC", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(wbtcToken.address.toLowerCase());
            });
            it("Should have been transfered from uniswap router", () => {
                expect(parsedLogs.args["from"].toLowerCase()).to.be.equal(wbtcWethLpAddress.toLowerCase());
            });
            it("Should have been transfered to liquidator contract", () => {
                expect(parsedLogs.args["to"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should have transfered the correct amount.", () => {
                expect(parsedLogs.args["value"]).to.be.equal(BigInt(6859));
            });
        });
        describe("Completed swap from DAI to BTC.", () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("Find log where swap should have happened.", () => {

                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 36;
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
            it("Should have swapped from DAI.", () => {
                expect(parsedLogs.args["fromAsset"].toLowerCase()).to.be.equal(daiToken.address.toLowerCase())
            });
            it("Should have swapped to WBTC.", () => {
                expect(parsedLogs.args["toAsset"].toLowerCase()).to.be.equal(wbtcToken.address.toLowerCase());
            });

            it("Should have swapped DAI correct amount.", () => {
                expect(parsedLogs.args["fromAmount"]).to.be.equal(BigInt('2699761706685493051'));
            });
            it("Should have swapped for exact WBTC.", () => {
                expect(parsedLogs.args["receivedAmount"]).to.be.equal(BigInt('6859'));
            });

        });
        describe("Approve WBTC transfer for paying back loan.", () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("Find log where approval should have happened.", () => {

                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 37;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = wbtcTokenInterface.parseLog({ data, topics });

            });
            it("Should be a [Approval] event log.", () => {
                expect(parsedLogs.name).to.be.equal("Approval")
            });
            it("Should approve spending of WBTC.", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(wbtcToken.address.toLowerCase())
            });
            it("Should approve spending of [FlashLoanDebt] amount.", () => {
                expect(Number(parsedLogs.args["value"])).to.be.greaterThan(Number(process.env.TEST_LOAN_AMOUNT_WBTC!));
            });

            it("Should be approved by liquidator contract.", () => {
                expect(parsedLogs.args["owner"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should approve aave lending pool contract to spend token.", () => {
                expect(parsedLogs.args["spender"].toLowerCase()).to.be.equal(aaveLendingPool.address.toLowerCase());
            });

        });
        describe("Transfer WBTC to Aave WBTC reserve.", () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("Find log where transfer should have happened.", () => {

                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 40;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = wbtcTokenInterface.parseLog({ data, topics });
                // console.log(parsedLogs);
                // console.log(BigInt(parsedLogs.args["value"]));
            });
            it("Should be a [Transfer] event log.", () => {
                expect(parsedLogs.name).to.be.equal("Transfer");
            });
            it("Should have sent WBTC token.", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(wbtcToken.address.toLowerCase());
            });

            it("Should have been in amount of flashLoan debt.", () => {
                expect(Number(parsedLogs.args["value"])).to.be.greaterThan(Number(process.env.TEST_LOAN_AMOUNT_WBTC!));
            });

            it("Should be transfered by liquidator contract", () => {
                expect(parsedLogs.args["from"].toLowerCase()).to.be.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should transfer flashLoan debt to aave WBTC token reserve", () => {
                expect(parsedLogs.args["to"].toLowerCase()).to.be.equal(awbtcTokenV2.toLowerCase());
            });
        });
        describe("Conclude FlashLoan.", () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("Find log where approval should have happened.", () => {

                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 41;
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
                expect(parsedLogs.args["asset"].toLowerCase()).to.equal(wbtcToken.address.toLowerCase());
            });
            it("Should have sent amount to the liquidator contract.", () => {
                expect(parsedLogs.args["amount"]).to.be.equal(process.env.TEST_LOAN_AMOUNT_WBTC);
            });

        });
        describe("Transfer remaining collateral asset to msg.sender", async () => {
            let parsedLogs: LogDescription;
            let txLogs: any;
            before("Find log where transfer should have happened.", () => {

                txLogs = txHash.logs.find((transaction) => {
                    return transaction.logIndex == 42;
                });
                const data: string = txLogs.data;
                const topics: string[] = txLogs.topics;
                parsedLogs = daiTokenInterface.parseLog({ data, topics });
                // console.log("parsed logs", parsedLogs);
                // console.log("parsed logs", BigInt(parsedLogs.args["value"]));
            });
            it("Should be a transfer log", () => {
                expect(parsedLogs.name).to.be.equal("Transfer");
            });
            it("Should have transfered collateral asset", () => {
                expect(txLogs?.address.toLowerCase()).to.be.equal(daiToken.address.toLowerCase());
            });
            it("Should have transfered to msg.sender", () => {
                expect(parsedLogs.args["to"].toLowerCase()).to.equal(alice.address.toLowerCase());
            });
            it("Should have transfered from liquidator contract", () => {
                expect(parsedLogs.args["from"].toLowerCase()).to.equal(liquidatorContract.address.toLowerCase());
            });
            it("Should have transfered all collateral assets owned by contract", async () => {
                expect(parsedLogs.args["value"]).to.equal(await daiToken.balanceOf(alice.address));
            });
            it("Should have zero debt assets left in msg.sender", async () => {
                expect(await wbtcToken.balanceOf(alice.address)).to.equal(BigInt(0))
            });
            it("Should have zero collateral assets left in the contract", async () => {
                expect(await daiToken.balanceOf(liquidatorContract.address)).to.equal(BigInt(0))
            });
            it("Should have zero debt assets left in the contract", async () => {
                expect(await wbtcToken.balanceOf(liquidatorContract.address)).to.equal(BigInt(0))
            });


        });

    });

});