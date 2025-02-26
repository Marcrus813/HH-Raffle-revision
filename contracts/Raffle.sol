//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import { AutomationCompatibleInterface } from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

error Raffle__NotEnoughEthEntered();
error Raffle__TransferFailed();

contract Raffle is VRFConsumerBaseV2Plus {
    // Consumer params
    uint256 private immutable i_subscriptionId;
    address private immutable i_vrfCoordinator;
    bytes32 private immutable i_keyHash;
    uint32 private immutable i_callbackGasLimit;
    uint16 private immutable i_requestConfirmations;
    uint32 private immutable i_numWords;

    uint256 private immutable i_entranceFee;
    address payable[] private s_players; // We need to pay the winner, thus payable
    address[] private s_winners;

    event randomWinnerRequested(uint256 indexed requestId);
    event randomWinnerFulfilled(uint256 indexed requestId, uint256[] indexed randomWords);

    event RaffleEnter(address indexed player);
    event RaffleWinner(address indexed winner);

    constructor(
        uint256 subscriptionId,
        address vrfCoordinator,
        bytes32 keyHash,
        uint32 callbackGasLimit,
        uint16 requestConfirmations,
        uint32 numWords,
        uint256 entranceFee
    ) VRFConsumerBaseV2Plus(vrfCoordinator) {
        i_subscriptionId = subscriptionId;
        i_vrfCoordinator = vrfCoordinator;
        i_keyHash = keyHash;
        i_callbackGasLimit = callbackGasLimit;
        i_requestConfirmations = requestConfirmations;
        i_numWords = numWords;
        i_entranceFee = entranceFee;
    }

    modifier enoughEntranceFee() {
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughEthEntered();
        }
        _;
    }

    function enterRaffle() public payable enoughEntranceFee {
        s_players.push(payable(msg.sender)); // Type cast as payable address
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev Gets called by chainlink keeper
     */
    function requestRandomWinner() external onlyOwner returns (uint256 requestId) {
        requestId = s_vrfCoordinator.requestRandomWords( // `s_vrfCoordinator` is from `IVRFCoordinatorV2Plus`
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: i_keyHash,
                subId: i_subscriptionId,
                requestConfirmations: i_requestConfirmations,
                callbackGasLimit: i_callbackGasLimit,
                numWords: i_numWords,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: true}) // `nativePayment` to use ETH to fund the sub instead of LINK
                )
            })
        );

        emit randomWinnerRequested(requestId);
    }

    function fulfillRandomWords(
        uint256, // requestId, why don't we need it?
        uint256[] calldata randomWords
    ) internal override {
        uint256 requestedResult = randomWords[0];
        uint256 winnerIndex = requestedResult % s_players.length;
        address payable recentWinner = s_players[winnerIndex];
        s_winners.push(recentWinner);
        (bool success,) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Raffle__TransferFailed();
        }
        emit RaffleWinner(recentWinner);
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getLatestWinner() public view returns(address latestWinner) {
        latestWinner = s_winners[s_winners.length - 1];
    }
}
