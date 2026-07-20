// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { CCNEscrow } from "../src/CCNEscrow.sol";

interface Vm {
    function envAddress(string calldata name) external view returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployCCNEscrow {
    uint256 private constant ARC_TESTNET_CHAIN_ID = 5_042_002;
    address private constant VM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));
    Vm private constant vm = Vm(VM_ADDRESS);

    error WrongChain(uint256 actualChainId);

    function run() external returns (CCNEscrow escrow) {
        if (block.chainid != ARC_TESTNET_CHAIN_ID) {
            revert WrongChain(block.chainid);
        }

        address usdc = vm.envAddress("ARC_TESTNET_USDC");
        address treasury = vm.envAddress("CCN_TREASURY_ADDRESS");
        address admin = vm.envAddress("CCN_ADMIN_ADDRESS");
        address resolver = vm.envAddress("CCN_RESOLVER_ADDRESS");
        address pauser = vm.envAddress("CCN_PAUSER_ADDRESS");

        vm.startBroadcast();
        escrow = new CCNEscrow(usdc, treasury, admin, resolver, pauser);
        vm.stopBroadcast();
    }
}
