const raffleParams = {
    entranceFee: 10_000_000_000_000_000n,
    interval: 30,
};

const vrfConsumerParams = {
    mainnet: {},
    sepolia: {
        // Work version: address: 0x530F1667Ce9A221F34863Ef8B480A9A4Ae5a74Ed
        subscriptionId:
            "73695224490739830815926182485269773582526809004350983370830623188378858758081",
        // Home version: address:
        /* subscriptionId:
            "104188919385686192654758012411929032654250521347364341409256294222260912368592", */
        vrfCoordinatorAddress: "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B",
        keyHash: "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae", // 500 gwei limit key hash, a.k.a `gasLane`
        callbackGasLimit: 500000,
        requestConfirmations: 3,
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
