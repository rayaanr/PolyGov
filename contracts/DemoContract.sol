// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title DemoContract
 * @dev A simple contract to demonstrate governance execution with a string value
 */
contract DemoContract {
    string public value;
    address public lastUpdater;

    event ValueUpdated(string newValue, address updater);  // Updated event to reflect string

    // @notice An example function that updates the value and emits an event 
    function updateValue(string calldata newValue) external {
        value = newValue;
        lastUpdater = msg.sender;
        emit ValueUpdated(newValue, msg.sender);  // Emit the updated value as a string
    }
}
