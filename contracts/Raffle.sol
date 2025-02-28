//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

error Raffle__RaffleNotOpen();
error Raffle__NotEnoughEthEntered();
error Raffle__UpkeepNotNeeded(uint256 contractBalance, uint256 playerNum, uint256 raffleState);
error Raffle__TransferFailed();

contract Raffle is VRFConsumerBaseV2Plus, AutomationCompatibleInterface {
    enum RaffleState {
        // To keep track of the state when bool is not enough, this is similar to mapping: 0->OPEN, 1->CALCULATING
        OPEN,
        CALCULATING
    }

    // Consumer params
    uint256 private immutable i_subscriptionId;
    address private immutable i_vrfCoordinator;
    bytes32 private immutable i_keyHash;
    uint32 private immutable i_callbackGasLimit;
    uint16 private immutable i_requestConfirmations;
    uint32 private immutable i_numWords;

    uint256 private immutable i_entranceFee;
    uint256 private immutable i_interval;
    RaffleState private s_state; // RaffleState.OPEN; Enum usage, or RaffleState(0) to set the state to OPEN
    uint256 private s_lastTimeStamp;
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
        uint256 entranceFee,
        uint256 interval
    ) VRFConsumerBaseV2Plus(vrfCoordinator) {
        i_subscriptionId = subscriptionId;
        i_vrfCoordinator = vrfCoordinator;
        i_keyHash = keyHash;
        i_callbackGasLimit = callbackGasLimit;
        i_requestConfirmations = requestConfirmations;
        i_numWords = numWords;

        i_entranceFee = entranceFee;
        i_interval = interval;
        s_state = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
    }

    modifier enoughEntranceFee() {
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughEthEntered();
        }
        _;
    }

    modifier raffleOpen() {
        if (s_state != RaffleState.OPEN) {
            revert Raffle__RaffleNotOpen();
        }
        _;
    }

    function enterRaffle() public payable raffleOpen enoughEntranceFee {
        s_players.push(payable(msg.sender)); // Type cast as payable address
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev Gets called by chainlink keeper, initial idea was to call this in `performUpkeep`,
     * but there's nothing to really do, we migrate the entire function to `performUpkeep`
     */
    /* function requestRandomWinner() external onlyOwner returns (uint256 requestId) {
        s_state = RaffleState.CALCULATING;

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
    } */

    function fulfillRandomWords(
        uint256, // requestId, why don't we need it?
        uint256[] calldata randomWords
    ) internal override {
        uint256 requestedResult = randomWords[0];
        uint256 winnerIndex = requestedResult % s_players.length;
        address payable recentWinner = s_players[winnerIndex];
        s_winners.push(recentWinner);
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Raffle__TransferFailed();
        }
        emit RaffleWinner(recentWinner);
        s_state = RaffleState.OPEN;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;
    }

    /**
     * @dev Define how we want the upkeep to be performed
     * @return upkeepNeeded
     * @return performData
     */
    function checkUpkeep(
        bytes memory /* checkData */ // In the interface, `checkData` it is defined as calldata, but we can and will use memory cuz we need to call this function in `performUpkeep`
    ) public view override returns (bool upkeepNeeded, bytes memory /* performData */) {
        bool isOpen = s_state == RaffleState.OPEN;
        bool hasPlayers = s_players.length > 0;
        bool intervalCheck = (block.timestamp - s_lastTimeStamp) > i_interval;
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (isOpen && hasPlayers && intervalCheck && hasBalance);
        return (upkeepNeeded, "");
    }

    function performUpkeep(bytes calldata) external override {
        // Prevents calling without validation, if `checkData` is defined as `calldata` in `checkUpkeep`, we cannot call it with `""`
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (upkeepNeeded) {
            s_state = RaffleState.CALCULATING;
            uint256 requestId = s_vrfCoordinator.requestRandomWords( // `s_vrfCoordinator` is from `IVRFCoordinatorV2Plus`
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
        } else {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_state)
            ); // Add param to tell why this reverted
        }
    }

    function getVrfCoordinator() public view returns (address coordinatorAddress) {
        coordinatorAddress = i_vrfCoordinator;
    }

    function getEntranceFee() public view returns (uint256 entranceFee) {
        entranceFee = i_entranceFee;
    }

    function getInterval() public view returns (uint256 interval) {
        interval = i_interval;
    }

    function getRaffleState() public view returns (RaffleState raffleState) {
        raffleState = s_state;
    }

    function getLastTimeStamp() public view returns (uint256 lastTimeStamp) {
        lastTimeStamp = s_lastTimeStamp;
    }

    function getPlayer(uint256 index) public view returns (address winner) {
        winner = s_players[index];
    }

    function getLatestWinner() public view returns (address latestWinner) {
        latestWinner = s_winners[s_winners.length - 1];
    }

    function getNumWords() public view returns (uint32 numWords) {
        numWords = i_numWords;
    }

    function getRequestConfirmations() public view returns (uint32 requiredConfirmations) {
        requiredConfirmations = i_requestConfirmations;
    }
}
