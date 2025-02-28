const { expect } = require("chai");
const { ethers, ignition } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const raffleModule = require("../../ignition/modules/01-Raffle");
const { devChains } = require("../../helper-hardhat-config");

const network = process.env.NETWORK || "hardhat";
const localFlag = devChains.includes(network);

!localFlag
    ? describe.skip
    : describe("Raffle", () => {
          let raffle;
          let raffleAddress;
          let mock;
          let mockAddress;

          async function deployFixture() {
              const { contract_raffle, contract_vrfMock } = await ignition.deploy(raffleModule);
              raffleAddress = await contract_raffle.getAddress();
              mockAddress = await contract_vrfMock.getAddress();
              return { contract_raffle, contract_vrfMock };
          }

          beforeEach(async () => {
              const deployments = await loadFixture(deployFixture);
              raffle = deployments.contract_raffle;
              mock = deployments.contract_vrfMock;
          });

          describe("Deployment", () => {
              it("Should deploy the contract with valid addresses", async () => {
                  expect(raffleAddress).to.be.properAddress;
                  expect(mockAddress).to.be.properAddress;
              });
              it("Should have the correct VRF address", async () => {
                  const vrfCoordinatorAdrs = await raffle.getVrfCoordinator();
                  expect(vrfCoordinatorAdrs).to.equals(mockAddress);
              });
          });
      });
