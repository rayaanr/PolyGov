// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PGVToken is ERC20, Ownable {
    // Fixed supply of 10,000 tokens (with 18 decimals)
    uint256 public constant TOTAL_SUPPLY = 10_000 * 10 ** 18;

    constructor() ERC20("PolyGov Token", "PGV") Ownable(msg.sender) {
        // Mint the total supply to the deployer
        _mint(msg.sender, TOTAL_SUPPLY);
    }
}