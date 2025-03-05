const { expect } = require("chai");
const { ethers, ignition } = require("hardhat");
const raffleModule = require("../../ignition/modules/01-Raffle");
const { chainIds, devChains, networkConfig } = require("../../helper-hardhat-config");

const currentNetwork = process.env.NETWORK || "hardhat";
const localFlag = devChains.includes(currentNetwork);

if (localFlag) {
    describe.skip;
} else {
    let raffle;
    let raffleAddress;
    let availableAccounts;
    let initialTimestamp;
    let entranceFee;
    let initialBalanceMap = new Map();

    beforeEach(async () => {
        const { contract_raffle } = await ignition.deploy(raffleModule);
        raffle = contract_raffle;
        raffleAddress = await raffle.getAddress();
        availableAccounts = await ethers.getSigners();
        initialTimestamp = await raffle.getLastTimeStamp();
        entranceFee = await raffle.getEntranceFee();
        for (let i = 0; i < availableAccounts.length; i++) {
            initialBalanceMap.set(
                availableAccounts[i].address,
                await ethers.provider.getBalance(availableAccounts[i].address),
            );
        }
    });

    describe("Fulfilling randomness", () => {
        it("Should pick the winner", async () => {
            /* First setup listener for the event, so when later the function is called
                        the listener will be triggered, in code it seems backwards */
            await new Promise(async (resolve, reject) => {
                raffle.once("WinnerPicked", async () => {
                    try {
                        const recentWinner = await raffle.getLatestWinner();
                        expect(recentWinner).to.be.properAddress;
                    } catch (error) {
                        if (!error.matcherResult) {
                            // ChaiJS assertion errors have matcherResult
                            reject(error);
                        }
                        throw error;
                    }
                    resolve();
                });
                const [owner] = availableAccounts;
                await raffle.connect(owner).enterRaffle({ value: entranceFee });
            });
        });
        it("Should reset to initial state after winner picked", async () => {
            const chainId = chainIds[currentNetwork];
            await new Promise(async (resolve, reject) => {
                raffle.once("WinnerPicked", async () => {
                    try {
                        const raffleState = await raffle.getRaffleState();
                        const lastWinTimestamp = await raffle.getLastTimeStamp();
                        const currentTimestamp = (await ethers.provider.getBlock("latest"))
                            .timestamp;

                        const tolerance = networkConfig[chainId].timestampTolerance;

                        expect(raffleState).to.equals(0);
                        expect(lastWinTimestamp).to.be.gt(startingTime);
                        expect(lastWinTimestamp).to.be.closeTo(currentTimestamp, tolerance);
                        await expect(raffle.getPlayer(0)).to.be.reverted;
                        resolve();
                    } catch (error) {
                        if (!error.matcherResult) {
                            // ChaiJS assertion errors have matcherResult
                            reject(error);
                        }
                        throw error;
                    }
                    resolve();
                });
                const [owner] = availableAccounts;
                await raffle.connect(owner).enterRaffle({ value: entranceFee });
            });
        });
        it("Should send the money to the winner", async () => {
            const initialBalance_raffle = await ethers.provider.getBalance(raffleAddress);
            let winnerAddress;
            let txnFee;

            await new Promise(async (resolve, reject) => {
                raffle.once("WinnerPicked", async () => {
                    try {
                        winnerAddress = await raffle.getLatestWinner();
                        const initialBalance_winner = initialBalanceMap.get(winnerAddress);
                        const finalBalance_winner = await ethers.provider.getBalance(winnerAddress);
                        const finalBalance_raffle = await ethers.provider.getBalance(raffleAddress);

                        expect(finalBalance_winner).to.be.lte(
                            initialBalance_winner + initialBalance_raffle - txnFee,
                        );
                        expect(finalBalance_raffle).to.be.equals(0);

                        resolve();
                    } catch (error) {
                        if (!error.matcherResult) {
                            // ChaiJS assertion errors have matcherResult
                            reject(error);
                        }
                        throw error;
                    }
                    resolve();
                });

                const [owner] = availableAccounts;
                await raffle.connect(owner).enterRaffle({ value: entranceFee });
            });
        });
    });
}
