// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ConversionMath} from "./ConversionMath.sol";

/// @notice Foundry-style unit tests for ConversionMath, covering every decimal
///         pair Qpay actually uses (FXRP=6, USDT0=6, WFLR=18), per
///         implementation.md §4 — "the highest-risk arithmetic in the codebase."
contract ConversionMathTest {
    function assertApproxEq(uint256 a, uint256 b, uint256 tolerance) internal pure {
        uint256 diff = a > b ? a - b : b - a;
        require(diff <= tolerance, "ConversionMathTest: not approx equal");
    }

    /// forge-config: default.fuzz.runs = 0
    function test_sameDecimals_6to6_noSpread() public pure {
        // 100 USDT0 (6dp) at $1.00 -> FXRP (6dp) at $0.50 => 200 FXRP
        uint256 amountOut = ConversionMath.convert(
            100_000000, // 100.000000 USDT0
            1_00000000, // price $1.00, 8 decimals
            8,
            50000000, // price $0.50, 8 decimals
            8,
            6,
            6,
            0
        );
        assertApproxEq(amountOut, 200_000000, 0);
    }

    function test_decimals_6to18_withSpread() public pure {
        // 10 USDT0 (6dp) at $1.00 -> WFLR (18dp) at $0.02 => 500 WFLR, minus 0.30% spread
        uint256 amountOut = ConversionMath.convert(
            10_000000, // 10.000000 USDT0
            1_00000000, // $1.00
            8,
            2000000, // $0.02
            8,
            6,
            18,
            30 // 0.30%
        );
        uint256 expectedBeforeSpread = 500 ether;
        uint256 expected = (expectedBeforeSpread * 9970) / 10000;
        assertApproxEq(amountOut, expected, 1);
    }

    function test_decimals_18to6() public pure {
        // 100 WFLR (18dp) at $0.02 -> USDT0 (6dp) at $1.00 => 2 USDT0
        uint256 amountOut = ConversionMath.convert(100 ether, 2000000, 8, 1_00000000, 8, 18, 6, 0);
        assertApproxEq(amountOut, 2_000000, 0);
    }

}
