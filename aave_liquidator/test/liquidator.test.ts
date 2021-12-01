
// import { expect } from "chai";
// import { ethers } from "hardhat";

// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// import { Liquidator__factory, Liquidator, IERC20__factory, IERC20 } from "../typechain";

// //TODO: check transaction logs and test against that to make sure every step was sucessfull.


// describe("Liquidator", async function () {
//     let liquidatorContract: Liquidator;
//     let owner: SignerWithAddress;
//     let alice: SignerWithAddress;
//     let bob: SignerWithAddress;
//     let daiToken: IERC20;
//     let wethToken: IERC20;
//     let wbtcToken: IERC20;
//     let usdcToken: IERC20;
//     let initBlock: number;
//     // initBlock = await ethers.provider.getBlockNumber();
//     before("Deploy contract using alice", async function () {

//         [owner, alice, bob] = await ethers.getSigners();
//         const LiquidatorFactory = (await ethers.getContractFactory("Liquidator", alice)) as Liquidator__factory;
//         liquidatorContract = await LiquidatorFactory.deploy(process.env.MAINNET_AAVE_ADDRESS_PROVIDER!, process.env.MAINNET_UNISWAP_ROUTER!, process.env.MAINNET_WETH!);
//         await liquidatorContract.deployed();

//         daiToken = IERC20__factory.connect(process.env.MAINNET_DAI!, alice);
//         usdcToken = IERC20__factory.connect(process.env.MAINNET_USDC!, alice);
//         wethToken = IERC20__factory.connect(process.env.MAINNET_WETH!, alice);
//         wbtcToken = IERC20__factory.connect(process.env.MAINNET_WBTC!, alice);

//         await daiToken.deployed();
//         await wethToken.deployed();
//         await wbtcToken.deployed();
//         await usdcToken.deployed();
//         initBlock = await ethers.provider.getBlockNumber();
//         console.log("blocknumber is: ", initBlock);

//     });

//     describe("Liquidator Contract Deployement", () => {
//         it("Should have proper address for each contract", async () => {

//             expect(liquidatorContract.address).to.be.properAddress;
//             expect(daiToken.address).to.be.properAddress;
//             expect(wethToken.address).to.be.properAddress;
//             expect(wbtcToken.address).to.be.properAddress;
//             expect(usdcToken.address).to.be.properAddress;

//             expect(daiToken.address).to.be.equal(process.env.MAINNET_DAI);
//             expect(wethToken.address).to.be.equal(process.env.MAINNET_WETH);
//             expect(wbtcToken.address).to.be.equal(process.env.MAINNET_WBTC);
//             expect(usdcToken.address).to.be.equal(process.env.MAINNET_USDC);

//         });

//         it("All Token balance should be empty for alice and liquidator contract", async () => {

//             expect(await daiToken.balanceOf(alice.address)).to.be.equal(BigInt(0));
//             expect(await wethToken.balanceOf(alice.address)).to.be.equal(BigInt(0));
//             expect(await wbtcToken.balanceOf(alice.address)).to.be.equal(BigInt(0));
//             expect(await usdcToken.balanceOf(alice.address)).to.be.equal(BigInt(0));

//             expect(await daiToken.balanceOf(liquidatorContract.address)).to.be.equal(BigInt(0));
//             expect(await wethToken.balanceOf(liquidatorContract.address)).to.be.equal(BigInt(0));
//             expect(await wbtcToken.balanceOf(liquidatorContract.address)).to.be.equal(BigInt(0));
//             expect(await usdcToken.balanceOf(liquidatorContract.address)).to.be.equal(BigInt(0));
//             //TODO: should contract hold ETH for gas or should msg.sender?
//         });
//     });


//     describe("Initiate Flashloan", async () => {


//         it("Should use a flash loan to liquidate DAI debt", async () => {
//             if (initBlock == 12936365) {
//                 console.log("DAI:DAI liquidation @block:", initBlock);
//                 const newParams = ethers.utils.defaultAbiCoder.encode(
//                     ["address", "address", "address", "uint256", "bool"],
//                     [process.env.MAINNET_DAI, process.env.MAINNET_DAI, process.env.TEST_TARGET_USER_ADDRESS_0, process.env.TEST_TARGET_DEBT_TO_COVER_DAI, false]
//                 );

//                 console.log("encoded");
//                 const flashLoan = await liquidatorContract.requestFlashLoan([process.env.MAINNET_DAI!], [process.env.TEST_LOAN_AMOUNT_0!], [0], newParams);
//                 const txHash = await flashLoan.wait()
//                 console.log('LOAN TX HASH:' + txHash.gasUsed);
//             }
//             else { expect(initBlock).to.not.equal(12936365); }
//         });

