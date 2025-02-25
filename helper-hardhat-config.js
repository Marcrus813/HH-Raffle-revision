const chainIds = {
    hardhat: 31337,
    sepolia: 11155111,
    mainnet: 1
}

const networkConfig = {
    11155111: {
        name: "sepolia",
        ethUsePriceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
        vrfCoordinator: "",
    },
    1: {
        name: "mainnet",
        ethUsePriceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
        vrfCoordinator: "",
    },
    31337: {
        name: "hardhat",
        ethUsePriceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
        vrfCoordinator: "",
    }
}

const devChains = ["hardhat", "localhost"];

module.exports = {
    chainIds,
    networkConfig,
    devChains,
};