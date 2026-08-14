/**
 * Manual Jest mock for `react-native-camera-kit`.
 *
 * Like the react-native-vision-camera mock it replaces, this is a
 * native-module-backed package with no JS-only fallback. `QrScannerScreen`
 * (imported eagerly by `RootNavigator`, and therefore transitively by `App`)
 * pulls this module in at import time even when the scanner screen itself
 * isn't rendered, so a mock is required just to keep `App` importable in the
 * Jest/Node environment.
 *
 * Kept intentionally minimal: stub shapes for exactly the exports
 * `QrScannerScreen` uses. `Camera` renders nothing and forwards no ref
 * methods — `QrScannerScreen`'s `cameraRef.current?.…` calls are all
 * optional-chained, so a null ref is handled safely.
 */

function Camera() {
  return null;
}
Camera.displayName = 'MockCamera';

const CameraType = {
  Front: 'front',
  Back: 'back',
};

module.exports = {
  Camera,
  CameraType,
};
