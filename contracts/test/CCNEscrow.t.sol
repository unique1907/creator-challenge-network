// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { CCNEscrow } from "../src/CCNEscrow.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";

interface Vm {
    function warp(uint256 timestamp) external;
    function prank(address caller) external;
    function startPrank(address caller) external;
    function stopPrank() external;
    function expectRevert() external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata revertData) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData)
        external;
}

contract CCNEscrowTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockUSDC private usdc;
    CCNEscrow private escrow;

    address private constant ADMIN = address(0xA11CE);
    address private constant RESOLVER = address(0xB0B);
    address private constant PAUSER = address(0xCAFE);
    address private constant TREASURY = address(0xFEE);
    address private constant SPONSOR = address(0x51);
    address private constant ATTACKER = address(0xBAD);
    address private constant WINNER1 = address(0x101);
    address private constant WINNER2 = address(0x102);
    address private constant WINNER3 = address(0x103);

    bytes32 private constant CHALLENGE_ID = keccak256("challenge-1");
    uint256 private constant ONE_USDC = 1_000_000;

    event ChallengeFunded(
        bytes32 indexed challengeId,
        address indexed sponsor,
        uint256 prizePool,
        uint256 platformFee,
        uint8 winnerCount,
        uint64 submissionDeadline,
        uint64 reviewDeadline
    );
    event WinnersPaid(
        bytes32 indexed challengeId,
        address[] winners,
        uint256[] amounts,
        uint256 platformFee,
        address indexed treasury
    );
    event ChallengeRefunded(
        bytes32 indexed challengeId, address indexed sponsor, uint256 totalRefunded
    );

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new CCNEscrow(address(usdc), TREASURY, ADMIN, RESOLVER, PAUSER);
        usdc.mint(SPONSOR, 1_000_000 * ONE_USDC);
        vm.prank(SPONSOR);
        usdc.approve(address(escrow), type(uint256).max);
        vm.warp(1_000);
    }

    function testConstructorRejectsZeroUsdc() public {
        vm.expectRevert(CCNEscrow.ZeroAddress.selector);
        new CCNEscrow(address(0), TREASURY, ADMIN, RESOLVER, PAUSER);
    }

    function testConstructorRejectsZeroTreasury() public {
        vm.expectRevert(CCNEscrow.ZeroAddress.selector);
        new CCNEscrow(address(usdc), address(0), ADMIN, RESOLVER, PAUSER);
    }

    function testConstructorRejectsZeroAdmin() public {
        vm.expectRevert(CCNEscrow.ZeroAddress.selector);
        new CCNEscrow(address(usdc), TREASURY, address(0), RESOLVER, PAUSER);
    }

    function testConstructorRejectsZeroResolver() public {
        vm.expectRevert(CCNEscrow.ZeroAddress.selector);
        new CCNEscrow(address(usdc), TREASURY, ADMIN, address(0), PAUSER);
    }

    function testConstructorRejectsZeroPauser() public {
        vm.expectRevert(CCNEscrow.ZeroAddress.selector);
        new CCNEscrow(address(usdc), TREASURY, ADMIN, RESOLVER, address(0));
    }

    function testConstructorAssignsRolesAndImmutables() public view {
        assertTrue(escrow.hasRole(escrow.DEFAULT_ADMIN_ROLE(), ADMIN), "admin role");
        assertTrue(escrow.hasRole(escrow.RESOLVER_ROLE(), RESOLVER), "resolver role");
        assertTrue(escrow.hasRole(escrow.PAUSER_ROLE(), PAUSER), "pauser role");
        assertEq(address(escrow.usdc()), address(usdc), "usdc");
        assertEq(escrow.treasury(), TREASURY, "treasury");
    }

    function testPauserCannotPayout() public {
        _fundTop1(CHALLENGE_ID, 10 * ONE_USDC, ONE_USDC);
        vm.warp(3_001);
        address[] memory winners = _winners1();
        bytes32 resolverRole = escrow.RESOLVER_ROLE();
        vm.prank(PAUSER);
        vm.expectRevert(_accessDenied(PAUSER, resolverRole));
        escrow.releasePayout(CHALLENGE_ID, winners);
    }

    function testResolverCannotPauseUnlessGranted() public {
        bytes32 pauserRole = escrow.PAUSER_ROLE();
        vm.prank(RESOLVER);
        vm.expectRevert(_accessDenied(RESOLVER, pauserRole));
        escrow.pause();
    }

    function testSponsorCannotPayout() public {
        _fundTop1(CHALLENGE_ID, 10 * ONE_USDC, ONE_USDC);
        vm.warp(3_001);
        bytes32 resolverRole = escrow.RESOLVER_ROLE();
        vm.prank(SPONSOR);
        vm.expectRevert(_accessDenied(SPONSOR, resolverRole));
        escrow.releasePayout(CHALLENGE_ID, _winners1());
    }

    function testArbitraryAddressCannotRefund() public {
        _fundTop1(CHALLENGE_ID, 10 * ONE_USDC, ONE_USDC);
        bytes32 resolverRole = escrow.RESOLVER_ROLE();
        vm.prank(ATTACKER);
        vm.expectRevert(_accessDenied(ATTACKER, resolverRole));
        escrow.cancelAndRefund(CHALLENGE_ID);
    }

    function testNoArbitraryWithdrawalSelectorExists() public view {
        assertFalse(_hasSelector("withdraw(address,uint256)"), "withdraw exists");
        assertFalse(_hasSelector("sweep(address,uint256)"), "sweep exists");
        assertFalse(_hasSelector("emergencyWithdraw(address,uint256)"), "emergency exists");
    }

    function testSuccessfulTop1FundingStoresExactDataAndEvent() public {
        uint256[] memory amounts = _amounts1(50 * ONE_USDC);
        uint64 submissionDeadline = 2_000;
        uint64 reviewDeadline = 3_000;

        vm.expectEmit(true, true, false, true);
        emit ChallengeFunded(
            CHALLENGE_ID,
            SPONSOR,
            50 * ONE_USDC,
            2 * ONE_USDC,
            1,
            submissionDeadline,
            reviewDeadline
        );
        vm.prank(SPONSOR);
        escrow.fundChallenge(
            CHALLENGE_ID, amounts, 2 * ONE_USDC, submissionDeadline, reviewDeadline
        );

        assertEq(usdc.balanceOf(address(escrow)), 52 * ONE_USDC, "escrow balance");
        _assertChallenge(CHALLENGE_ID, 50 * ONE_USDC, 2 * ONE_USDC, 1, 2_000, 3_000);
        assertEq(escrow.totalLockedPrizePools(), 50 * ONE_USDC, "locked prizes");
        assertEq(escrow.totalLockedPlatformFees(), 2 * ONE_USDC, "locked fees");
        assertTrue(escrow.isFunded(CHALLENGE_ID), "funded");
    }

    function testSuccessfulTop3FundingStoresDistribution() public {
        uint256[] memory amounts = _amounts3(30 * ONE_USDC, 15 * ONE_USDC, 5 * ONE_USDC);
        vm.prank(SPONSOR);
        escrow.fundChallenge(CHALLENGE_ID, amounts, ONE_USDC, 2_000, 3_000);

        uint256[] memory stored = escrow.getPrizeDistribution(CHALLENGE_ID);
        assertEq(stored.length, 3, "length");
        assertEq(stored[0], 30 * ONE_USDC, "first");
        assertEq(stored[1], 15 * ONE_USDC, "second");
        assertEq(stored[2], 5 * ONE_USDC, "third");
        _assertChallenge(CHALLENGE_ID, 50 * ONE_USDC, ONE_USDC, 3, 2_000, 3_000);
    }

    function testZeroChallengeIdRejected() public {
        vm.prank(SPONSOR);
        vm.expectRevert(CCNEscrow.ZeroChallengeId.selector);
        escrow.fundChallenge(bytes32(0), _amounts1(ONE_USDC), 0, 2_000, 3_000);
    }

    function testDuplicateChallengeIdRejected() public {
        _fundTop1(CHALLENGE_ID, ONE_USDC, 0);
        vm.prank(SPONSOR);
        vm.expectRevert(CCNEscrow.ChallengeAlreadyExists.selector);
        escrow.fundChallenge(CHALLENGE_ID, _amounts1(ONE_USDC), 0, 2_000, 3_000);
    }

    function testWinnerCountZeroTwoAndGreaterThanThreeRejected() public {
        vm.startPrank(SPONSOR);
        vm.expectRevert(CCNEscrow.InvalidWinnerCount.selector);
        escrow.fundChallenge(keccak256("zero"), new uint256[](0), 0, 2_000, 3_000);
        vm.expectRevert(CCNEscrow.InvalidWinnerCount.selector);
        escrow.fundChallenge(keccak256("two"), _amounts2(), 0, 2_000, 3_000);
        vm.expectRevert(CCNEscrow.InvalidWinnerCount.selector);
        escrow.fundChallenge(keccak256("four"), _amounts4(), 0, 2_000, 3_000);
        vm.stopPrank();
    }

    function testZeroPrizeRejected() public {
        vm.prank(SPONSOR);
        vm.expectRevert(CCNEscrow.InvalidPrizeAmount.selector);
        escrow.fundChallenge(CHALLENGE_ID, _amounts1(0), 0, 2_000, 3_000);
    }

    function testDeadlineValidation() public {
        vm.startPrank(SPONSOR);
        vm.expectRevert(CCNEscrow.InvalidSubmissionDeadline.selector);
        escrow.fundChallenge(keccak256("past"), _amounts1(ONE_USDC), 0, 999, 3_000);
        vm.expectRevert(CCNEscrow.InvalidReviewDeadline.selector);
        escrow.fundChallenge(keccak256("equal"), _amounts1(ONE_USDC), 0, 2_000, 2_000);
        vm.expectRevert(CCNEscrow.InvalidReviewDeadline.selector);
        escrow.fundChallenge(keccak256("earlier"), _amounts1(ONE_USDC), 0, 2_000, 1_999);
        vm.stopPrank();
    }

    function testInsufficientAllowanceAndBalanceRejected() public {
        address poorSponsor = address(0x600D);
        usdc.mint(poorSponsor, ONE_USDC);
        vm.prank(poorSponsor);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector, address(escrow), 0, ONE_USDC
            )
        );
        escrow.fundChallenge(keccak256("allowance"), _amounts1(ONE_USDC), 0, 2_000, 3_000);

        vm.prank(poorSponsor);
        usdc.approve(address(escrow), 100 * ONE_USDC);
        vm.prank(poorSponsor);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector, poorSponsor, ONE_USDC, 10 * ONE_USDC
            )
        );
        escrow.fundChallenge(keccak256("balance"), _amounts1(10 * ONE_USDC), 0, 2_000, 3_000);
    }

    function testFundingWhilePausedRejected() public {
        vm.prank(PAUSER);
        escrow.pause();
        vm.prank(SPONSOR);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.fundChallenge(CHALLENGE_ID, _amounts1(ONE_USDC), 0, 2_000, 3_000);
    }

    function testPlatformFeeZeroAcceptedAndNonZeroTransferredIntoEscrow() public {
        _fundTop1(keccak256("zero-fee"), 10 * ONE_USDC, 0);
        assertEq(escrow.totalLockedPlatformFees(), 0, "zero fee");
        _fundTop1(keccak256("fee"), 10 * ONE_USDC, 3 * ONE_USDC);
        assertEq(escrow.totalLockedPlatformFees(), 3 * ONE_USDC, "nonzero fee");
        assertEq(usdc.balanceOf(address(escrow)), 23 * ONE_USDC, "escrow balance");
    }

    function testSuccessfulTop1Payout() public {
        _fundTop1(CHALLENGE_ID, 10 * ONE_USDC, ONE_USDC);
        vm.warp(3_000);

        vm.expectEmit(true, false, true, true);
        emit WinnersPaid(CHALLENGE_ID, _winners1(), _amounts1(10 * ONE_USDC), ONE_USDC, TREASURY);
        vm.prank(RESOLVER);
        escrow.releasePayout(CHALLENGE_ID, _winners1());

        assertEq(usdc.balanceOf(WINNER1), 10 * ONE_USDC, "winner");
        assertEq(usdc.balanceOf(TREASURY), ONE_USDC, "treasury");
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow balance");
        assertEq(escrow.totalLockedPrizePools(), 0, "locked prizes");
        assertEq(escrow.totalLockedPlatformFees(), 0, "locked fees");
        assertFalse(escrow.isFunded(CHALLENGE_ID), "terminal not funded");
    }

    function testSuccessfulAtomicTop3Payout() public {
        _fundTop3(CHALLENGE_ID);
        vm.warp(3_001);
        vm.prank(RESOLVER);
        escrow.releasePayout(CHALLENGE_ID, _winners3());

        assertEq(usdc.balanceOf(WINNER1), 30 * ONE_USDC, "first");
        assertEq(usdc.balanceOf(WINNER2), 15 * ONE_USDC, "second");
        assertEq(usdc.balanceOf(WINNER3), 5 * ONE_USDC, "third");
        assertEq(usdc.balanceOf(TREASURY), ONE_USDC, "fee");
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow empty");
    }

    function testPayoutValidationFailures() public {
        _fundTop1(CHALLENGE_ID, 10 * ONE_USDC, ONE_USDC);

        vm.prank(RESOLVER);
        vm.expectRevert(CCNEscrow.ReviewPeriodNotEnded.selector);
        escrow.releasePayout(CHALLENGE_ID, _winners1());

        vm.warp(3_001);
        vm.prank(RESOLVER);
        vm.expectRevert(CCNEscrow.ChallengeNotFunded.selector);
        escrow.releasePayout(keccak256("missing"), _winners1());

        vm.prank(RESOLVER);
        vm.expectRevert(CCNEscrow.WinnerCountMismatch.selector);
        escrow.releasePayout(CHALLENGE_ID, _winners3());

        address[] memory zeroWinner = _winners1();
        zeroWinner[0] = address(0);
        vm.prank(RESOLVER);
        vm.expectRevert(CCNEscrow.InvalidWinnerAddress.selector);
        escrow.releasePayout(CHALLENGE_ID, zeroWinner);
    }

    function testDuplicateWinnerRejected() public {
        _fundTop3(CHALLENGE_ID);
        address[] memory winners = _winners3();
        winners[2] = winners[0];
        vm.warp(3_001);
        vm.prank(RESOLVER);
        vm.expectRevert(CCNEscrow.DuplicateWinner.selector);
        escrow.releasePayout(CHALLENGE_ID, winners);
    }

    function testDuplicatePayoutAndPayoutAfterRefundRejected() public {
        _fundTop1(CHALLENGE_ID, 10 * ONE_USDC, 0);
        vm.warp(3_001);
        vm.prank(RESOLVER);
        escrow.releasePayout(CHALLENGE_ID, _winners1());
        vm.prank(RESOLVER);
        vm.expectRevert(CCNEscrow.InvalidStatus.selector);
        escrow.releasePayout(CHALLENGE_ID, _winners1());

        bytes32 refundId = keccak256("refund-first");
        vm.warp(1_000);
        _fundTop1(refundId, 10 * ONE_USDC, 0);
        vm.prank(RESOLVER);
        escrow.cancelAndRefund(refundId);
        vm.prank(RESOLVER);
        vm.expectRevert(CCNEscrow.InvalidStatus.selector);
        escrow.releasePayout(refundId, _winners1());
    }

    function testPayoutWhilePausedRejected() public {
        _fundTop1(CHALLENGE_ID, 10 * ONE_USDC, 0);
        vm.warp(3_001);
        vm.prank(PAUSER);
        escrow.pause();
        vm.prank(RESOLVER);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.releasePayout(CHALLENGE_ID, _winners1());
    }

    function testResolverCannotAlterStoredPayoutAmounts() public {
        _fundTop1(CHALLENGE_ID, 10 * ONE_USDC, 0);
        vm.warp(3_001);
        vm.prank(RESOLVER);
        escrow.releasePayout(CHALLENGE_ID, _winners1());
        assertEq(usdc.balanceOf(WINNER1), 10 * ONE_USDC, "only stored amount paid");
    }

    function testTokenTransferFailureRevertsEntirePayoutAtomically() public {
        _fundTop3(CHALLENGE_ID);
        usdc.setFailTransfers(true);
        vm.warp(3_001);
        vm.prank(RESOLVER);
        vm.expectRevert(
            abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(usdc))
        );
        escrow.releasePayout(CHALLENGE_ID, _winners3());

        (,,,,,, CCNEscrow.EscrowStatus status) = escrow.getChallenge(CHALLENGE_ID);
        assertEq(uint256(status), uint256(CCNEscrow.EscrowStatus.FUNDED), "status reverted");
        assertEq(usdc.balanceOf(WINNER1), 0, "winner1");
        assertEq(usdc.balanceOf(TREASURY), 0, "treasury");
        assertEq(escrow.totalLockedPrizePools(), 50 * ONE_USDC, "locked prizes");
        assertEq(escrow.totalLockedPlatformFees(), ONE_USDC, "locked fees");
    }

    function testSuccessfulFullRefundIncludingPlatformFee() public {
        _fundTop1(CHALLENGE_ID, 10 * ONE_USDC, ONE_USDC);
        uint256 sponsorBefore = usdc.balanceOf(SPONSOR);

        vm.expectEmit(true, true, false, true);
        emit ChallengeRefunded(CHALLENGE_ID, SPONSOR, 11 * ONE_USDC);
        vm.prank(RESOLVER);
        escrow.cancelAndRefund(CHALLENGE_ID);

        assertEq(usdc.balanceOf(SPONSOR), sponsorBefore + 11 * ONE_USDC, "sponsor refund");
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow balance");
        assertEq(escrow.totalLockedPrizePools(), 0, "locked prizes");
        assertEq(escrow.totalLockedPlatformFees(), 0, "locked fees");
        assertFalse(escrow.isFunded(CHALLENGE_ID), "terminal");
    }

    function testRefundValidationFailures() public {
        vm.prank(RESOLVER);
        vm.expectRevert(CCNEscrow.ChallengeNotFunded.selector);
        escrow.cancelAndRefund(CHALLENGE_ID);

        _fundTop1(CHALLENGE_ID, 10 * ONE_USDC, 0);
        vm.prank(RESOLVER);
        escrow.cancelAndRefund(CHALLENGE_ID);
        vm.prank(RESOLVER);
        vm.expectRevert(CCNEscrow.InvalidStatus.selector);
        escrow.cancelAndRefund(CHALLENGE_ID);

        bytes32 paidId = keccak256("paid");
        _fundTop1(paidId, 10 * ONE_USDC, 0);
        vm.warp(3_001);
        vm.prank(RESOLVER);
        escrow.releasePayout(paidId, _winners1());
        vm.prank(RESOLVER);
        vm.expectRevert(CCNEscrow.InvalidStatus.selector);
        escrow.cancelAndRefund(paidId);
    }

    function testRefundWhilePausedRejected() public {
        _fundTop1(CHALLENGE_ID, 10 * ONE_USDC, 0);
        vm.prank(PAUSER);
        escrow.pause();
        vm.prank(RESOLVER);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.cancelAndRefund(CHALLENGE_ID);
    }

    function testReadFunctionsReturnSafeCopiesAndStatuses() public {
        _fundTop3(CHALLENGE_ID);
        uint256[] memory copy = escrow.getPrizeDistribution(CHALLENGE_ID);
        copy[0] = 1;
        uint256[] memory fresh = escrow.getPrizeDistribution(CHALLENGE_ID);
        assertEq(fresh[0], 30 * ONE_USDC, "safe copy");
        assertEq(escrow.getTotalLockedLiabilities(), 51 * ONE_USDC, "liabilities");

        vm.prank(RESOLVER);
        escrow.cancelAndRefund(CHALLENGE_ID);
        assertFalse(escrow.isFunded(CHALLENGE_ID), "refunded");
    }

    function testMultipleChallengesRemainIndependent() public {
        bytes32 first = keccak256("first");
        bytes32 second = keccak256("second");
        bytes32 third = keccak256("third");
        _fundTop1(first, 10 * ONE_USDC, ONE_USDC);
        _fundTop3(second);
        _fundTop1(third, 7 * ONE_USDC, 0);

        assertEq(escrow.totalLockedPrizePools(), 67 * ONE_USDC, "all prizes");
        assertEq(escrow.totalLockedPlatformFees(), 2 * ONE_USDC, "all fees");

        vm.warp(3_001);
        vm.prank(RESOLVER);
        escrow.releasePayout(first, _winners1());

        _assertChallenge(second, 50 * ONE_USDC, ONE_USDC, 3, 2_000, 3_000);
        vm.prank(RESOLVER);
        escrow.cancelAndRefund(third);

        assertEq(escrow.totalLockedPrizePools(), 50 * ONE_USDC, "remaining prizes");
        assertEq(escrow.totalLockedPlatformFees(), ONE_USDC, "remaining fees");
    }

    function _fundTop1(bytes32 challengeId, uint256 prize, uint256 fee) private {
        vm.prank(SPONSOR);
        escrow.fundChallenge(challengeId, _amounts1(prize), fee, 2_000, 3_000);
    }

    function _fundTop3(bytes32 challengeId) private {
        vm.prank(SPONSOR);
        escrow.fundChallenge(
            challengeId,
            _amounts3(30 * ONE_USDC, 15 * ONE_USDC, 5 * ONE_USDC),
            ONE_USDC,
            2_000,
            3_000
        );
    }

    function _assertChallenge(
        bytes32 challengeId,
        uint256 prizePool,
        uint256 platformFee,
        uint8 winnerCount,
        uint64 submissionDeadline,
        uint64 reviewDeadline
    ) private view {
        (
            address sponsor,
            uint256 storedPrizePool,
            uint256 storedPlatformFee,
            uint64 storedSubmissionDeadline,
            uint64 storedReviewDeadline,
            uint8 storedWinnerCount,
            CCNEscrow.EscrowStatus status
        ) = escrow.getChallenge(challengeId);

        assertEq(sponsor, SPONSOR, "sponsor");
        assertEq(storedPrizePool, prizePool, "prize pool");
        assertEq(storedPlatformFee, platformFee, "platform fee");
        assertEq(storedSubmissionDeadline, submissionDeadline, "submission deadline");
        assertEq(storedReviewDeadline, reviewDeadline, "review deadline");
        assertEq(storedWinnerCount, winnerCount, "winner count");
        assertEq(uint256(status), uint256(CCNEscrow.EscrowStatus.FUNDED), "status");
    }

    function _amounts1(uint256 first) private pure returns (uint256[] memory amounts) {
        amounts = new uint256[](1);
        amounts[0] = first;
    }

    function _amounts2() private pure returns (uint256[] memory amounts) {
        amounts = new uint256[](2);
        amounts[0] = 1;
        amounts[1] = 1;
    }

    function _amounts3(uint256 first, uint256 second, uint256 third)
        private
        pure
        returns (uint256[] memory amounts)
    {
        amounts = new uint256[](3);
        amounts[0] = first;
        amounts[1] = second;
        amounts[2] = third;
    }

    function _amounts4() private pure returns (uint256[] memory amounts) {
        amounts = new uint256[](4);
        amounts[0] = 1;
        amounts[1] = 1;
        amounts[2] = 1;
        amounts[3] = 1;
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

    function _accessDenied(address account, bytes32 role) private pure returns (bytes memory) {
        return abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector, account, role
        );
    }

    function _hasSelector(string memory signature) private pure returns (bool) {
        bytes4 selector = bytes4(keccak256(bytes(signature)));
        return selector == CCNEscrow.fundChallenge.selector
            || selector == CCNEscrow.releasePayout.selector
            || selector == CCNEscrow.cancelAndRefund.selector
            || selector == CCNEscrow.pause.selector || selector == CCNEscrow.unpause.selector
            || selector == CCNEscrow.getChallenge.selector
            || selector == CCNEscrow.getPrizeDistribution.selector
            || selector == CCNEscrow.isFunded.selector
            || selector == CCNEscrow.getTotalLockedLiabilities.selector;
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

    function assertEq(address actual, address expected, string memory message) private pure {
        if (actual != expected) revert(message);
    }
}
