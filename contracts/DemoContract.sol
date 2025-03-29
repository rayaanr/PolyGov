// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title SimpleCounter
 * @dev A simple contract to simulate governance execution
 */
contract SimpleCounter {
    uint256 public number;
    address public lastUpdater;

    event NumberUpdated(uint256 newValue, address updater);

    // @notice An example function that updates the number and emits an event 
    function updateNumber(uint256 newValue) external {
        number = newValue;
        lastUpdater = msg.sender;
        emit NumberUpdated(newValue, msg.sender);
    }
}
