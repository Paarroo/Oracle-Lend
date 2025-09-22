// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IDEX {
    function getAmountOut(address _tokenIn, uint256 _amountIn) external view returns (uint256 amountOut);
    function swapTrustForOracle(uint256 _amountIn, uint256 _minAmountOut) external payable;
    function swapOracleForTrust(uint256 _amountIn, uint256 _minAmountOut) external;
    function swapTrustForIntuit(uint256 _amountIn, uint256 _minAmountOut) external payable;
    function swapIntuitForTrust(uint256 _amountIn, uint256 _minAmountOut) external;
    function swapTrustForTswp(uint256 _amountIn, uint256 _minAmountOut) external payable;
    function swapTswpForTrust(uint256 _amountIn, uint256 _minAmountOut) external;
    function swapTrustForPintu(uint256 _amountIn, uint256 _minAmountOut) external payable;
    function swapPintuForTrust(uint256 _amountIn, uint256 _minAmountOut) external;
    function getPrice(address _token) external view returns (uint256 price);
}

/**
 * @title DEXRouter
 * @dev Routes swaps through multiple DEX pools to enable token-to-token swaps
 * @notice Aggregates all DEX pools and enables multi-hop swaps
 */
contract DEXRouter is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // DEX contracts
    IDEX public immutable DEX_ORACLE;
    IDEX public immutable DEX_INTUIT;
    IDEX public immutable DEX_TSWP;
    IDEX public immutable DEX_PINTU;

    // Token contracts
    IERC20 public immutable tTRUST;
    IERC20 public immutable ORACLE;
    IERC20 public immutable INTUIT;
    IERC20 public immutable TSWP;
    IERC20 public immutable PINTU;

    // Statistics
    uint256 public totalRoutedVolume;
    uint256 public totalRoutedTrades;

    // Events
    event MultiHopSwap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address[] path
    );
    event DirectSwap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address dex
    );

    /**
     * @dev Constructor
     * @param _dexOracle DEX for tTRUST/ORACLE
     * @param _dexIntuit DEX for tTRUST/INTUIT
     * @param _dexTswp DEX for tTRUST/TSWP
     * @param _dexPintu DEX for tTRUST/PINTU
     * @param _tTrust tTRUST token address (0x0 for native)
     * @param _oracle ORACLE token address
     * @param _intuit INTUIT token address
     * @param _tswp TSWP token address
     * @param _pintu PINTU token address
     */
    constructor(
        address _dexOracle,
        address _dexIntuit,
        address _dexTswp,
        address _dexPintu,
        address _tTrust,
        address _oracle,
        address _intuit,
        address _tswp,
        address _pintu
    ) Ownable(msg.sender) {
        require(_dexOracle != address(0), "Invalid DEX_ORACLE");
        require(_dexIntuit != address(0), "Invalid DEX_INTUIT");
        require(_dexTswp != address(0), "Invalid DEX_TSWP");
        require(_dexPintu != address(0), "Invalid DEX_PINTU");
        require(_oracle != address(0), "Invalid ORACLE");
        require(_intuit != address(0), "Invalid INTUIT");
        require(_tswp != address(0), "Invalid TSWP");
        require(_pintu != address(0), "Invalid PINTU");

        DEX_ORACLE = IDEX(_dexOracle);
        DEX_INTUIT = IDEX(_dexIntuit);
        DEX_TSWP = IDEX(_dexTswp);
        DEX_PINTU = IDEX(_dexPintu);

        tTRUST = IERC20(_tTrust);
        ORACLE = IERC20(_oracle);
        INTUIT = IERC20(_intuit);
        TSWP = IERC20(_tswp);
        PINTU = IERC20(_pintu);
    }

    /**
     * @dev Get the appropriate DEX for a token pair
     * @param tokenA First token
     * @param tokenB Second token
     * @return dex Address of the DEX handling this pair
     */
    function getDEXForPair(address tokenA, address tokenB) public view returns (IDEX dex) {
        // Both involve tTRUST
        if (tokenA == address(tTRUST) || tokenB == address(tTRUST)) {
            if (tokenA == address(ORACLE) || tokenB == address(ORACLE)) {
                return DEX_ORACLE;
            } else if (tokenA == address(INTUIT) || tokenB == address(INTUIT)) {
                return DEX_INTUIT;
            } else if (tokenA == address(TSWP) || tokenB == address(TSWP)) {
                return DEX_TSWP;
            } else if (tokenA == address(PINTU) || tokenB == address(PINTU)) {
                return DEX_PINTU;
            }
        }
        revert("No direct pair exists");
    }

    /**
     * @dev Calculate output for multi-hop swap
     * @param tokenIn Input token
     * @param tokenOut Output token
     * @param amountIn Input amount
     * @return amountOut Expected output amount
     * @return path Optimal path for the swap
     */
    function calculateMultiHopOutput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) public view returns (uint256 amountOut, address[] memory path) {
        // Direct pair exists
        try this.getDEXForPair(tokenIn, tokenOut) returns (IDEX dex) {
            amountOut = dex.getAmountOut(tokenIn, amountIn);
            path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
            return (amountOut, path);
        } catch {
            // Need to route through tTRUST
            IDEX dexIn = getDEXForPair(tokenIn, address(tTRUST));
            IDEX dexOut = getDEXForPair(address(tTRUST), tokenOut);

            uint256 tTrustAmount = dexIn.getAmountOut(tokenIn, amountIn);
            amountOut = dexOut.getAmountOut(address(tTRUST), tTrustAmount);

            path = new address[](3);
            path[0] = tokenIn;
            path[1] = address(tTRUST);
            path[2] = tokenOut;
            return (amountOut, path);
        }
    }

    /**
     * @dev Swap any token to any other token
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount to swap
     * @param minAmountOut Minimum output amount
     * @return amountOut Actual output amount
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external payable nonReentrant whenNotPaused returns (uint256 amountOut) {
        require(tokenIn != tokenOut, "Same token");
        require(amountIn > 0, "Zero input");

        // Calculate route
        (uint256 expectedOut, address[] memory path) = calculateMultiHopOutput(tokenIn, tokenOut, amountIn);
        require(expectedOut >= minAmountOut, "Insufficient output");

        // Handle native token input
        if (tokenIn == address(tTRUST)) {
            require(msg.value == amountIn, "Incorrect ETH amount");
        } else {
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        }

        if (path.length == 2) {
            // Direct swap
            amountOut = _directSwap(tokenIn, tokenOut, amountIn, minAmountOut);
            emit DirectSwap(msg.sender, tokenIn, tokenOut, amountIn, amountOut, address(getDEXForPair(tokenIn, tokenOut)));
        } else {
            // Multi-hop swap through tTRUST
            amountOut = _multiHopSwap(tokenIn, tokenOut, amountIn, minAmountOut);
            emit MultiHopSwap(msg.sender, tokenIn, tokenOut, amountIn, amountOut, path);
        }

        // Update statistics
        totalRoutedVolume += amountIn;
        totalRoutedTrades++;

        // Transfer output to user
        if (tokenOut == address(tTRUST)) {
            (bool success, ) = payable(msg.sender).call{value: amountOut}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        }

        return amountOut;
    }

    /**
     * @dev Execute direct swap on single DEX
     */
    function _directSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256) {
        IDEX dex = getDEXForPair(tokenIn, tokenOut);

        // Approve DEX to spend tokens
        if (tokenIn != address(tTRUST)) {
            IERC20(tokenIn).approve(address(dex), amountIn);
        }

        uint256 balanceBefore = _getBalance(tokenOut);

        // Execute swap based on token pair
        if (tokenIn == address(tTRUST)) {
            if (tokenOut == address(ORACLE)) {
                DEX_ORACLE.swapTrustForOracle{value: amountIn}(0, minAmountOut);
            } else if (tokenOut == address(INTUIT)) {
                DEX_INTUIT.swapTrustForIntuit{value: amountIn}(0, minAmountOut);
            } else if (tokenOut == address(TSWP)) {
                DEX_TSWP.swapTrustForTswp{value: amountIn}(0, minAmountOut);
            } else if (tokenOut == address(PINTU)) {
                DEX_PINTU.swapTrustForPintu{value: amountIn}(0, minAmountOut);
            }
        } else if (tokenOut == address(tTRUST)) {
            if (tokenIn == address(ORACLE)) {
                DEX_ORACLE.swapOracleForTrust(amountIn, minAmountOut);
            } else if (tokenIn == address(INTUIT)) {
                DEX_INTUIT.swapIntuitForTrust(amountIn, minAmountOut);
            } else if (tokenIn == address(TSWP)) {
                DEX_TSWP.swapTswpForTrust(amountIn, minAmountOut);
            } else if (tokenIn == address(PINTU)) {
                DEX_PINTU.swapPintuForTrust(amountIn, minAmountOut);
            }
        }

        uint256 balanceAfter = _getBalance(tokenOut);
        return balanceAfter - balanceBefore;
    }

    /**
     * @dev Execute multi-hop swap through tTRUST
     */
    function _multiHopSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256) {
        // First swap: tokenIn -> tTRUST
        IDEX dexIn = getDEXForPair(tokenIn, address(tTRUST));
        IERC20(tokenIn).approve(address(dexIn), amountIn);

        uint256 tTrustBalanceBefore = _getBalance(address(tTRUST));

        if (tokenIn == address(ORACLE)) {
            DEX_ORACLE.swapOracleForTrust(amountIn, 0);
        } else if (tokenIn == address(INTUIT)) {
            DEX_INTUIT.swapIntuitForTrust(amountIn, 0);
        } else if (tokenIn == address(TSWP)) {
            DEX_TSWP.swapTswpForTrust(amountIn, 0);
        } else if (tokenIn == address(PINTU)) {
            DEX_PINTU.swapPintuForTrust(amountIn, 0);
        }

        uint256 tTrustAmount = _getBalance(address(tTRUST)) - tTrustBalanceBefore;

        // Second swap: tTRUST -> tokenOut
        uint256 outputBalanceBefore = _getBalance(tokenOut);

        if (tokenOut == address(ORACLE)) {
            DEX_ORACLE.swapTrustForOracle{value: tTrustAmount}(0, minAmountOut);
        } else if (tokenOut == address(INTUIT)) {
            DEX_INTUIT.swapTrustForIntuit{value: tTrustAmount}(0, minAmountOut);
        } else if (tokenOut == address(TSWP)) {
            DEX_TSWP.swapTrustForTswp{value: tTrustAmount}(0, minAmountOut);
        } else if (tokenOut == address(PINTU)) {
            DEX_PINTU.swapTrustForPintu{value: tTrustAmount}(0, minAmountOut);
        }

        return _getBalance(tokenOut) - outputBalanceBefore;
    }

    /**
     * @dev Get balance of token (handles native token)
     */
    function _getBalance(address token) internal view returns (uint256) {
        if (token == address(tTRUST)) {
            return address(this).balance;
        } else {
            return IERC20(token).balanceOf(address(this));
        }
    }

    /**
     * @dev Get aggregated price across all DEXs
     * @param token Token to get price for (in tTRUST)
     * @return price Average price in 18 decimals
     */
    function getAggregatedPrice(address token) external view returns (uint256 price) {
        if (token == address(tTRUST)) {
            return 1e18; // 1:1 for tTRUST itself
        }

        IDEX dex = getDEXForPair(token, address(tTRUST));
        return dex.getPrice(token);
    }

    /**
     * @dev Get router statistics
     */
    function getRouterStats() external view returns (
        uint256 routedVolume,
        uint256 routedTrades,
        address dexOracle,
        address dexIntuit,
        address dexTswp,
        address dexPintu
    ) {
        return (
            totalRoutedVolume,
            totalRoutedTrades,
            address(DEX_ORACLE),
            address(DEX_INTUIT),
            address(DEX_TSWP),
            address(DEX_PINTU)
        );
    }

    // Admin functions
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Emergency withdrawal
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }

    // Receive ETH
    receive() external payable {}
}