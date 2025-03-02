const { expect } = require("chai");
const { ethers, ignition } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const raffleModule = require("../../ignition/modules/01-Raffle");
const { chainIds, devChains, networkConfig } = require("../../helper-hardhat-config");
const { raffleParams } = require("../../raffle-params");

const network = process.env.NETWORK || "hardhat";
const localFlag = devChains.includes(network);

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
        let winningInterval;

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
            winningInterval = await raffle.getInterval();
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
                expect(callbackGasLimit).to.equals(40000);
                expect(requestConfirmations).to.equals(1);
                expect(numWords).to.equals(1);
            });
            it("Should set correct Raffle params", async () => {
                const entranceFeeInput = raffleParams.entranceFee;
                const intervalInput = raffleParams.interval;
                expect(entranceFee).to.equals(entranceFeeInput);
                expect(winningInterval).to.equals(intervalInput);
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
                    const chainId = chainIds[network];
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
                    const filter = raffle.filters.RaffleEnter();
                    const event = await raffle.queryFilter(filter);
                    expect(event[0].args[0]).to.equals(rafflePlayer.address);
                });
            });
        });
    });
}
