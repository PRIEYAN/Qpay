import React, { useState } from 'react';
import { Clipboard, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Avatar, Card, Divider, Icon, Screen, SectionLabel, Sheet, Toast } from '../../component/ui';
import { FadeIn, PressableScale, SlideIn, Stagger, haptic } from '../../component/motion';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, typography } from '../../theme/theme';
import { CHAIN_ASSET_META } from '../../services/qpayService';
import { useQpayContext } from '../../context/QpayProvider';
import { truncateAddress } from '../../utils';
import { RootStackParamList } from '../../navigation/types';
import { ConnectionGate } from '../components/ConnectionGate';
import { IconRow } from '../components/IconRow';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** mobileAppWorkflow.md §2.10 — identity, primary-chain change, contacts, settings, help. */
export default function ProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { snapshot, error } = useQpayContext();
  const [toast, setToast] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const profile = snapshot?.profile;
  const openRequests = snapshot?.paymentRequests.filter((r) => r.status === 'open').length ?? 0;

  const copy = (value: string) => {
    haptic('select');
    Clipboard.setString(value);
    setToast(true);
    setTimeout(() => setToast(false), 1500);
  };

  const goToChainPicker = () => {
    // RootStackParamList types `Auth` as `undefined` — nested navigation into
    // a specific screen of AuthNavigator still works at runtime, it just
    // isn't representable in the fixed contract's params, hence the `any`.
    (navigation as any).navigate('Auth', { screen: 'PrimaryChainPicker' });
  };

  return (
    <Screen title="Profile">
      <SlideIn distance={12}>
        <View style={styles.header}>
          <Avatar name={profile?.displayName ?? '?'} size={72} />
          <Text style={[typography.title, styles.name, { color: theme.ink }]}>
            {profile?.displayName ?? '—'}
          </Text>

          <View style={styles.idRow}>
            <Text style={[typography.body, { color: theme.muted }]}>{profile?.qpayId ?? '—'}</Text>
            {profile ? <Icon name="copy" size={16} color={theme.muted} /> : null}
          </View>
          {profile ? (
            <PressableScale onPress={() => copy(profile.qpayId)} hitSlop={8}>
              <Text style={[typography.label, styles.copyHint, { color: theme.ink }]}>Copy Qpay ID</Text>
            </PressableScale>
          ) : null}

          {profile ? (
            <PressableScale onPress={() => copy(profile.walletAddress)} hitSlop={8}>
              <Text style={[typography.label, styles.address, { color: theme.muted }]}>
                {truncateAddress(profile.walletAddress)} · tap to copy
              </Text>
            </PressableScale>
          ) : null}
        </View>
      </SlideIn>

      <FadeIn delay={80}>
        <Card onPress={() => navigation.navigate('Request')} style={styles.codeCard} variant="flat">
          <View style={styles.codeRow}>
            <Icon name="qr" size={28} color={theme.ink} />
            <View style={styles.codeText}>
              <Text style={[typography.bodyMedium, { color: theme.ink }]}>Your Qpay code</Text>
              <Text style={[typography.label, { color: theme.muted }]}>
                Show it to get paid, or share your ID
              </Text>
            </View>
            <Icon name="chevronRight" size={18} color={theme.muted} />
          </View>
        </Card>
      </FadeIn>

      <ConnectionGate error={error}>
        <SectionLabel>Account</SectionLabel>
        <Card padded={false} style={styles.card}>
          <Stagger interval={40} direction="left" distance={8}>
            <IconRow
              icon="wallet"
              label="Primary chain"
              value={profile ? CHAIN_ASSET_META[profile.primaryAsset].label : '—'}
              onPress={goToChainPicker}
            />
            <Divider />
            <IconRow
              icon="request"
              label="Payment requests"
              value={openRequests > 0 ? `${openRequests} open` : 'None open'}
              onPress={() => navigation.navigate('Request')}
            />
            <Divider />
            <IconRow
              icon="contacts"
              label="Contacts"
              onPress={() => navigation.navigate('ContactPicker', { mode: 'send' })}
            />
            <Divider />
            <IconRow icon="settings" label="Settings" onPress={() => navigation.navigate('Settings')} />
            <Divider />
            <IconRow icon="info" label="Help" onPress={() => setHelpOpen(true)} />
          </Stagger>
        </Card>
      </ConnectionGate>

      <Sheet visible={helpOpen} onClose={() => setHelpOpen(false)} title="Help">
        <Text style={[typography.body, styles.helpBody, { color: theme.ink }]}>
          Qpay lets you pay in whatever asset you hold and get paid in whatever asset you chose as
          your primary chain. Payments between Qpay users settle instantly and cost nothing.
          Moving value onto or off a real chain is the only slow step, and it is optional.
        </Text>
        <Text style={[typography.body, styles.helpBody, { color: theme.muted }]}>
          Qpay reads live balances and activity from Flare Coston2 once its contracts are deployed.
          Contacts, businesses, and payment requests are stored only on this device. See Settings →
          About for the current setup status.
        </Text>
      </Sheet>

      <Toast message="Copied" visible={toast} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingBottom: spacing.xl },
  name: { marginTop: spacing.md },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  copyHint: { marginTop: spacing.xs, textDecorationLine: 'underline' },
  address: { marginTop: spacing.sm },
  codeCard: { marginBottom: spacing.xl },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  codeText: { flex: 1, gap: 2 },
  card: { paddingHorizontal: spacing.md, marginBottom: spacing.xl },
  helpBody: { lineHeight: 21, marginBottom: spacing.md },
});
