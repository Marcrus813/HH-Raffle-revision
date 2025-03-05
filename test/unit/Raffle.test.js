const { expect } = require("chai");
const { ethers, ignition, network } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const raffleModule = require("../../ignition/modules/01-Raffle");
const { chainIds, devChains, networkConfig } = require("../../helper-hardhat-config");
const { raffleParams } = require("../../raffle-params");

const currentNetwork = process.env.NETWORK || "hardhat";
const localFlag = devChains.includes(currentNetwork);

if (!localFlag) {
    describe.skip;
} else {
    describe("Raffle", async () => {
        let raffle;
        let raffleAddress;
        let mock;
        let mockAddress;
        let initialTimestamp;
        let availableAccounts;
        let entranceFee;
        let interval;
        let initialBalanceMap = new Map();

        async function deployFixture() {
            const { contract_raffle, contract_vrfMock } = await ignition.deploy(raffleModule);
            raffleAddress = await contract_raffle.getAddress();
            mockAddress = await contract_vrfMock.getAddress();
            initialTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
            return { contract_raffle, contract_vrfMock };
        }

        beforeEach(async () => {
            const deployments = await loadFixture(deployFixture);
            raffle = deployments.contract_raffle;
            mock = deployments.contract_vrfMock;
            availableAccounts = await ethers.getSigners();
            entranceFee = await raffle.getEntranceFee();
            interval = await raffle.getInterval();
            for (let i = 0; i < availableAccounts.length; i++) {
                initialBalanceMap.set(
                    availableAccounts[i].address,
                    await ethers.provider.getBalance(availableAccounts[i].address),
                );
            }
        });

        describe("Deployment", () => {
            it("Should deploy the mock contract with valid addresses", async () => {
                expect(mockAddress).to.be.properAddress;
            });
            it("Should deploy the contract with valid addresses", async () => {
                expect(raffleAddress).to.be.properAddress;
            });
            it("Should have the correct VRF Params", async () => {
                // Here use local values to expect, in staging test use configured params
                const vrfCoordinatorAddress = await raffle.getVrfCoordinator();
                const keyHash = await raffle.getKeyHash();
                const callbackGasLimit = await raffle.getCallbackGasLimit();
                const requestConfirmations = await raffle.getRequestConfirmations();
                const numWords = await raffle.getNumWords();

                expect(vrfCoordinatorAddress).to.equals(mockAddress);
                expect(keyHash).to.equals(
                    "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae",
                );
                expect(callbackGasLimit).to.equals(500000);
                expect(requestConfirmations).to.equals(1);
                expect(numWords).to.equals(1);
            });
            it("Should set correct Raffle params", async () => {
                const entranceFeeInput = raffleParams.entranceFee;
                const intervalInput = raffleParams.interval;
                expect(entranceFee).to.equals(entranceFeeInput);
                expect(interval).to.equals(intervalInput);
            });
        });

        describe("Setup", () => {
            it("Should have a valid subscription ID", async () => {
                const subscriptionId = await raffle.getSubId();
                expect(subscriptionId).to.be.not.equals(0);
            });
            it("Should register the contract in the VRF contract", async () => {
                const subscriptionId = await raffle.getSubId();
                const isConsumerRegistered = await mock.consumerIsAdded(
                    subscriptionId,
                    raffleAddress,
                );
                expect(isConsumerRegistered).to.be.true;
            });
            it("Should have funded subscription", async () => {
                const subscriptionId = await raffle.getSubId();
                const subObject = await mock.getSubscription(subscriptionId);
                const [subscriptionBalance] = subObject;
                expect(subscriptionBalance).to.be.gt(0);
            });
        });

        describe("Functionalities", () => {
            describe("Initial state", () => {
                it("Should initialize the contract with state `OPEN`", async () => {
                    const raffleState = await raffle.getRaffleState();
                    expect(raffleState).to.equals(0);
                });
                it("Should have timestamp of the blockchain when it was deployed", async () => {
                    const chainId = chainIds[currentNetwork];
                    const timestamp = await raffle.getLastTimeStamp();
                    const tolerance = networkConfig[chainId].timestampTolerance;
                    expect(timestamp).to.be.closeTo(initialTimestamp, tolerance);
                });
                it("Should have empty players data for the raffle", async () => {
                    await expect(raffle.getPlayer(0)).to.be.reverted;
                });
                it("Should have empty winner data for the raffle", async () => {
                    await expect(raffle.getLatestWinner()).to.be.reverted;
                });
            });
            describe("Enter raffle", () => {
                it("Should revert if not enough ETH", async () => {
                    const ethAmount = 9_999_999_999_999_999n;
                    await expect(
                        raffle.enterRaffle({ value: ethAmount }),
                    ).to.be.revertedWithCustomError(raffle, "Raffle__NotEnoughEthEntered");
                });
                it("Should record players", async () => {
                    const [, player1, player2, player3] = availableAccounts;
                    await raffle.connect(player1).enterRaffle({ value: entranceFee });
                    await raffle.connect(player2).enterRaffle({ value: entranceFee });
                    await raffle.connect(player3).enterRaffle({ value: entranceFee });
                    const player1Address = await raffle.getPlayer(0);
                    const player2Address = await raffle.getPlayer(1);
                    const player3Address = await raffle.getPlayer(2);
                    expect(player1Address).to.equals(player1.address);
                    expect(player2Address).to.equals(player2.address);
                    expect(player3Address).to.equals(player3.address);
                });
                it("Should emit `RaffleEnter` event after successful entry", async () => {
                    // Chai approach
                    const [, rafflePlayer] = availableAccounts;
                    await expect(raffle.connect(rafflePlayer).enterRaffle({ value: entranceFee }))
                        .to.emit(raffle, "RaffleEnter")
                        .withArgs(rafflePlayer.address);

                    // Ethers approach
                    /* const filter = raffle.filters.RaffleEnter();
                    const event = await raffle.queryFilter(filter);
                    expect(event[0].args[0]).to.equals(rafflePlayer.address); */
                });
                it("Should prevent entrance when calculating", async () => {
                    const [, player0, player1] = availableAccounts;
                    await raffle.connect(player0).enterRaffle({ value: entranceFee });
                    await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                    await network.provider.send("evm_mine", []);
                    // All conditions met, simulate keeper
                    await raffle.performUpkeep("0x"); // To change the state to `CALCULATING`
                    await expect(
                        raffle.connect(player1).enterRaffle({ value: entranceFee }),
                    ).to.be.revertedWithCustomError(raffle, "Raffle__RaffleNotOpen");
                });
            });
            describe("Triggering", () => {
                let owner, player0, player1, player2;
                beforeEach(async () => {
                    [owner, player0, player1, player2] = availableAccounts;
                });
                it("Should not trigger if raffle not open", async () => {
                    await raffle.connect(player0).enterRaffle({ value: entranceFee });
                    await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                    await network.provider.send("evm_mine", []);
                    await raffle.performUpkeep("0x"); // To change the state to `CALCULATING`
                    const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
                    expect(upkeepNeeded).to.be.false;
                });

                it("Should not trigger if not enough players", async () => {
                    const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
                    expect(upkeepNeeded).to.be.false;
                });

                it("Should not trigger if not enough time elapsed", async () => {
                    await raffle.connect(player0).enterRaffle({ value: entranceFee });
                    await network.provider.send("evm_increaseTime", [Number(interval) - 2]);
                    await network.provider.send("evm_mine", []);
                    await raffle.performUpkeep("0x"); // To change the state to `CALCULATING`
                    const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
                    expect(upkeepNeeded).to.be.false;
                });

                it("Should not trigger if not enough balance", async () => {
                    const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
                    expect(upkeepNeeded).to.be.false;
                });
            });
            describe("Performing upkeep", () => {
                it("Should not perform if upkeep not needed", async () => {
                    await expect(raffle.performUpkeep("0x"))
                        .to.be.revertedWithCustomError(raffle, "Raffle__UpkeepNotNeeded")
                        .withArgs(0, 0, 0);
                });
                it("Should set state to `CALCULATING` when performing", async () => {
                    const [, player0] = availableAccounts;
                    await raffle.connect(player0).enterRaffle({ value: entranceFee });
                    await network.provider.send("evm_increaseTime", [Number(interval) + 2]);
                    await network.provider.send("evm_mine", []);
                    await raffle.performUpkeep("0x");
                    const raffleState = await raffle.getRaffleState();
                    expect(raffleState).to.be.equals(1);
                });
                it("Should get a `requestId` from emitted event", async () => {
                    const [, player0] = availableAccounts;
                    await raffle.connect(player0).enterRaffle({ value: entranceFee });
                    await network.provider.send("evm_increaseTime", [Number(interval) + 2]);
                    await network.provider.send("evm_mine", []);
                    await expect(raffle.performUpkeep("0x")).to.emit(
                        raffle,
                        "randomWinnerRequested",
                    );

                    /* // Ethers section

                    // Raw, without filter

                    const eventTopic = ethers.id("randomWinnerRequested(uint256)"); // Using the signature of the event

                    const rawLogs = await ethers.provider.getLogs({
                        address: raffleAddress,
                        topics: [eventTopic],
                        fromBlock:
                            (await ethers.provider.getBlockNumber()) - 10000 <= 0
                                ? 0
                                : (await ethers.provider.getBlockNumber()) - 10000,
                        toBlock: await ethers.provider.getBlockNumber(),
                    });

                    const artifact = JSON.parse(
                        fs.readFileSync(
                            path.join(
                                __dirname,
                                "../../artifacts/contracts/Raffle.sol/Raffle.json",
                            ),
                            "utf8",
                        ),
                    );
                    const abi = artifact.abi;
                    const interface = new ethers.Interface(abi);
                    const parsedLog = interface.parseLog(rawLogs[rawLogs.length - 1]);
                    const requestId = parsedLog.args[0];
                    expect(requestId).to.be.not.null;

                    // With `transactionReceipt`

                    const txnResponse = await raffle.performUpkeep("0x");
                    const receipt = await txnResponse.wait(1);

                    // VRF emitted event before our event
                    const requestId = receipt.events[1].args.requestId;

                    // With ethers filter
                    const filter = raffle.filters.randomWinnerRequested();
                    const randomWinnerRequestedEvent = await raffle.queryFilter(filter);
                    const requestId = randomWinnerRequestedEvent[0].args[0];
                    expect(requestId).to.be.not.null; */
                });
            });
            describe("Fulfilling randomness", () => {
                let owner, player0, player1, player2, player3;
                let startingTime;
                beforeEach(async () => {
                    [owner, player0, player1, player2, player3] = availableAccounts;
                    await raffle.connect(player0).enterRaffle({ value: entranceFee });
                    await raffle.connect(player1).enterRaffle({ value: entranceFee });
                    await raffle.connect(player2).enterRaffle({ value: entranceFee });
                    await raffle.connect(player3).enterRaffle({ value: entranceFee });
                    await network.provider.send("evm_increaseTime", [Number(interval) + 2]);
                    await network.provider.send("evm_mine", []);
                    startingTime = await raffle.getLastTimeStamp();
                });
                it("Should only be called after `performUpkeep`", async () => {
                    for (let requestId = 0; requestId <= 10; requestId++) {
                        await expect(
                            mock.fulfillRandomWords(requestId, raffleAddress),
                        ).to.be.revertedWithCustomError(mock, "InvalidRequest");
                    }
                });
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
                        await raffle.performUpkeep("0x");
                        let requestId;
                        const randomRequest_event_filter = raffle.filters.randomWinnerRequested();
                        const randomRequest_event = await raffle.queryFilter(
                            randomRequest_event_filter,
                        );
                        requestId = randomRequest_event[0].args.requestId;

                        /**
                         * This will emit mock's `fulfillRandomWords`, then emit its `RandomWordsFulfilled`,
                         * then raffle's `WinnerPicked`, then this will trigger the listener above
                         */
                        await mock.fulfillRandomWords(requestId, raffleAddress);
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

                        await raffle.performUpkeep("0x");
                        let requestId;
                        const randomRequest_event_filter = raffle.filters.randomWinnerRequested();
                        const randomRequest_event = await raffle.queryFilter(
                            randomRequest_event_filter,
                        );
                        requestId = randomRequest_event[0].args.requestId;

                        /**
                         * This will emit mock's `fulfillRandomWords`, then emit its `RandomWordsFulfilled`,
                         * then raffle's `WinnerPicked`, then this will trigger the listener above
                         */
                        await mock.fulfillRandomWords(requestId, raffleAddress);
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
                                const finalBalance_winner =
                                    await ethers.provider.getBalance(winnerAddress);
                                const finalBalance_raffle =
                                    await ethers.provider.getBalance(raffleAddress);

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

                        await raffle.performUpkeep("0x");
                        let requestId;
                        const randomRequest_event_filter = raffle.filters.randomWinnerRequested();
                        const randomRequest_event = await raffle.queryFilter(
                            randomRequest_event_filter,
                        );
                        requestId = randomRequest_event[0].args.requestId;

                        /**
                         * This will emit mock's `fulfillRandomWords`, then emit its `RandomWordsFulfilled`,
                         * then raffle's `WinnerPicked`, then this will trigger the listener above
                         */
                        const txnResponse = await mock.fulfillRandomWords(requestId, raffleAddress);
                        const txnReceipt = await txnResponse.wait(1);
                        const { fee } = txnReceipt;
                        txnFee = fee;
                    });
                });
            });
        });
    });
}
