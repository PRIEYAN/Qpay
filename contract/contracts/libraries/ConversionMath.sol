// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Decimal-safe cross-asset conversion math, priced in USD via two FTSOv2-style
///         (value, decimals) feed reads. Kept as a pure library so every decimal pair
///         (FXRP=6, WFLR=18, USDT0=6) can be unit-tested in isolation from any oracle call.
library ConversionMath {
    uint256 internal constant BIPS_DENOMINATOR = 10_000;

    /// @param amountIn      amount of assetIn, in assetIn's own decimals
    /// @param priceIn       USD price of assetIn, in priceIn's own decimals
    /// @param priceInDecimals  decimals of priceIn
    /// @param priceOut      USD price of assetOut, in priceOut's own decimals
    /// @param priceOutDecimals decimals of priceOut
    /// @param decimalsIn    decimals of assetIn token
    /// @param decimalsOut   decimals of assetOut token
    /// @param spreadBIPS    fee taken from the output, in basis points (100 = 1%)
    function convert(
        uint256 amountIn,
        uint256 priceIn,
        int8 priceInDecimals,
        uint256 priceOut,
        int8 priceOutDecimals,
        uint8 decimalsIn,
        uint8 decimalsOut,
        uint256 spreadBIPS
    ) internal pure returns (uint256 amountOut) {
        require(priceIn > 0 && priceOut > 0, "ConversionMath: bad price");
        require(spreadBIPS <= BIPS_DENOMINATOR, "ConversionMath: bad spread");

        // amountOut = amountIn * priceIn/10^priceInDecimals / (priceOut/10^priceOutDecimals)
        //           * 10^(decimalsOut - decimalsIn)
        // Rearranged to a single multiply-then-divide to preserve precision:
        //
        // amountOut = amountIn * priceIn * 10^priceOutDecimals * 10^decimalsOut
        //             ----------------------------------------------------------
        //             priceOut * 10^priceInDecimals * 10^decimalsIn

        uint256 numerator = amountIn * priceIn;
        uint256 denominator = priceOut;

        (numerator, denominator) = _scale(numerator, denominator, priceOutDecimals, priceInDecimals);
        (numerator, denominator) = _scale(numerator, denominator, int8(uint8(decimalsOut)), int8(uint8(decimalsIn)));

        amountOut = numerator / denominator;
        amountOut = (amountOut * (BIPS_DENOMINATOR - spreadBIPS)) / BIPS_DENOMINATOR;
    }

    /// @dev Applies a net power-of-ten scale factor of 10^(posExp - negExp) to the
    ///      numerator/denominator pair without ever taking a negative exponent.
    function _scale(
        uint256 numerator,
        uint256 denominator,
        int8 posExp,
        int8 negExp
    ) private pure returns (uint256, uint256) {
        int256 net = int256(posExp) - int256(negExp);
        if (net > 0) {
            numerator *= 10 ** uint256(net);
        } else if (net < 0) {
            denominator *= 10 ** uint256(-net);
        }
        return (numerator, denominator);
    }
}
