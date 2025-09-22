// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title DEX_TSWP
 * @dev Automated Market Maker (AMM) for tTRUST and TSWP tokens
 * @notice Uses constant product formula (x * y = k) for price discovery
 */
contract DEX_TSWP is ERC20, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Constants
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant FEE_RATE = 30; // 0.3% trading fee
    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    // State variables
    IERC20 public immutable tTRUST;
    IERC20 public immutable TSWP;

    uint256 public tTrustReserve;
    uint256 public tswpReserve;
    uint256 public totalVolume;
    uint256 public totalTrades;
    uint256 public kLast;

    // Events
    event Swap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );
    event LiquidityAdded(
        address indexed provider,
        uint256 tTrustAmount,
        uint256 tswpAmount,
        uint256 liquidity
    );
    event LiquidityRemoved(
        address indexed provider,
        uint256 tTrustAmount,
        uint256 tswpAmount,
        uint256 liquidity
    );

    /**
     * @dev Constructor
     * @param _tTrust Address of tTRUST token (use 0x0 for native token)
     * @param _tswp Address of TSWP token
     */
    constructor(address _tTrust, address _tswp)
        ERC20("TSWP-TRUST LP", "TLP")
        Ownable(msg.sender)
    {
        require(_tswp != address(0), "Invalid TSWP token address");
        tTRUST = IERC20(_tTrust);
        TSWP = IERC20(_tswp);
    }

    /**
     * @dev Add liquidity to the pool
     * @param _tTrustAmount Amount of tTRUST tokens to add (use 0 when sending ETH)
     * @param _tswpAmount Amount of TSWP tokens to add
     * @return liquidity LP tokens minted
     */
    function addLiquidity(
        uint256 _tTrustAmount,
        uint256 _tswpAmount
    ) external payable nonReentrant whenNotPaused returns (uint256 liquidity) {
        uint256 tTrustAmountActual;

        // Handle native TTRUST
        if (address(tTRUST) == address(0)) {
            require(msg.value > 0, "Must send TTRUST as native token");
            require(_tswpAmount > 0, "TSWP amount must be greater than 0");
            tTrustAmountActual = msg.value;
            TSWP.safeTransferFrom(msg.sender, address(this), _tswpAmount);
        } else {
            require(_tTrustAmount > 0 && _tswpAmount > 0, "Amounts must be greater than 0");
            tTrustAmountActual = _tTrustAmount;
            tTRUST.safeTransferFrom(msg.sender, address(this), _tTrustAmount);
            TSWP.safeTransferFrom(msg.sender, address(this), _tswpAmount);
        }

        uint256 _totalSupply = totalSupply();

        if (_totalSupply == 0) {
            liquidity = sqrt(tTrustAmountActual * _tswpAmount) - MINIMUM_LIQUIDITY;
            _mint(address(1), MINIMUM_LIQUIDITY);
        } else {
            liquidity = min(
                (tTrustAmountActual * _totalSupply) / tTrustReserve,
                (_tswpAmount * _totalSupply) / tswpReserve
            );
        }

        require(liquidity > 0, "Insufficient liquidity minted");

        _mint(msg.sender, liquidity);

        tTrustReserve = tTrustReserve + tTrustAmountActual;
        tswpReserve = tswpReserve + _tswpAmount;
        kLast = tTrustReserve * tswpReserve;

        emit LiquidityAdded(msg.sender, tTrustAmountActual, _tswpAmount, liquidity);
    }

    /**
     * @dev Remove liquidity from the pool
     * @param _liquidity Amount of LP tokens to burn
     * @param _minTTrust Minimum tTRUST to receive
     * @param _minTswp Minimum TSWP to receive
     */
    function removeLiquidity(
        uint256 _liquidity,
        uint256 _minTTrust,
        uint256 _minTswp
    ) external nonReentrant returns (uint256 tTrustAmount, uint256 tswpAmount) {
        require(_liquidity > 0, "Insufficient liquidity");
        require(balanceOf(msg.sender) >= _liquidity, "Insufficient LP tokens");

        uint256 _totalSupply = totalSupply();

        tTrustAmount = (_liquidity * tTrustReserve) / _totalSupply;
        tswpAmount = (_liquidity * tswpReserve) / _totalSupply;

        require(tTrustAmount >= _minTTrust && tswpAmount >= _minTswp, "Insufficient output");
        require(tTrustAmount <= tTrustReserve && tswpAmount <= tswpReserve, "Insufficient reserves");

        _burn(msg.sender, _liquidity);

        tTrustReserve = tTrustReserve - tTrustAmount;
        tswpReserve = tswpReserve - tswpAmount;

        if (address(tTRUST) == address(0)) {
            (bool success, ) = payable(msg.sender).call{value: tTrustAmount}("");
            require(success, "TTRUST transfer failed");
        } else {
            tTRUST.safeTransfer(msg.sender, tTrustAmount);
        }
        TSWP.safeTransfer(msg.sender, tswpAmount);

        kLast = tTrustReserve * tswpReserve;

        emit LiquidityRemoved(msg.sender, tTrustAmount, tswpAmount, _liquidity);
    }

    /**
     * @dev Swap tTRUST for TSWP
     * @param _amountIn Amount of tTRUST to swap
     * @param _minAmountOut Minimum amount of TSWP to receive
     */
    function swapTrustForTswp(uint256 _amountIn, uint256 _minAmountOut)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        uint256 amountInActual;

        if (address(tTRUST) == address(0)) {
            require(msg.value > 0, "Must send TTRUST as native token");
            amountInActual = msg.value;
        } else {
            require(_amountIn > 0, "Amount must be greater than 0");
            amountInActual = _amountIn;
            tTRUST.safeTransferFrom(msg.sender, address(this), amountInActual);
        }

        require(tTrustReserve > 0 && tswpReserve > 0, "Insufficient liquidity");

        uint256 amountInWithFee = amountInActual * (BASIS_POINTS - FEE_RATE);
        uint256 numerator = amountInWithFee * tswpReserve;
        uint256 denominator = (tTrustReserve * BASIS_POINTS) + amountInWithFee;
        uint256 amountOut = numerator / denominator;

        require(amountOut >= _minAmountOut, "Insufficient output amount");
        require(amountOut < tswpReserve, "Insufficient TSWP liquidity");

        TSWP.safeTransfer(msg.sender, amountOut);

        tTrustReserve = tTrustReserve + amountInActual;
        tswpReserve = tswpReserve - amountOut;

        totalVolume = totalVolume + amountInActual;
        totalTrades = totalTrades + 1;

        require(tTrustReserve * tswpReserve >= kLast, "K invariant violation");
        kLast = tTrustReserve * tswpReserve;

        emit Swap(msg.sender, address(tTRUST), address(TSWP), amountInActual, amountOut, amountInActual * FEE_RATE / BASIS_POINTS);
    }

    /**
     * @dev Swap TSWP for tTRUST
     * @param _amountIn Amount of TSWP to swap
     * @param _minAmountOut Minimum amount of tTRUST to receive
     */
    function swapTswpForTrust(uint256 _amountIn, uint256 _minAmountOut)
        external
        nonReentrant
        whenNotPaused
    {
        require(_amountIn > 0, "Amount must be greater than 0");
        require(tTrustReserve > 0 && tswpReserve > 0, "Insufficient liquidity");

        TSWP.safeTransferFrom(msg.sender, address(this), _amountIn);

        uint256 amountInWithFee = _amountIn * (BASIS_POINTS - FEE_RATE);
        uint256 numerator = amountInWithFee * tTrustReserve;
        uint256 denominator = (tswpReserve * BASIS_POINTS) + amountInWithFee;
        uint256 amountOut = numerator / denominator;

        require(amountOut >= _minAmountOut, "Insufficient output amount");
        require(amountOut < tTrustReserve, "Insufficient tTRUST liquidity");

        if (address(tTRUST) == address(0)) {
            (bool success, ) = payable(msg.sender).call{value: amountOut}("");
            require(success, "TTRUST transfer failed");
        } else {
            tTRUST.safeTransfer(msg.sender, amountOut);
        }

        tswpReserve = tswpReserve + _amountIn;
        tTrustReserve = tTrustReserve - amountOut;

        totalVolume = totalVolume + (_amountIn * tTrustReserve / tswpReserve);
        totalTrades = totalTrades + 1;

        require(tTrustReserve * tswpReserve >= kLast, "K invariant violation");
        kLast = tTrustReserve * tswpReserve;

        emit Swap(msg.sender, address(TSWP), address(tTRUST), _amountIn, amountOut, _amountIn * FEE_RATE / BASIS_POINTS);
    }

    /**
     * @dev Get swap quote for exact input
     * @param _tokenIn Input token address
     * @param _amountIn Input amount
     * @return amountOut Output amount after fees
     */
    function getAmountOut(address _tokenIn, uint256 _amountIn)
        public
        view
        returns (uint256 amountOut)
    {
        require(_tokenIn == address(tTRUST) || _tokenIn == address(TSWP), "Invalid token");
        require(_amountIn > 0, "Amount must be greater than 0");
        require(tTrustReserve > 0 && tswpReserve > 0, "Insufficient liquidity");

        uint256 amountInWithFee = _amountIn * (BASIS_POINTS - FEE_RATE);

        if (_tokenIn == address(tTRUST)) {
            uint256 numerator = amountInWithFee * tswpReserve;
            uint256 denominator = (tTrustReserve * BASIS_POINTS) + amountInWithFee;
            amountOut = numerator / denominator;
        } else {
            uint256 numerator = amountInWithFee * tTrustReserve;
            uint256 denominator = (tswpReserve * BASIS_POINTS) + amountInWithFee;
            amountOut = numerator / denominator;
        }
    }

    /**
     * @dev Get current price of token in terms of the other token
     * @param _token Token to get price for
     * @return price Price in 18 decimal places
     */
    function getPrice(address _token) external view returns (uint256 price) {
        require(_token == address(tTRUST) || _token == address(TSWP), "Invalid token");
        require(tTrustReserve > 0 && tswpReserve > 0, "No liquidity");

        if (_token == address(tTRUST)) {
            price = (tswpReserve * 1e18) / tTrustReserve;
        } else {
            price = (tTrustReserve * 1e18) / tswpReserve;
        }
    }

    /**
     * @dev Get DEX statistics
     */
    function getDEXStats() external view returns (
        uint256 _tTrustReserve,
        uint256 _tswpReserve,
        uint256 _totalVolume,
        uint256 _totalTrades,
        uint256 _totalLiquidity
    ) {
        return (tTrustReserve, tswpReserve, totalVolume, totalTrades, totalSupply());
    }

    // Admin functions
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(owner(), _amount);
    }

    // Helper functions
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    receive() external payable {}
}