const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const {
    raffleParams,
    vrfConsumerParams,
    vrfCoordinatorMockParams,
} = require("../../raffle-params");
const { chainIds, networkConfig, devChains } = require("../../helper-hardhat-config");

module.exports = buildModule("RaffleModule", (m) => {
    const network = process.env.NETWORK || "hardhat";
    const localFlag = devChains.includes(network);
    let contract_raffle;
    let contract_vrfMock;

    switch (localFlag) {
        case true:
            const mockParams = [
                vrfCoordinatorMockParams.baseFee,
                vrfCoordinatorMockParams.gasPrice,
                vrfCoordinatorMockParams.weiPerUnitLink,
            ];
            contract_vrfMock = m.contract("VRFCoordinatorV2_5Mock", mockParams); // Deploy the mock for further actions
            const vrf_subId = m.call(contract_vrfMock, "createSubscription", []).value; // See note
            m.call(contract_vrfMock, "fundSubscription", [vrf_subId, 100000000000000000000n /* value to fund */]);
            const vrf_keyHash =
                "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae"; // Just a random bytes32
            const vrf_callbackGasLimit = 40000;
            const vrf_requestConfirmations = 1;
            const vrf_numWords = 1;
            raffleModule = m.contract(
                "Raffle",
                [
                    vrf_subId,
                    contract_vrfMock,
                    vrf_keyHash,
                    vrf_callbackGasLimit,
                    vrf_requestConfirmations,
                    vrf_numWords,
                    raffleParams.entranceFee,
                    raffleParams.interval,
                ],
                {
                    after: [contract_vrfMock],
                },
            );
            return { contract_raffle, contract_vrfMock };

        default:
            const vrfParams = vrfConsumerParams[network];

            raffleModule = m.contract(
                "Raffle",
                [
                    vrfParams.subscriptionId,
                    vrfParams.vrfCoordinatorAddress,
                    vrfParams.keyHash,
                    vrfParams.callbackGasLimit,
                    vrfParams.requestConfirmations,
                    vrfParams.numWords,
                    raffleParams.entranceFee,
                    raffleParams.interval,
                ],
                {
                    verify: true,
                },
            );
            return { contract_raffle };
    }
});
