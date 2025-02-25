//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

error Raffle__NotEnoughEthEntered();

contract Raffle {
    uint256 private immutable i_entranceFee;
    address payable[] private s_players; // We need to pay the winner, thus payable

    event RaffleEnter(address indexed player);

    constructor(uint256 entranceFee) {
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

    function produceWinner() public returns (address) {
        
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }
}
