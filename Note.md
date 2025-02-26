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
- VRF(For this part, I am using tutorial as a general guide, main steps following official doc)
    - Base steps
        1. Create subscription
        2. Implement consumer contract(which will use the subscription)
            - Follow docs, to link to the sub, need the sub's id, can get it at the page
        3. Deploy the consumer
        4. Authorize the consumer in the subscription using consumer's deployed address
    - Specific
        - `produceWinner`
            - Request random number -> Use the number to produce winner
            - Two transaction process, to prevent exploit(HOW?)
                1. Request
                2. Get random number
    - Challenges
        - Deploying with inheritance
    - Implementing
        - Referring to new doc, see code comments for more detailed info
        - For referencing, see [VRFD20](https://docs.chain.link/vrf/v2-5/getting-started#overview)
            - In the example contract, it is designed to store the rolled values, thus all the `s_roller`, `s_results`, which at the moment I think I don't need, but "rolling a dice" is a way to describe the process, we tell the DM to roll the dice, and wait for a result, then we get the result and do sth with it
    - Automation
        - [Automation app](https://automation.chain.link/)
        - Contracts needs to be automation compatible -> `import { AutomationCompatibleInterface } from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";`
