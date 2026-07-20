// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { CCNEscrow } from "../src/CCNEscrow.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";

interface InvariantVm {
    function warp(uint256 timestamp) external;
    function prank(address caller) external;
    function startPrank(address caller) external;
    function stopPrank() external;
    function expectRevert() external;
}

contract CCNEscrowHandler {
    InvariantVm private constant vm =
        InvariantVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockUSDC public immutable usdc;
    CCNEscrow public immutable escrow;

    address public constant SPONSOR = address(0x5150);
    address public constant RESOLVER = address(0xB0B);
    address public constant ATTACKER = address(0xBAD);
    address public constant WINNER1 = address(0x701);
    address public constant WINNER2 = address(0x702);
    address public constant WINNER3 = address(0x703);

    uint256 public constant ONE_USDC = 1_000_000;
    bytes32[8] public challengeIds;

    mapping(bytes32 challengeId => bool) public wasPaid;
    mapping(bytes32 challengeId => bool) public wasRefunded;
    mapping(bytes32 challengeId => bool) public wasFunded;
    mapping(bytes32 challengeId => uint256) public feeTransfers;
    mapping(bytes32 challengeId => uint256) public sponsorRefunds;
    mapping(bytes32 challengeId => uint256) public initialPrizePool;
    mapping(bytes32 challengeId => bytes32) public dataHashAfterFunding;

    constructor(MockUSDC usdc_, CCNEscrow escrow_) {
        usdc = usdc_;
        escrow = escrow_;
        for (uint256 i; i < challengeIds.length; ++i) {
            challengeIds[i] = keccak256(abi.encode("ccn-invariant", i));
        }
    }

    function fund(uint8 index, uint96 first, uint96 second, uint96 third, uint96 fee) external {
        bytes32 challengeId = challengeIds[index % uint8(challengeIds.length)];
        if (_status(challengeId) != CCNEscrow.EscrowStatus.NONE) return;

        uint256 firstAmount = _bound(uint256(first), ONE_USDC, 1_000 * ONE_USDC);
        uint256 feeAmount = _bound(uint256(fee), 0, 100 * ONE_USDC);
        uint256[] memory amounts;
        if (index % 2 == 0) {
            amounts = new uint256[](1);
            amounts[0] = firstAmount;
        } else {
            amounts = new uint256[](3);
            amounts[0] = firstAmount;
            amounts[1] = _bound(uint256(second), ONE_USDC, 1_000 * ONE_USDC);
            amounts[2] = _bound(uint256(third), ONE_USDC, 1_000 * ONE_USDC);
        }

        uint256 required;
        for (uint256 i; i < amounts.length; ++i) {
            required += amounts[i];
        }
        required += feeAmount;

        usdc.mint(SPONSOR, required);
        vm.startPrank(SPONSOR);
        usdc.approve(address(escrow), required);
        escrow.fundChallenge(challengeId, amounts, feeAmount, uint64(block.timestamp + 1), 9_000);
        vm.stopPrank();

        wasFunded[challengeId] = true;
        initialPrizePool[challengeId] = required - feeAmount;
        dataHashAfterFunding[challengeId] = _challengeDataHash(challengeId);
    }

    function pay(uint8 index) external {
        bytes32 challengeId = challengeIds[index % uint8(challengeIds.length)];
        if (_status(challengeId) != CCNEscrow.EscrowStatus.FUNDED) return;

        (,,,,, uint8 winnerCount,) = escrow.getChallenge(challengeId);
        address[] memory winners = winnerCount == 1 ? _winners1() : _winners3();
        uint256 treasuryBefore = usdc.balanceOf(escrow.treasury());
        vm.warp(9_000);
        vm.prank(RESOLVER);
        escrow.releasePayout(challengeId, winners);

        wasPaid[challengeId] = true;
        if (usdc.balanceOf(escrow.treasury()) > treasuryBefore) {
            feeTransfers[challengeId] += 1;
        }
    }

    function refund(uint8 index) external {
        bytes32 challengeId = challengeIds[index % uint8(challengeIds.length)];
        if (_status(challengeId) != CCNEscrow.EscrowStatus.FUNDED) return;

        uint256 sponsorBefore = usdc.balanceOf(SPONSOR);
        vm.prank(RESOLVER);
        escrow.cancelAndRefund(challengeId);

        wasRefunded[challengeId] = true;
        if (usdc.balanceOf(SPONSOR) > sponsorBefore) {
            sponsorRefunds[challengeId] += 1;
        }
    }

    function unauthorizedAttempts(uint8 index) external {
        bytes32 challengeId = challengeIds[index % uint8(challengeIds.length)];
        uint256 prizeBefore = escrow.totalLockedPrizePools();
        uint256 feeBefore = escrow.totalLockedPlatformFees();

        vm.prank(ATTACKER);
        vm.expectRevert();
        escrow.cancelAndRefund(challengeId);
        vm.prank(ATTACKER);
        vm.expectRevert();
        escrow.releasePayout(challengeId, _winners1());

        require(escrow.totalLockedPrizePools() == prizeBefore, "unauthorized prize drift");
        require(escrow.totalLockedPlatformFees() == feeBefore, "unauthorized fee drift");
    }

    function challengeCount() external pure returns (uint256) {
        return 8;
    }

    function challengeIdAt(uint256 index) external view returns (bytes32) {
        return challengeIds[index];
    }

    function prizeDistributionSum(bytes32 challengeId) external view returns (uint256 sum) {
        uint256[] memory amounts = escrow.getPrizeDistribution(challengeId);
        for (uint256 i; i < amounts.length; ++i) {
            sum += amounts[i];
        }
    }

    function dataHash(bytes32 challengeId) external view returns (bytes32) {
        return _challengeDataHash(challengeId);
    }

    function _challengeDataHash(bytes32 challengeId) private view returns (bytes32) {
        (
            address sponsor,
            uint256 prizePool,
            uint256 platformFee,
            uint64 submissionDeadline,
            uint64 reviewDeadline,
            uint8 winnerCount,
            CCNEscrow.EscrowStatus status
        ) = escrow.getChallenge(challengeId);
        uint256[] memory amounts = escrow.getPrizeDistribution(challengeId);
        return keccak256(
            abi.encode(
                sponsor,
                prizePool,
                platformFee,
                submissionDeadline,
                reviewDeadline,
                winnerCount,
                status,
                amounts
            )
        );
    }

    function _status(bytes32 challengeId) private view returns (CCNEscrow.EscrowStatus status) {
        (,,,,,, status) = escrow.getChallenge(challengeId);
    }

    function _winners1() private pure returns (address[] memory winners) {
        winners = new address[](1);
        winners[0] = WINNER1;
    }

    function _winners3() private pure returns (address[] memory winners) {
        winners = new address[](3);
        winners[0] = WINNER1;
        winners[1] = WINNER2;
        winners[2] = WINNER3;
    }

    function _bound(uint256 value, uint256 min, uint256 max) private pure returns (uint256) {
        return min + (value % (max - min + 1));
    }
}

