const { ethers, ignition, network } = require("hardhat");

const raffleModule = require("../ignition/modules/01-Raffle");

let currentNetwork = process.env.NETWORK || "hardhat";
const { devChains } = require("../helper-hardhat-config");
if (currentNetwork === "localhost") {
    currentNetwork = "hardhat";
}
const localFlag = devChains.includes(currentNetwork);

async function main() {
    if (localFlag) {
        const { contract_raffle: raffle, contract_vrfMock: vrfMock } =
            await ignition.deploy(raffleModule);
        const raffleAddress = await raffle.getAddress();
        const checkData = ethers.keccak256(ethers.toUtf8Bytes(""));

        const raffleState = await raffle.getRaffleState();
        console.log(`Raffle state: ${raffleState}`);
        const playerNum = await raffle.getPlayerNumber();
        console.log(`Number of players: ${playerNum}`);
        const contractBalance = await ethers.provider.getBalance(raffleAddress);
        console.log(`Contract balance: ${ethers.formatEther(contractBalance)}`);
        const interval = await raffle.getInterval();
        console.log(`Interval target: ${interval}`);
        await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
        await network.provider.send("evm_mine", []);
        const recentTimestamp = await raffle.getLastTimeStamp();

        console.log(`Last win timestamp: ${recentTimestamp}`);
        const currentTimestamp = BigInt((await ethers.provider.getBlock("latest")).timestamp);
        console.log(`Current timestamp: ${currentTimestamp}`);

        const actualInterval = currentTimestamp - recentTimestamp;
        console.log(`Actual interval: ${actualInterval}`);

        const { upkeepNeeded } = await raffle.checkUpkeep(checkData);
        console.log(`Upkeep needed: ${upkeepNeeded}`);

        if (upkeepNeeded) {
            const txn = await raffle.performUpkeep("0x");
            const txnReceipt = await txn.wait(1);
            const { blockNumber } = txnReceipt;

            const randomRequestEventsFilter = raffle.filters.randomWinnerRequested();
            const randomRequestEvents = await raffle.queryFilter(
                randomRequestEventsFilter,
                blockNumber,
            );
            const requestId = randomRequestEvents[0].args.requestId;

            console.log(`Upkeep performed with requestId: ${requestId}`);
            await vrfMock.fulfillRandomWords(requestId, raffleAddress);
        }
        const recentWinner = await raffle.getLatestWinner();
        console.log(`Recent winner: ${recentWinner}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
