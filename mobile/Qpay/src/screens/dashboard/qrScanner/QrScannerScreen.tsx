import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Camera, CameraType } from 'react-native-camera-kit';
import type { CameraApi } from 'react-native-camera-kit';
import { Button, Input, Screen, SectionLabel } from '../../../component/ui';
import { Icon } from '../../../component/icons/Icon';
import { FadeIn, PressableScale, haptic } from '../../../component/motion';
import { parseScannedQpayCode, QpayUriError } from '../../../component/qr/qrUri';
import { useTheme } from '../../../theme/ThemeProvider';
import { borderWidth, borderWidthStrong, radius, spacing, typography } from '../../../theme/theme';
import { RootStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'QrScanner'>;

type PermissionState = 'checking' | 'granted' | 'blocked';

const VIEWFINDER_HEIGHT = 340;
const WINDOW = 240;
const CORNER = 28;
const SCAN_LINE_HEIGHT = 2;

/**
 * mobileAppWorkflow.md §2.5 — scans a static (`qpay:username`) or dynamic
 * (`qpay:username?amount=..`) QR via the device camera. Falls back to a
 * manual-username entry whenever the camera can't be used (permission
 * denied, camera failure) so a camera problem never dead-ends the flow.
 *
 * Scanning is powered by `react-native-camera-kit`. Unlike
 * react-native-vision-camera 5.2.2's QR API (`useObjectOutput`, which the
 * Android native factory unconditionally throws on —
 * "CameraObjectOutput is not available on Android!"), camera-kit's
 * `scanBarcode`/`onReadCode` works on both iOS and Android, so scanning is no
 * longer gated to a single platform.
 */
export default function QrScannerScreen({ navigation }: Props) {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const cameraRef = useRef<CameraApi>(null);

  const [permission, setPermission] = useState<PermissionState>(
    Platform.OS === 'android' ? 'checking' : 'granted',
  );
  const [manualUsername, setManualUsername] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const scanLockRef = useRef(false);

  // Android: camera-kit ships no JS permission hook and its native camera
  // view doesn't report a permission-request result back to JS, so the
  // standard PermissionsAndroid flow is driven here and the camera is only
  // mounted once it resolves. Re-runs whenever the screen regains focus, so
  // returning from Settings (after "Open settings" below) picks up a change.
  useEffect(() => {
    if (Platform.OS !== 'android' || !isFocused) return;
    let cancelled = false;
    (async () => {
      const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (already) {
        if (!cancelled) setPermission('granted');
        return;
      }
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
        title: 'Camera access',
        message: 'Qpay uses the camera to scan payment QR codes.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      });
      if (!cancelled) {
        setPermission(result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'blocked');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isFocused]);

  // iOS has no PermissionsAndroid equivalent. Mounting `<Camera>` triggers
  // the native AVFoundation authorization flow, which shows the system
  // Info.plist prompt itself on first use — so the camera mounts
  // optimistically, and camera-kit's own `checkDeviceCameraAuthorizationStatus`
  // (on its public `CameraApi` ref) is used only as a safety net to catch an
  // *already*-denied permission, which would otherwise render a blank camera
  // with no error.
  useEffect(() => {
    if (Platform.OS !== 'ios' || !isFocused || permission === 'blocked') return;
    let cancelled = false;
    (async () => {
      try {
        const authorized = await cameraRef.current?.checkDeviceCameraAuthorizationStatus();
        if (!cancelled && authorized === false) {
          setPermission('blocked');
        }
      } catch {
        // Safety-net check unavailable in this environment — stay
        // optimistic and let `onError` below catch a hard camera failure.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isFocused, permission]);

  const goToSend = useCallback(
    (username: string, amount?: number) => {
      navigation.replace('Send', amount != null ? { username, amount } : { username });
    },
    [navigation],
  );

  const handleScannedValue = useCallback(
    (value: string) => {
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      try {
        const parsed = parseScannedQpayCode(value);
        setScanError(null);
        haptic('scan');
        goToSend(parsed.username, parsed.amount);
      } catch (error) {
        haptic('warning');
        setScanError(error instanceof QpayUriError ? error.message : 'Not a Qpay code');
      }
    },
    [goToSend],
  );

  const resetScan = useCallback(() => {
    scanLockRef.current = false;
    setScanError(null);
  }, []);

  const handleManualSubmit = useCallback(() => {
    if (!manualUsername.trim()) return;
    goToSend(manualUsername.trim());
  }, [goToSend, manualUsername]);

  const cameraActive = isFocused && permission === 'granted' && !cameraError;

  return (
    <Screen
      title="Scan to pay"
      onBack={() => navigation.goBack()}
      footer={
        <Button label="Continue" onPress={handleManualSubmit} disabled={!manualUsername.trim()} />
      }
    >
      <View style={[styles.viewfinder, { backgroundColor: theme.surface }]}>
        {permission === 'checking' && <RequestingPermission />}

        {permission === 'blocked' && <PermissionBlocked />}

        {permission === 'granted' && cameraError && <CameraUnavailable reason={cameraError} />}

        {cameraActive && (
          <>
            <Camera
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              cameraType={CameraType.Back}
              scanBarcode
              allowedBarcodeTypes={['qr']}
              showFrame={false}
              resizeMode="cover"
              torchMode={torchOn ? 'on' : 'off'}
              onReadCode={(event) => handleScannedValue(event.nativeEvent.codeStringValue)}
              onError={(event) =>
                setCameraError(event.nativeEvent.errorMessage || 'Camera failed to start')
              }
            />
            <ViewfinderOverlay ink={theme.ink} />
            <TorchButton
              on={torchOn}
              onToggle={() => setTorchOn((v) => !v)}
              theme={{ ink: theme.ink, paper: theme.paper }}
            />
          </>
        )}
      </View>

      {scanError ? (
        <FadeIn style={[styles.errorBanner, { borderColor: theme.ink }]}>
          <Icon name="alert" size={18} color={theme.ink} />
          <Text style={[typography.label, styles.errorText, { color: theme.ink }]}>{scanError}</Text>
          <PressableScale onPress={resetScan} hitSlop={8} accessibilityRole="button">
            <Text style={[typography.label, { color: theme.ink, textDecorationLine: 'underline' }]}>
              Scan again
            </Text>
          </PressableScale>
        </FadeIn>
      ) : cameraActive ? (
        <Text style={[typography.label, styles.hint, { color: theme.muted }]}>Point at a Qpay QR</Text>
      ) : null}

      <View style={styles.manualBlock}>
        <SectionLabel>Or enter a Qpay ID</SectionLabel>
        <Input
          value={manualUsername}
          onChangeText={setManualUsername}
          placeholder="username"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleManualSubmit}
        />
      </View>
    </Screen>
  );
}

function RequestingPermission() {
  const theme = useTheme();
  return (
    <View style={styles.centeredMessage}>
      <Icon name="camera" size={28} color={theme.muted} />
      <Text style={[typography.label, styles.messageText, { color: theme.muted }]}>
        Requesting camera access…
      </Text>
    </View>
  );
}

function PermissionBlocked() {
  const theme = useTheme();
  return (
    <View style={styles.centeredMessage}>
      <Icon name="alert" size={28} color={theme.ink} />
      <Text style={[typography.bodyMedium, styles.messageText, { color: theme.ink }]}>
        Camera access is off
      </Text>
      <Text style={[typography.label, styles.messageSubtext, { color: theme.muted }]}>
        Allow camera access in Settings to scan a Qpay QR, or enter a Qpay ID manually below.
      </Text>
      <Button
        label="Open settings"
        variant="secondary"
        size="md"
        onPress={() => Linking.openSettings()}
        style={styles.messageButton}
      />
    </View>
  );
}

function CameraUnavailable({ reason }: { reason: string }) {
  const theme = useTheme();
  return (
    <View style={styles.centeredMessage}>
      <Icon name="camera" size={28} color={theme.muted} />
      <Text style={[typography.bodyMedium, styles.messageText, { color: theme.ink }]}>
        Camera unavailable
      </Text>
      <Text style={[typography.label, styles.messageSubtext, { color: theme.muted }]}>{reason}</Text>
      <Text style={[typography.label, styles.messageSubtext, { color: theme.muted }]}>
        Enter a Qpay ID manually below instead.
      </Text>
    </View>
  );
}

/** Four square corner brackets + dimmed scrim surround + a moving scan line, all monochrome, no rounded reticle. */
function ViewfinderOverlay({ ink }: { ink: string }) {
  const theme = useTheme();
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(scanAnim, {
        toValue: 1,
        duration: 1700,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [scanAnim]);

  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, WINDOW - SCAN_LINE_HEIGHT],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.scrimBand, { backgroundColor: theme.overlay }]} />
      <View style={styles.scrimMiddleRow}>
        <View style={[styles.scrimBand, { backgroundColor: theme.overlay }]} />
        <View style={styles.window}>
          <View style={[styles.corner, styles.tl, { borderColor: ink }]} />
          <View style={[styles.corner, styles.tr, { borderColor: ink }]} />
          <View style={[styles.corner, styles.bl, { borderColor: ink }]} />
          <View style={[styles.corner, styles.br, { borderColor: ink }]} />
          <Animated.View
            style={[styles.scanLine, { backgroundColor: ink, transform: [{ translateY }] }]}
          />
        </View>
        <View style={[styles.scrimBand, { backgroundColor: theme.overlay }]} />
      </View>
      <View style={[styles.scrimBand, { backgroundColor: theme.overlay }]} />
    </View>
  );
}

function TorchButton({
  on,
  onToggle,
  theme,
}: {
  on: boolean;
  onToggle: () => void;
  theme: { ink: string; paper: string };
}) {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Toggle torch"
      style={[
        styles.torchButton,
        { backgroundColor: on ? theme.ink : theme.paper, borderColor: theme.ink },
      ]}
    >
      <Icon name="flash" size={18} color={on ? theme.paper : theme.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  viewfinder: {
    height: VIEWFINDER_HEIGHT,
    overflow: 'hidden',
  },
  scrimBand: { flex: 1 },
  scrimMiddleRow: { height: WINDOW, flexDirection: 'row' },
  window: { width: WINDOW, height: WINDOW },
  corner: { position: 'absolute', width: CORNER, height: CORNER },
  tl: { top: 0, left: 0, borderTopWidth: borderWidthStrong, borderLeftWidth: borderWidthStrong },
  tr: { top: 0, right: 0, borderTopWidth: borderWidthStrong, borderRightWidth: borderWidthStrong },
  bl: { bottom: 0, left: 0, borderBottomWidth: borderWidthStrong, borderLeftWidth: borderWidthStrong },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: borderWidthStrong,
    borderRightWidth: borderWidthStrong,
  },
  scanLine: { position: 'absolute', left: 0, right: 0, height: SCAN_LINE_HEIGHT, opacity: 0.85 },
  torchButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 40,
    height: 40,
    borderRadius: radius,
    borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  messageText: {},
  messageSubtext: { textAlign: 'center' },
  messageButton: { marginTop: spacing.sm },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth,
    borderRadius: radius,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  errorText: { flex: 1 },
  hint: { marginTop: spacing.md, textAlign: 'center' },
  manualBlock: { marginTop: spacing.xl },
});
