// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title DEX_INTUIT
 * @dev Automated Market Maker (AMM) for tTRUST and INTUIT tokens
 * @notice Uses constant product formula (x * y = k) for price discovery
 */
contract DEX_INTUIT is ERC20, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Constants
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant FEE_RATE = 30; // 0.3% trading fee
    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    // State variables
    IERC20 public immutable tTRUST;
    IERC20 public immutable INTUIT;

    uint256 public tTrustReserve;
    uint256 public intuitReserve;
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
        uint256 intuitAmount,
        uint256 liquidity
    );
    event LiquidityRemoved(
        address indexed provider,
        uint256 tTrustAmount,
        uint256 intuitAmount,
        uint256 liquidity
    );

    /**
     * @dev Constructor
     * @param _tTrust Address of tTRUST token (use 0x0 for native token)
     * @param _intuit Address of INTUIT token
     */
    constructor(address _tTrust, address _intuit)
        ERC20("INTUIT-TRUST LP", "ILP")
        Ownable(msg.sender)
    {
        require(_intuit != address(0), "Invalid INTUIT token address");
        tTRUST = IERC20(_tTrust);
        INTUIT = IERC20(_intuit);
    }

    /**
     * @dev Add liquidity to the pool
     * @param _tTrustAmount Amount of tTRUST tokens to add (use 0 when sending ETH)
     * @param _intuitAmount Amount of INTUIT tokens to add
     * @return liquidity LP tokens minted
     */
    function addLiquidity(
        uint256 _tTrustAmount,
        uint256 _intuitAmount
    ) external payable nonReentrant whenNotPaused returns (uint256 liquidity) {
        uint256 tTrustAmountActual;

        // Handle native TTRUST
        if (address(tTRUST) == address(0)) {
            require(msg.value > 0, "Must send TTRUST as native token");
            require(_intuitAmount > 0, "INTUIT amount must be greater than 0");
            tTrustAmountActual = msg.value;
            INTUIT.safeTransferFrom(msg.sender, address(this), _intuitAmount);
        } else {
            require(_tTrustAmount > 0 && _intuitAmount > 0, "Amounts must be greater than 0");
            tTrustAmountActual = _tTrustAmount;
            tTRUST.safeTransferFrom(msg.sender, address(this), _tTrustAmount);
            INTUIT.safeTransferFrom(msg.sender, address(this), _intuitAmount);
        }

        uint256 _totalSupply = totalSupply();

        if (_totalSupply == 0) {
            liquidity = sqrt(tTrustAmountActual * _intuitAmount) - MINIMUM_LIQUIDITY;
            _mint(address(1), MINIMUM_LIQUIDITY);
        } else {
            liquidity = min(
                (tTrustAmountActual * _totalSupply) / tTrustReserve,
                (_intuitAmount * _totalSupply) / intuitReserve
            );
        }

        require(liquidity > 0, "Insufficient liquidity minted");

        _mint(msg.sender, liquidity);

        tTrustReserve = tTrustReserve + tTrustAmountActual;
        intuitReserve = intuitReserve + _intuitAmount;
        kLast = tTrustReserve * intuitReserve;

        emit LiquidityAdded(msg.sender, tTrustAmountActual, _intuitAmount, liquidity);
    }

    /**
     * @dev Remove liquidity from the pool
     * @param _liquidity Amount of LP tokens to burn
     * @param _minTTrust Minimum tTRUST to receive
     * @param _minIntuit Minimum INTUIT to receive
     */
    function removeLiquidity(
        uint256 _liquidity,
        uint256 _minTTrust,
        uint256 _minIntuit
    ) external nonReentrant returns (uint256 tTrustAmount, uint256 intuitAmount) {
        require(_liquidity > 0, "Insufficient liquidity");
        require(balanceOf(msg.sender) >= _liquidity, "Insufficient LP tokens");

        uint256 _totalSupply = totalSupply();

        tTrustAmount = (_liquidity * tTrustReserve) / _totalSupply;
        intuitAmount = (_liquidity * intuitReserve) / _totalSupply;

        require(tTrustAmount >= _minTTrust && intuitAmount >= _minIntuit, "Insufficient output");
        require(tTrustAmount <= tTrustReserve && intuitAmount <= intuitReserve, "Insufficient reserves");

        _burn(msg.sender, _liquidity);

        tTrustReserve = tTrustReserve - tTrustAmount;
        intuitReserve = intuitReserve - intuitAmount;

        if (address(tTRUST) == address(0)) {
            (bool success, ) = payable(msg.sender).call{value: tTrustAmount}("");
            require(success, "TTRUST transfer failed");
        } else {
            tTRUST.safeTransfer(msg.sender, tTrustAmount);
        }
        INTUIT.safeTransfer(msg.sender, intuitAmount);

        kLast = tTrustReserve * intuitReserve;

        emit LiquidityRemoved(msg.sender, tTrustAmount, intuitAmount, _liquidity);
    }

    /**
     * @dev Swap tTRUST for INTUIT
     * @param _amountIn Amount of tTRUST to swap
     * @param _minAmountOut Minimum amount of INTUIT to receive
     */
    function swapTrustForIntuit(uint256 _amountIn, uint256 _minAmountOut)
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

        require(tTrustReserve > 0 && intuitReserve > 0, "Insufficient liquidity");

        uint256 amountInWithFee = amountInActual * (BASIS_POINTS - FEE_RATE);
        uint256 numerator = amountInWithFee * intuitReserve;
        uint256 denominator = (tTrustReserve * BASIS_POINTS) + amountInWithFee;
        uint256 amountOut = numerator / denominator;

        require(amountOut >= _minAmountOut, "Insufficient output amount");
        require(amountOut < intuitReserve, "Insufficient INTUIT liquidity");

        INTUIT.safeTransfer(msg.sender, amountOut);

        tTrustReserve = tTrustReserve + amountInActual;
        intuitReserve = intuitReserve - amountOut;

        totalVolume = totalVolume + amountInActual;
        totalTrades = totalTrades + 1;

        require(tTrustReserve * intuitReserve >= kLast, "K invariant violation");
        kLast = tTrustReserve * intuitReserve;

        emit Swap(msg.sender, address(tTRUST), address(INTUIT), amountInActual, amountOut, amountInActual * FEE_RATE / BASIS_POINTS);
    }

    /**
     * @dev Swap INTUIT for tTRUST
     * @param _amountIn Amount of INTUIT to swap
     * @param _minAmountOut Minimum amount of tTRUST to receive
     */
    function swapIntuitForTrust(uint256 _amountIn, uint256 _minAmountOut)
        external
        nonReentrant
        whenNotPaused
    {
        require(_amountIn > 0, "Amount must be greater than 0");
        require(tTrustReserve > 0 && intuitReserve > 0, "Insufficient liquidity");

        INTUIT.safeTransferFrom(msg.sender, address(this), _amountIn);

        uint256 amountInWithFee = _amountIn * (BASIS_POINTS - FEE_RATE);
        uint256 numerator = amountInWithFee * tTrustReserve;
        uint256 denominator = (intuitReserve * BASIS_POINTS) + amountInWithFee;
        uint256 amountOut = numerator / denominator;

        require(amountOut >= _minAmountOut, "Insufficient output amount");
        require(amountOut < tTrustReserve, "Insufficient tTRUST liquidity");

        if (address(tTRUST) == address(0)) {
            (bool success, ) = payable(msg.sender).call{value: amountOut}("");
            require(success, "TTRUST transfer failed");
        } else {
            tTRUST.safeTransfer(msg.sender, amountOut);
        }

        intuitReserve = intuitReserve + _amountIn;
        tTrustReserve = tTrustReserve - amountOut;

        totalVolume = totalVolume + (_amountIn * tTrustReserve / intuitReserve);
        totalTrades = totalTrades + 1;

        require(tTrustReserve * intuitReserve >= kLast, "K invariant violation");
        kLast = tTrustReserve * intuitReserve;

        emit Swap(msg.sender, address(INTUIT), address(tTRUST), _amountIn, amountOut, _amountIn * FEE_RATE / BASIS_POINTS);
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
        require(_tokenIn == address(tTRUST) || _tokenIn == address(INTUIT), "Invalid token");
        require(_amountIn > 0, "Amount must be greater than 0");
        require(tTrustReserve > 0 && intuitReserve > 0, "Insufficient liquidity");

        uint256 amountInWithFee = _amountIn * (BASIS_POINTS - FEE_RATE);

        if (_tokenIn == address(tTRUST)) {
            uint256 numerator = amountInWithFee * intuitReserve;
            uint256 denominator = (tTrustReserve * BASIS_POINTS) + amountInWithFee;
            amountOut = numerator / denominator;
        } else {
            uint256 numerator = amountInWithFee * tTrustReserve;
            uint256 denominator = (intuitReserve * BASIS_POINTS) + amountInWithFee;
            amountOut = numerator / denominator;
        }
    }

    /**
     * @dev Get current price of token in terms of the other token
     * @param _token Token to get price for
     * @return price Price in 18 decimal places
     */
    function getPrice(address _token) external view returns (uint256 price) {
        require(_token == address(tTRUST) || _token == address(INTUIT), "Invalid token");
        require(tTrustReserve > 0 && intuitReserve > 0, "No liquidity");

        if (_token == address(tTRUST)) {
            price = (intuitReserve * 1e18) / tTrustReserve;
        } else {
            price = (tTrustReserve * 1e18) / intuitReserve;
        }
    }

    /**
     * @dev Get DEX statistics
     */
    function getDEXStats() external view returns (
        uint256 _tTrustReserve,
        uint256 _intuitReserve,
        uint256 _totalVolume,
        uint256 _totalTrades,
        uint256 _totalLiquidity
    ) {
        return (tTrustReserve, intuitReserve, totalVolume, totalTrades, totalSupply());
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