//         it("Should use a flash loan to liquidate WETH debt", async () => {
//             if (initBlock == 12401788) {
//                 console.log("USDC:WETH liquidation @block:", initBlock);
//                 const newParams = ethers.utils.defaultAbiCoder.encode(
//                     ["address", "address", "address", "uint256", "bool"],
//                     [process.env.MAINNET_USDC, process.env.MAINNET_WETH, process.env.TEST_TARGET_USER_ADDRESS_2, process.env.TEST_TARGET_DEBT_TO_COVER_WETH, false]
//                 );

                
//                 const flashLoan = await liquidatorContract.requestFlashLoan([process.env.MAINNET_WETH!], [process.env.TEST_LOAN_AMOUNT_2!], [0], newParams);
//                 const txHash = await flashLoan.wait()
//                 console.log('LOAN TX HASH:' + txHash.gasUsed);

//                 expect(await usdcToken.balanceOf(alice.address)).to.be.equal(BigInt(23124565));
//                 expect(await usdcToken.balanceOf(liquidatorContract.address)).to.be.equal(BigInt(0))
//                 expect(await wethToken.balanceOf(alice.address)).to.be.equal(BigInt(0));
//                 expect(await wethToken.balanceOf(liquidatorContract.address)).to.be.equal(BigInt(0))
//             }
//             else { expect(initBlock).to.not.equal(12401788); }
//         });


//         it("Should have a dai balance in sender wallet", async () => {
//             if (initBlock == 12645948) {
//                 console.log(" DAI:WBTC liquidation @block:", initBlock)
//                 const newParams = ethers.utils.defaultAbiCoder.encode(
//                     ["address", "address", "address", "uint256", "bool"],
//                     [process.env.MAINNET_DAI, process.env.MAINNET_WBTC, process.env.TEST_TARGET_USER_ADDRESS_1, process.env.TEST_TARGET_DEBT_TO_COVER_WBTC, false]
//                 );

//                 console.log("encoded");
//                 const flashLoan = await liquidatorContract.requestFlashLoan([process.env.MAINNET_WBTC!], [process.env.TEST_LOAN_AMOUNT_1!], [0], newParams);
//                 const txHash = await flashLoan.wait()
//                 console.log('LOAN TX HASH:' + txHash.blockHash);
//                 console.log("logs:", txHash.logs);
//                 console.log("topics", txHash.logs.filter((item) => {
//                     return item.topics[0] == '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
//                 }));
//                 expect(await daiToken.balanceOf(alice.address)).to.be.equal(BigInt(95425890649700288));
//                 expect(await daiToken.balanceOf(liquidatorContract.address)).to.be.equal(BigInt(0))
//                 expect(await wbtcToken.balanceOf(alice.address)).to.be.equal(BigInt(0));
//                 expect(await wbtcToken.balanceOf(liquidatorContract.address)).to.be.equal(BigInt(0))
//             } else { expect(initBlock).to.not.equal(12645948); }

//         });





//     });

//     describe("Initiate FlashLoan", async () => {
//         it("Should transfer requested amount to this contract address", () => { });
//     });
//     describe("Excecute Liquidation Call", async () => {

//         it("Should approve spending of borrowed asset by Lending pool in the amount of debt to cover.", () => { });
//         it("Should transfer debt to cover amount to Lending pool.", () => { });
//         it("Should have liquidated account & received the collateral amount & reward.", () => { });
//     });
//     describe("Swap between collateral and debt asset", async () => {
//         //TODO: swap can happen etween multiple assets before completing
//         it("Should Approve spending of collateral asset by exchange in value of amount to swap", () => { });
//         it("Should transfer collateral asset to exchange", () => { });
//         it("Should execute a swap for an exact token amount", () => { });
//     });
//     describe("Repay Loan", async () => {
//         it("Should approve spending of debt asset by lending pool in flashloan debt amount.", () => { });
//         it("Should transfer flashLoan debt to lending pool", () => { });
//         it("Should conclude flashLoan by paying loaned amount + premium", () => { });
//     });
//     describe("Transfer remaining asset to msg.sender", async () => {

//         it("Should transfer remaining asset to msg.sender", () => { });

//     });
//     describe("Verify final state of contract", async () => {
//         it("Should have an empty balance for all assets of this contract", () => { });
//         it("Should have enough eth left to make other tx?", () => { });
//     });

// });