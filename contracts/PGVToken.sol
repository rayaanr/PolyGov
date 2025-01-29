// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PGVToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 10000 * 10**18; // 10,000 PGV

    constructor() ERC20("PGV Governance Token", "PGV") Ownable(msg.sender) {
        _mint(msg.sender, MAX_SUPPLY);
    }
}
