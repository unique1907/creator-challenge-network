// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    bool public failTransfers;
    bool public failTransferFrom;

    constructor() ERC20("Mock USDC", "USDC") { }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setFailTransfers(bool value) external {
        failTransfers = value;
    }

    function setFailTransferFrom(bool value) external {
        failTransferFrom = value;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (failTransfers) return false;
        return super.transfer(to, value);
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (failTransferFrom) return false;
        return super.transferFrom(from, to, value);
    }
}
