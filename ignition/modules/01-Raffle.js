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
            const createSub_future = m.call(contract_vrfMock, "createSubscription", [], {
                after: [contract_vrfMock],
            }); // See note
            const subId = m.readEventArgument(createSub_future, "SubscriptionCreated", "subId");
            const fundSub_future = m.call(
                contract_vrfMock,
                "fundSubscription",
                [subId, 100000000000000000000n /* value to fund */],
                {
                    after: [contract_vrfMock, createSub_future],
                },
            );
            const vrf_keyHash =
                "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae"; // Just a random bytes32
            const vrf_callbackGasLimit = 500000;
            const vrf_requestConfirmations = 1;
            const vrf_numWords = 1;
            contract_raffle = m.contract(
                "Raffle",
                [
                    subId,
                    contract_vrfMock,
                    vrf_keyHash,
                    vrf_callbackGasLimit,
                    vrf_requestConfirmations,
                    vrf_numWords,
                    raffleParams.entranceFee,
                    raffleParams.interval,
                ],
                {
                    after: [contract_vrfMock, createSub_future, fundSub_future],
                },
            );

            m.call(
                contract_vrfMock,
                "addConsumer",
                [subId, contract_raffle],
                {
                    after: [contract_vrfMock, createSub_future, fundSub_future, contract_raffle],
                },
            );

            return { contract_raffle, contract_vrfMock };

        default:
            const vrfParams = vrfConsumerParams[network];

            contract_raffle = m.contract(
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
