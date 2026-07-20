// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CCNEscrow is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IERC20 public immutable usdc;
    address public immutable treasury;

    uint256 public totalLockedPrizePools;
    uint256 public totalLockedPlatformFees;

    enum EscrowStatus {
        NONE,
        FUNDED,
        CANCELLED,
        PAID,
        REFUNDED
    }

    struct ChallengeEscrow {
        address sponsor;
        uint256 prizePool;
        uint256 platformFee;
        uint64 submissionDeadline;
        uint64 reviewDeadline;
        uint8 winnerCount;
        EscrowStatus status;
    }

    mapping(bytes32 challengeId => ChallengeEscrow) private challenges;
    mapping(bytes32 challengeId => uint256[]) private prizeAmounts;

    error ZeroAddress();
    error ZeroChallengeId();
    error ChallengeAlreadyExists();
    error ChallengeNotFunded();
    error InvalidWinnerCount();
    error InvalidPrizeAmount();
    error InvalidSubmissionDeadline();
    error InvalidReviewDeadline();
    error InvalidWinnerAddress();
    error DuplicateWinner();
    error WinnerCountMismatch();
    error ReviewPeriodNotEnded();
    error InvalidStatus();
    error AccountingInvariantViolation();

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

    constructor(
        address usdc_,
        address treasury_,
        address admin_,
        address resolver_,
        address pauser_
    ) {
        if (
            usdc_ == address(0) || treasury_ == address(0) || admin_ == address(0)
                || resolver_ == address(0) || pauser_ == address(0)
        ) {
            revert ZeroAddress();
        }

        usdc = IERC20(usdc_);
        treasury = treasury_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(RESOLVER_ROLE, resolver_);
        _grantRole(PAUSER_ROLE, pauser_);
    }

    function fundChallenge(
        bytes32 challengeId,
        uint256[] calldata amounts,
        uint256 platformFee,
        uint64 submissionDeadline,
        uint64 reviewDeadline
    ) external nonReentrant whenNotPaused {
        if (challengeId == bytes32(0)) revert ZeroChallengeId();
        if (challenges[challengeId].status != EscrowStatus.NONE) revert ChallengeAlreadyExists();

        uint256 winnerCount = amounts.length;
        if (winnerCount != 1 && winnerCount != 3) revert InvalidWinnerCount();
        uint8 safeWinnerCount = winnerCount == 1 ? 1 : 3;

        uint256 prizePool;
        for (uint256 i; i < winnerCount; ++i) {
            uint256 amount = amounts[i];
            if (amount == 0) revert InvalidPrizeAmount();
            prizePool += amount;
        }

        if (submissionDeadline <= block.timestamp) revert InvalidSubmissionDeadline();
        if (reviewDeadline <= submissionDeadline) revert InvalidReviewDeadline();

        ChallengeEscrow storage escrow = challenges[challengeId];
        escrow.sponsor = msg.sender;
        escrow.prizePool = prizePool;
        escrow.platformFee = platformFee;
        escrow.submissionDeadline = submissionDeadline;
        escrow.reviewDeadline = reviewDeadline;
        escrow.winnerCount = safeWinnerCount;
        escrow.status = EscrowStatus.FUNDED;

        uint256[] storage storedAmounts = prizeAmounts[challengeId];
        for (uint256 i; i < winnerCount; ++i) {
            storedAmounts.push(amounts[i]);
        }

        totalLockedPrizePools += prizePool;
        totalLockedPlatformFees += platformFee;

        usdc.safeTransferFrom(msg.sender, address(this), prizePool + platformFee);
        _assertAccountingInvariant();

        emit ChallengeFunded(
            challengeId,
            msg.sender,
            prizePool,
            platformFee,
            safeWinnerCount,
            submissionDeadline,
            reviewDeadline
        );
    }

    function releasePayout(bytes32 challengeId, address[] calldata winners)
        external
        onlyRole(RESOLVER_ROLE)
        nonReentrant
        whenNotPaused
    {
        ChallengeEscrow storage escrow = challenges[challengeId];
        if (escrow.status == EscrowStatus.NONE) revert ChallengeNotFunded();
        if (escrow.status != EscrowStatus.FUNDED) revert InvalidStatus();
        if (block.timestamp < escrow.reviewDeadline) revert ReviewPeriodNotEnded();
        if (winners.length != escrow.winnerCount) revert WinnerCountMismatch();

        uint256[] storage storedAmounts = prizeAmounts[challengeId];
        if (storedAmounts.length != escrow.winnerCount) revert WinnerCountMismatch();
        _validateWinners(winners);

        escrow.status = EscrowStatus.PAID;
        totalLockedPrizePools -= escrow.prizePool;
        totalLockedPlatformFees -= escrow.platformFee;
        _assertAccountingInvariant();

        uint256[] memory paidAmounts = new uint256[](storedAmounts.length);
        for (uint256 i; i < storedAmounts.length; ++i) {
            uint256 amount = storedAmounts[i];
            paidAmounts[i] = amount;
            usdc.safeTransfer(winners[i], amount);
        }

        if (escrow.platformFee > 0) {
            usdc.safeTransfer(treasury, escrow.platformFee);
        }

        emit WinnersPaid(challengeId, winners, paidAmounts, escrow.platformFee, treasury);
    }

    /// @notice Resolver-authorized MVP refund.
    /// @dev The resolver must verify off-chain submission/dispute policy before calling refund.
    function cancelAndRefund(bytes32 challengeId)
        external
        onlyRole(RESOLVER_ROLE)
        nonReentrant
        whenNotPaused
    {
        ChallengeEscrow storage escrow = challenges[challengeId];
        if (escrow.status == EscrowStatus.NONE) revert ChallengeNotFunded();
        if (escrow.status != EscrowStatus.FUNDED) revert InvalidStatus();

        uint256 totalRefunded = escrow.prizePool + escrow.platformFee;
        address sponsor = escrow.sponsor;

        escrow.status = EscrowStatus.REFUNDED;
        totalLockedPrizePools -= escrow.prizePool;
        totalLockedPlatformFees -= escrow.platformFee;
        _assertAccountingInvariant();

        usdc.safeTransfer(sponsor, totalRefunded);

        emit ChallengeRefunded(challengeId, sponsor, totalRefunded);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function getChallenge(bytes32 challengeId)
        external
        view
        returns (
            address sponsor,
            uint256 prizePool,
            uint256 platformFee,
            uint64 submissionDeadline,
            uint64 reviewDeadline,
            uint8 winnerCount,
            EscrowStatus status
        )
    {
        ChallengeEscrow storage escrow = challenges[challengeId];
        return (
            escrow.sponsor,
            escrow.prizePool,
            escrow.platformFee,
            escrow.submissionDeadline,
            escrow.reviewDeadline,
            escrow.winnerCount,
            escrow.status
        );
    }

    function getPrizeDistribution(bytes32 challengeId) external view returns (uint256[] memory) {
        return prizeAmounts[challengeId];
    }

    function isFunded(bytes32 challengeId) external view returns (bool) {
        return challenges[challengeId].status == EscrowStatus.FUNDED;
    }

    function getTotalLockedLiabilities() external view returns (uint256) {
        return totalLockedPrizePools + totalLockedPlatformFees;
    }

    function _validateWinners(address[] calldata winners) private pure {
        for (uint256 i; i < winners.length; ++i) {
            if (winners[i] == address(0)) revert InvalidWinnerAddress();
            for (uint256 j = i + 1; j < winners.length; ++j) {
                if (winners[i] == winners[j]) revert DuplicateWinner();
            }
        }
    }

    function _assertAccountingInvariant() private view {
        if (usdc.balanceOf(address(this)) < totalLockedPrizePools + totalLockedPlatformFees) {
            revert AccountingInvariantViolation();
        }
    }
}
