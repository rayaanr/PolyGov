// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

/**
 * @title PGVToken
 * @dev ERC20 token with governance and timestamp-based voting consistency across chains.
 */
contract PGVToken is ERC20, ERC20Permit, ERC20Votes {
    uint256 public constant MAX_SUPPLY = 10000 * 10 ** 18; // 10,000 tokens

    // Custom error for clock inconsistency
    error ERC6372InconsistentClock();

    constructor() ERC20("PolyGov Token", "PGV") ERC20Permit(name()) {
        _mint(msg.sender, MAX_SUPPLY);
    }

    // The following functions are overrides required by Solidity.
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);

        // Automatically delegate votes to the recipient if the recipient is not a contract (i.e., a wallet).
        if (delegates(to) == address(0) && to.code.length == 0) {
            _delegate(to, to);
        }
    }

    // clock() & CLOCK_MODE() needs to be modified like this according to https://github.com/OpenZeppelin/openzeppelin-contracts/blob/fda6b85f2c65d146b86d513a604554d15abd6679/contracts/governance/utils/Votes.sol#L54-L57

    // Override clock on snapshot from block number to block timestamp which is necessary for MultiChain proposal support
    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=blocktimestamp&from=default";
    }

    function nonces(
        address owner
    ) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
