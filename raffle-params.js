const raffleParams = {
    entranceFee: 10_000_000_000_000_000n,
    interval: 30,
};

const vrfConsumerParams = {
    mainnet: {},
    sepolia: {
        /* subscriptionId:
            "17908282639935060267044030780446638496709540080399495333020002186672674822440", */
        subscriptionId:
            "104188919385686192654758012411929032654250521347364341409256294222260912368592",
        vrfCoordinatorAddress: "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B",
        keyHash: "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae", // 500 gwei limit key hash, a.k.a `gasLane`
        callbackGasLimit: 250000,
        requestConfirmations: 1,
        numWords: 1,
    },
};

const vrfCoordinatorMockParams = {
    baseFee: 1_00_000_000_000_000_000n,
    gasPrice: 1_000_000_000n,
    weiPerUnitLink: 6714531857965810n,
};

module.exports = {
    raffleParams,
    vrfConsumerParams,
    vrfCoordinatorMockParams
};
