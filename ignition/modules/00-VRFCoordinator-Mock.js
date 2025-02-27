const { buildModule } = require("@nomicfoundation/hardhat-ignition");
const { chainIds, networkConfig, devChains } = require("../../helper-hardhat-config");
const {vrfCoordinatorMockParams} = require("../../raffle-params")

module.exports = buildModule("VRFCoordinatorMockModule", (m) => {
    const network = process.env.NETWORK || "hardhat";
    if (devChains.includes(network)) {
        console.log("Deploying mock contracts");
        
        const baseFee = vrfCoordinatorMockParams.baseFee;
        const gasPrice = vrfCoordinatorMockParams.gasPrice;
        const weiPerUnitLink = vrfCoordinatorMockParams.weiPerUnitLink;

        const vrfCoordinatorV2_5Mock = m.contract("VRFCoordinatorV2_5Mock", [baseFee, gasPrice, weiPerUnitLink]);
        return { vrfCoordinatorV2_5Mock };
    }else{
        console.log("Skipped Mock");
    }
});