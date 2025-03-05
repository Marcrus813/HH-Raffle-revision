const { ethers, ignition } = require("hardhat");
const raffleModule = require("../ignition/modules/01-Raffle");
const { chainIds, devChains, networkConfig } = require("../helper-hardhat-config");

const currentNetwork = process.env.NETWORK || "hardhat";
const localFlag = devChains.includes(currentNetwork);

const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.split("=");
    acc[key] = value;
    return acc;
}, {});

async function main() {
    if (!localFlag) {
        let raffle;
        let raffleAddress;
        let availableAccounts;
        let initialTimestamp;
        let entranceFee;
        let initialBalanceMap = new Map();

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

        const [owner] = availableAccounts;
        const enterTxnResponse = await raffle.connect(owner).enterRaffle({ value: entranceFee });
        const enterTxnReceipt = await enterTxnResponse.wait(5);
        try {
            const fulfillTxnResponse = await raffle.performUpkeep("0x");
            const fulfillTxnReceipt = await fulfillTxnResponse.wait(5);
            console.log("Upkeep performed!");
        } catch (error) {
            console.error("Error performing upkeep:", error);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