contract CCNEscrowInvariantTest {
    InvariantVm private constant vm =
        InvariantVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockUSDC private usdc;
    CCNEscrow private escrow;
    CCNEscrowHandler private handler;

    address private constant ADMIN = address(0xA11CE);
    address private constant RESOLVER = address(0xB0B);
    address private constant PAUSER = address(0xCAFE);
    address private constant TREASURY = address(0xFEE);
    address private constant ATTACKER = address(0xBAD);

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new CCNEscrow(address(usdc), TREASURY, ADMIN, RESOLVER, PAUSER);
        handler = new CCNEscrowHandler(usdc, escrow);
        vm.warp(1_000);
    }

    function fund(uint8 index, uint96 first, uint96 second, uint96 third, uint96 fee) external {
        handler.fund(index, first, second, third, fee);
    }

    function pay(uint8 index) external {
        handler.pay(index);
    }

    function refund(uint8 index) external {
        handler.refund(index);
    }

    function unauthorizedAttempts(uint8 index) external {
        handler.unauthorizedAttempts(index);
    }

    function targetContracts() external view returns (address[] memory targets) {
        targets = new address[](1);
        targets[0] = address(handler);
    }

    function invariantContractBalanceCoversLockedLiabilities() public view {
        assertGe(
            usdc.balanceOf(address(escrow)),
            escrow.totalLockedPrizePools() + escrow.totalLockedPlatformFees(),
            "liabilities undercollateralized"
        );
    }

    function invariantChallengeNeverBothPaidAndRefunded() public view {
        for (uint256 i; i < handler.challengeCount(); ++i) {
            bytes32 challengeId = handler.challengeIdAt(i);
            assertFalse(
                handler.wasPaid(challengeId) && handler.wasRefunded(challengeId),
                "paid and refunded"
            );
        }
    }

    function invariantTerminalChallengeNeverReturnsToFunded() public view {
        for (uint256 i; i < handler.challengeCount(); ++i) {
            bytes32 challengeId = handler.challengeIdAt(i);
            (,,,,,, CCNEscrow.EscrowStatus status) = escrow.getChallenge(challengeId);
            if (handler.wasPaid(challengeId) || handler.wasRefunded(challengeId)) {
                assertTrue(status != CCNEscrow.EscrowStatus.FUNDED, "terminal returned funded");
            }
        }
    }

    function invariantPayoutTotalsEqualStoredPrizePoolForFundedChallenges() public view {
        for (uint256 i; i < handler.challengeCount(); ++i) {
            bytes32 challengeId = handler.challengeIdAt(i);
            (,, uint256 platformFee,,, uint8 winnerCount, CCNEscrow.EscrowStatus status) =
                escrow.getChallenge(challengeId);
            if (status == CCNEscrow.EscrowStatus.FUNDED) {
                uint256[] memory amounts = escrow.getPrizeDistribution(challengeId);
                assertEq(amounts.length, winnerCount, "winner count mismatch");
                assertEq(handler.prizeDistributionSum(challengeId), _prizePool(challengeId), "sum");
                platformFee;
            }
        }
    }

    function invariantPlatformFeeTransferredAtMostOnce() public view {
        for (uint256 i; i < handler.challengeCount(); ++i) {
            assertLe(handler.feeTransfers(handler.challengeIdAt(i)), 1, "fee transferred twice");
        }
    }

    function invariantSponsorRefundHappensAtMostOnce() public view {
        for (uint256 i; i < handler.challengeCount(); ++i) {
            assertLe(handler.sponsorRefunds(handler.challengeIdAt(i)), 1, "refund twice");
        }
    }

    function invariantOperationsOnOneChallengeDoNotMutateAnotherEscrowData() public view {
        for (uint256 i; i < handler.challengeCount(); ++i) {
            bytes32 challengeId = handler.challengeIdAt(i);
            if (
                handler.wasFunded(challengeId) && !handler.wasPaid(challengeId)
                    && !handler.wasRefunded(challengeId)
            ) {
                assertEq(
                    handler.dataHash(challengeId),
                    handler.dataHashAfterFunding(challengeId),
                    "funded challenge data drift"
                );
            }
        }
    }

    function invariantNoUnauthorizedRoleCanReduceContractLiabilities() public view {
        assertFalse(escrow.hasRole(escrow.RESOLVER_ROLE(), ATTACKER), "attacker");
        assertGe(
            usdc.balanceOf(address(escrow)),
            escrow.getTotalLockedLiabilities(),
            "unauthorized liability reduction"
        );
    }

    function _prizePool(bytes32 challengeId) private view returns (uint256 prizePool) {
        (, prizePool,,,,,) = escrow.getChallenge(challengeId);
    }

    function assertTrue(bool condition, string memory message) private pure {
        if (!condition) revert(message);
    }

    function assertFalse(bool condition, string memory message) private pure {
        if (condition) revert(message);
    }

    function assertEq(uint256 actual, uint256 expected, string memory message) private pure {
        if (actual != expected) revert(message);
    }

    function assertEq(bytes32 actual, bytes32 expected, string memory message) private pure {
        if (actual != expected) revert(message);
    }

    function assertGe(uint256 actual, uint256 expected, string memory message) private pure {
        if (actual < expected) revert(message);
    }

    function assertLe(uint256 actual, uint256 expected, string memory message) private pure {
        if (actual > expected) revert(message);
    }
}
