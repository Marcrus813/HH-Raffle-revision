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
            - Functions: `checkUpKeep` and `performUpKeep`
- Deployment
    - [ ] Problems
        - [x] Overflow problems
            - Initially I used `0.01 * 10 ** 18` to represent 0.01 ETH, but it will cause overflow problem, thus used `10_000_000_000_000_000n`
        - [x] Failing to get `subId` with ignition, solved using reading event instead of direct function call, details below
    - Resolve dependencies: `VRFConsumerBaseV2Plus, AutomationCompatibleInterface`
        > Deploying a contract with inheritance using hardhat ignition, to my understanding, the inherited constructor will also need parameter, like in Raffle.sol, the >vrfCoordinator variable which will be past in as a parameter, so in my ignition script I can just code it like usual, regardless of inheritance, am I correct? >If I am, I am also thinking will there be a scenario where a separate param is needed, like the inherited contract is of my own
    - `vrfParams` for mock contract: [Ref](https://docs.chain.link/vrf/v2-5/subscription/test-locally)
        - Preparing
            1. Call `createSubscription` -> `subscriptionId`
            2. Call `fundSubscription` with `subscriptionId`, `_amount = 100000000000000000000` -> Fund sub with 100 LINK
            3. Deploy consumer contract, then add consumer to mock using `addConsumer`
            4. Request random, get `requestId`
            5. Because on local net, I need to fulfill it myself with `requestId`
        - Getting & using params with hardhat ignition
            - Starting the same, deploy the mock contract with corresponding params, then call `createSubscription` then `fundSubscription`
                - Ignition calling functions([docs](https://hardhat.org/ignition/docs/guides/creating-modules))
                    - After test, I used `const vrf_subId = m.call(contract_vrfMock, "createSubscription", []).value;`, to get the actual value, which is `0`, should be correct, but when deploying getting
                        ```shell
                        [ RaffleModule ] failed ⛔
                        Futures failed during execution:
                        - RaffleModule#VRFCoordinatorV2_5Mock.fundSubscription: Simulating the transaction failed with error: Reverted with custom error InvalidSubscription()
                        ```
            - Try use event to get subId
                - Got it working: `const subId = m.readEventArgument(createSub_future, "SubscriptionCreated", "subId");`, `createSub_future` being the function call future object, then the event name, then the event index to read
- Testing
    - Test cases
        - Unit
            - Deployment
                1. Deploy success -> Valid addresses
                2. VRF parameters correct -> Based on ignition modules
                3. Raffle params correct -> Based on param config
            - Setup
                1. Subscription created -> Can get a valid `subId`
                2. `Raffle` registered as consumer by `VRF`
                3. Subscription is funded
            - Function
                - Initial states
                    1. `raffleState` -> OPEN (When reading with code, it returns index)
                    2. `s_lastTimestamp` -> Equals to when deployed
                        - There is slight delay between deployment and contract calls, so when testing this we should introduce tolerance, for local network 2(2 blocks' compute time), for real chain, around 30(2 blocks' compute time)
                - Interactions
                    - Enter raffle
                        1. Revert if not enough ETH
                        ~~2. Revert if raffle not OPEN~~
                            - Should I test this here or when testing VRF, testing here will require getting state to `CALCULATING`, since the later part hasn't been tested yet, should make sense to test this as `Should block entering when calculating` later
                        2. Record players
                        3. Emit event `RaffleEnter`([Waffle docs](https://ethereum-waffle.readthedocs.io/en/latest/matchers.html))
                            - Chai matcher has a way to check events:
                                ```javascript
                                const [, player] = availableAccounts;
                                await expect(raffle.connect(player).enterRaffle({ value: entranceFee }))
                                    .to.emit(raffle, "RaffleEnter")
                                    .withArgs(player.address);
                                ```
                            - Brings me to thinking, how to use ethers to get event?
                                - `txnReceipt.logs`
                                    - There is info and indexed params stored, but I think it will be difficult to use if there's multiple events during a transaction
                                        - Solution: use filters
                        4. Prevents entering when calculating
                            - Key point: simulate `performUpkeep` -> Need `checkUpkeep` true -> `interval` check to be true
                                - Time-traveling
                                    - Hardhat-network: `evm_increaseTime` -> `evm_mine`(need to mine for sth to happen after time increased)
                                - Passing empty calldata to contract: use `0x`, not `[]`
                    - Upkeep check
                        - Test the cases, since my contract has only one way of receiving eth: `enterRaffle`, this should be straight forward
                        - Using `callstatic` to avoid transaction, just to simulate a call
                        - Getting return results from function: `const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");`, this is a feature provided by ethers.js
                    - Performing upkeep
                        - Getting error params
                            - With chai matchers, same as `event`, use `.withArgs`:
                                ```javascript
                                it("Should not perform if upkeep not needed", async () => {
                                    await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(
                                        raffle,
                                        "Raffle__UpkeepNotNeeded",
                                    ).withArgs(0, 0, 0);
                                });
                                ```
                            - With ethers:
                                - When using ethers, we would almost always need abi, we get the abi from artifact, use it to decode results, in this case of error:
                                    ```javascript
                                    const fs = require("fs");
                                    const path = require("path");

                                    // With ethers
                                    const artifact = JSON.parse(
                                        fs.readFileSync(
                                            path.join(
                                                __dirname,
                                                "../../artifacts/contracts/Raffle.sol/Raffle.json",
                                            ),
                                            "utf8",
                                        ),
                                    );
                                    const abi = artifact.abi;
                                    const interface = new ethers.Interface(abi);
                                    try {
                                        await raffle.performUpkeep("0x");
                                    } catch (error) {
                                        const decoded = interface.parseError(error.data);
                                        /* decoded: {
                                            args: [] // array of error args
                                            fragment: ErrorFragment {type: 'error', inputs: Array(3), name: 'Raffle__UpkeepNotNeeded', Symbol(_ethers_internal): '_ErrorInternal'}
                                            name: 'Raffle__UpkeepNotNeeded'
                                            selector: '0x584327aa'
                                            signature: 'Raffle__UpkeepNotNeeded(uint256,uint256,uint256)'
                                        } */
                                        expect(decoded.args[0]).to.equals(0);
                                    }
                                    ```
                        - Retrieving event args(AGAIN)
                            - With chai matchers:
                                - `expect.to.emit(contract, "eventName").withArgs(value0, value1)`
                            - With ethers, we are using the similar logic of [solidity itself](https://docs.ethers.org/v5/concepts/events/), use filter to filter out logs to get the specific logs we want
                                - Event filters in ethersjs
                                    - `contract.filters.EVENT_NAME( ...args ) ⇒ Filter`
                                    - `contract.queryFilter( event [ , fromBlockOrBlockHash [ , toBlock ] ) ⇒ Promise< Array< Event > >`, we are using `filter` object as param, then we get the `EventLog` we want:
                                        ```JSON
                                        {
                                            address: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
                                            args: [] // value of the args
                                            blockHash
                                            blockNumber
                                            data
                                            eventName: "randomWinnerRequested"
                                            eventSignature: "randomWinnerRequested(uint256)"
                                            ...
                                        }
                                        ```
                    - Fulfilling randomness
                        - Logic
                            - The mock's `fulfillRandomWords` get called(by automation), then the mock calls our `fulfillRandomWords`
                        - Notes
                            - We are testing with a fair amount of variables where it should revert, but if the ranges are massive. we cannot do this manually, we need fuzz testing
                                - See code, basically a for loop
                        - Simulate the wait
                            - We can use `evm_increaseTime` to skip time, when testing we need to setup listener to test if it works as expected
                            - Using `Promise` like in Web, see code for more details