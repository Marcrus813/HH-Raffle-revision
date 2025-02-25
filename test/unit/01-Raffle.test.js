const { expect } = require("chai");
const {ethers, ignition} = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const raffleModule = require("../../ignition/modules/01-Raffle");
const { devChains } = require("../../helper-hardhat-config");

const network = process.env.NETWORK || "hardhat";
const localFlag = devChains.includes(network);

!localFlag ? describe.skip : 
describe("Raffle", () => {
    let raffle;
    let raffleAddress;
    let mock;
    let mockAddress;

    async function deployFixture() {
        const { contract_raffle, contract_mock } = await ignition.deploy(raffleModule);
        raffleAddress = await contract_raffle.getAddress();
        mockAddress = await contract_mock.getAddress();
        return { contract_raffle, contract_mock };
    }

    beforeEach(async () => {
        const deployments = await loadFixture(deployFixture);
        raffle = deployments.contract_raffle;
        mock = deployments.contract_mock;
    });
});