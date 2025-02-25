# Raffle revision

## Solidity

### Planning

- What we want -> How -> What we need
    - Wants
        1. Player to enter
        2. Get winner by random number(verifiable randomness) and pay the player
        3. Fully automated
    - Needs
        - Off-chain data feed to get random number -> Chainlink oracle
        - Keepers to trigger contract for us

### Coding

- **SHOULD BE familiar with ETH Wei conversion rate: 1 ETH = 1000000000 GWEI = 1000000000000000000 WEI; 9 digits each level**
- [Official style guide](https://docs.soliditylang.org/en/latest/style-guide.html), layout:
    1. Type declarations
    2. State variables
    3. Events
    4. Errors
    5. Modifiers
    6. Functions

- Type casting: `payable(address)`
    - When contract needs to pay an account, use `address payable`
    - More examples [here](https://medium.com/coinmonks/learn-solidity-lesson-22-type-casting-656d164b9991)
- Events
    - EVM and log
        - When things happen, EVM emits logs, events allow contact to output log to the logging data structure, this structure is inaccessible to contracts -> Cheap to log(no changing state variables)
    - Event code first look
        ```solidity
        event storedNumber(
            uint256 indexed oldNum,
            uint256 indexed newNum,
            uint256 addedNum,
            address sender
        );
        ```
        - `indexed`
            - An event can have up to 3, these are called topics, they are easier to search and query
        - Emitting event
            ```solidity
            emit storedNumber(
                oldNumber,
                newNumber,
                oldNumber + newNumber,
                msg.sender
            );
            ```
