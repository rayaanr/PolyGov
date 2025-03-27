// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract DemoContract {
    uint256 public value;
    address public lastCaller;

    event ValueUpdated(uint256 newValue, address caller);

    function updateValue(uint256 newValue) external {
        value = newValue;
        lastCaller = msg.sender;
        emit ValueUpdated(newValue, msg.sender);
    }
}
