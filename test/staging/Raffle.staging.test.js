const { expect } = require("chai");
const { ethers, ignition } = require("hardhat");
const raffleModule = require("../../ignition/modules/01-Raffle");
const { chainIds, devChains, networkConfig } = require("../../helper-hardhat-config");

const currentNetwork = process.env.NETWORK || "hardhat";
const localFlag = devChains.includes(currentNetwork);

if (localFlag) {
    describe.skip;
} else {
    let contract_raffle;

    let entranceFee;
    let interval;
    let address_raffle;

    let accounts;
    let deployer;

    beforeEach(async () => {
        accounts = await ethers.getSigners();
        const [deployer] = await ethers.getSigners();

        address_raffle = "0xB1A4De0a2a27672F1b299C45C9A98a9b50E1c0f8";
        contract_raffle = await ethers.getContractAt("Raffle", address_raffle);
        await contract_raffle.connect(deployer);
        entranceFee = await contract_raffle.getEntranceFee();
        interval = await contract_raffle.getInterval();
    });

    describe("Function `fulfillRandomWords()`:", () => {
        it("Works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async () => {
            console.log("Starting test...");
            /**Enter raffle
             * This should be the only thing we need to do, for getting winner is done by keeper
             */
            const startingTimeStamp = await contract_raffle.getLastTimeStamp();

            console.log("Setup listener...");
            /**Set up listener before entering raffle
             * Just in case blockchain computes really fast
             */
            await new Promise(async (resolve, reject) => {
                contract_raffle.once("WinnerPicked", async () => {
                    console.log("Event fired!");
                    try {
                        const recentWinner = await contract_raffle.getRecentWinner();
                        const winnerEndingBalance = await ethers.provider.getBalance(recentWinner);
                        const raffleState = await contract_raffle.getRaffleState();
                        const endingTimestamp = await contract_raffle.getLatestTimestamp();

                        // Asserts
                        await expect(contract_raffle.getPlayer(0)).to.be.reverted; // `s_players` got reset
                        assert.equal(recentWinner.toString(), accounts[0].address);
                        assert.equal(raffleState.toString(), "0");
                        assert.equal(
                            winnerEndingBalance.toString(),
                            (winnerStartingBalance + BigInt(entranceFee)).toString(),
                        );
                        assert(endingTimestamp > startingTimeStamp);
                        resolve();
                    } catch (error) {
                        console.log(error);
                        reject();
                    }
                });

                console.log("Entering raffle");
                // Enter raffle
                const txn = await contract_raffle.enterRaffle({
                    value: entranceFee,
                });
                await txn.wait(1);
                console.log("Pending...");
                const winnerStartingBalance = await ethers.provider.getBalance(accounts[0].address);

                /**This section won't complete until listener finishes listening
                 * `await` -> This section -> Outer `await` complete?(Depending on listener) -> Done
                 */
            });
        });
    });
}
