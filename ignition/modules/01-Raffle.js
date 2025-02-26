const { buildModule } = require("@nomicfoundation/hardhat-ignition");
const { raffleParams, vrfConsumerParams } = require("../../raffle-params");
const { chainIds, networkConfig, devChains } = require("../../helper-hardhat-config");

module.exports = buildModule("Raffle#Raffle", (m) => {
    const network = process.env.NETWORK || "hardhat";
    const localFlag = devChains.includes(network);
    let contract_raffle;

    switch (localFlag) {
        case true:
            // TODO: Local mock
            // const mockModule = m.contract("Mock", [mockParams]);
            raffleModule = m.contract(
                "Raffle",
                [raffleParams.entranceFee],
                /* {
                    after: [mockModule]
                }, */
            );
            return { contract_raffle /**, mock*/ };

        default:
            const chainId = chainIds[network];
            const mockAddress = networkConfig[chainId].vrfCoordinator;

            const vrfParams = vrfConsumerParams[network];
            

            raffleModule = m.contract("Raffle", [raffleParams.entranceFee, mockAddress], {
                verify: true,
            });
            return { contract_raffle };
    }
});
