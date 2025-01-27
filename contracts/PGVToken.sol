// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract PGVToken {
    string public name = "PolyGov Token";
    string public symbol = "PGV";
    uint8 public decimals = 18;
    uint256 public constant TOTAL_SUPPLY = 10_000 * 10 ** 18;

    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor() {
        balanceOf[msg.sender] = TOTAL_SUPPLY;
    }

    function totalSupply() public pure returns (uint256) {
        return TOTAL_SUPPLY;
    }

    function transfer(address to, uint256 value) public returns (bool) {
        require(balanceOf[msg.sender] >= value, "Insufficient balance");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }
}
