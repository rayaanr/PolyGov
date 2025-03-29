// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract SimpleCounter {
    uint256 public number;
    address public lastUpdater;

    event NumberUpdated(uint256 newValue, address updater);

    function updateNumber(uint256 newValue) external {
        number = newValue;
        lastUpdater = msg.sender;
        emit NumberUpdated(newValue, msg.sender);
    }
}
