/**
 * Manual Jest mock for `react-native-qrcode-svg`.
 *
 * The real package ships an ES-module entry point
 * (`export { default } from './src/index.js'`) that isn't covered by
 * `jest.config.js`'s `transformIgnorePatterns`, so Jest fails to parse it
 * with "Unexpected token 'export'". It's pulled in at import time by
 * `QpayQrCode` (`src/component/qr/QpayQrCode.tsx`), which `RequestScreen`
 * imports, which `RootNavigator` (and therefore `App`) imports eagerly — so
 * without this mock, `App.test.tsx` can't even load `App`, regardless of
 * whether the QR generator is actually rendered in a given test.
 *
 * Stubbed as a no-op component; nothing in this app's tests asserts on the
 * rendered QR pixels.
 */

function QRCode() {
  return null;
}
QRCode.displayName = 'MockQRCode';

module.exports = QRCode;
module.exports.default = QRCode;
