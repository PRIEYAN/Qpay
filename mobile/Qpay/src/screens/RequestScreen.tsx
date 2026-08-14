import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Clipboard, Share, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import {
  AmountDisplay,
  Avatar,
  Button,
  Card,
  ContactChip,
  EmptyState,
  Icon,
  Input,
  KeypadNumeric,
  Screen,
  SectionLabel,
  SegmentedControl,
  StatusTag,
  Toast,
} from '../component/ui';
import { FadeIn, PressableScale, Stagger, haptic } from '../component/motion';
import { QpayQrCode } from '../component/qr/QpayQrCode';
import { useTheme } from '../theme/ThemeProvider';
import { motion, spacing, typography } from '../theme/theme';
import { RootStackParamList } from '../navigation/types';
import { useQpayContext } from '../context/QpayProvider';
import { useContacts, usePay } from '../hooks';
import { PaymentRequest } from '../services/types';
import { buildQpayUri, formatAmount, formatRelativeTime } from '../utils';
import { takePendingRequestTarget } from './ContactPickerScreen';
import { ConnectionGate } from './components/ConnectionGate';

type Props = NativeStackScreenProps<RootStackParamList, 'Request'>;

type Target = { qpayId: string; name: string };
type Tab = 'code' | 'from';

/**
 * mobileAppWorkflow.md §2.7 — "My code" (static/never-expires or amount-locked
 * QR) and "Request from" (pick a contact, enter an amount, send a request).
 *
 * API note: the mock `requestMoney()` only models "create a request as the
 * current user" — PaymentRequest has no addressee field. So "Request from a
 * contact" folds the chosen contact's name into the request's `note` rather
 * than a real directed request; this is flagged in the handoff report.
 */
export default function RequestScreen({ navigation }: Props) {
  const theme = useTheme();
  const { snapshot, error: qpayError } = useQpayContext();
  const { recent } = useContacts();
  const { requestMoney, cancelPaymentRequest } = usePay();

  const [tab, setTab] = useState<Tab>('code');

  // ---- My code ---------------------------------------------------------
  const [qrMode, setQrMode] = useState<'static' | 'amount'>('static');
  const [qrAmountStr, setQrAmountStr] = useState('');
  const [copied, setCopied] = useState(false);

  const profile = snapshot?.profile ?? null;
  const qrAmountValue = qrAmountStr ? Number(qrAmountStr) : undefined;
  const uri = useMemo(
    () => buildQpayUri({ qpayId: profile?.qpayId ?? '', amount: qrMode === 'amount' ? qrAmountValue : undefined }),
    [profile?.qpayId, qrMode, qrAmountValue],
  );

  const copyQpayId = useCallback(() => {
    if (!profile) return;
    haptic('select');
    Clipboard.setString(profile.qpayId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [profile]);

  const shareCode = useCallback(() => {
    haptic('select');
    Share.share({ message: uri }).catch(() => {});
  }, [uri]);

  // ---- Request from ------------------------------------------------------
  const [target, setTarget] = useState<Target | null>(null);
  const [reqAmountStr, setReqAmountStr] = useState('');
  const [reqNote, setReqNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ name: string; amount: number | null; asset: string } | null>(
    null,
  );

  useFocusEffect(
    useCallback(() => {
      const pending = takePendingRequestTarget();
      if (pending) {
        setTab('from');
        setTarget(pending);
        setConfirmation(null);
      }
    }, []),
  );

  const senderAsset = profile?.primaryAsset ?? 'FXRP';
  const reqAmountValue = reqAmountStr ? Number(reqAmountStr) : 0;

  async function sendRequest() {
    if (!target) return;
    setSendError(null);
    setSending(true);
    haptic('tap');
    try {
      const note = `Requested from ${target.name}${reqNote.trim() ? ` — ${reqNote.trim()}` : ''}`;
      await requestMoney({
        amount: reqAmountValue > 0 ? reqAmountValue : undefined,
        asset: senderAsset,
        ref: `req-${Date.now()}`,
        note,
      });
      setConfirmation({ name: target.name, amount: reqAmountValue > 0 ? reqAmountValue : null, asset: senderAsset });
      setTarget(null);
      setReqAmountStr('');
      setReqNote('');
    } catch (e) {
      haptic('warning');
      setSendError(e instanceof Error ? e.message : 'Could not send this request. Please try again.');
    } finally {
      setSending(false);
    }
  }

  const handleTabChange = (v: string) => {
    haptic('select');
    setTab(v as Tab);
  };

  const openRequests = (snapshot?.paymentRequests ?? []).filter((r) => r.fromQpayId === profile?.qpayId);

  return (
    <Screen title="Request" onBack={() => navigation.goBack()}>
      <SegmentedControl
        options={[
          { label: 'My code', value: 'code' },
          { label: 'Request from', value: 'from' },
        ]}
        value={tab}
        onChange={handleTabChange}
      />

      <View style={styles.spacer} />

      <ConnectionGate error={qpayError}>
        {tab === 'code' ? (
          <View>
            <SegmentedControl
              options={[
                { label: 'Static', value: 'static' },
                { label: 'Amount', value: 'amount' },
              ]}
              value={qrMode}
              onChange={(v) => {
                haptic('select');
                setQrMode(v as 'static' | 'amount');
              }}
            />

            {qrMode === 'amount' ? (
              <View style={styles.qrAmountBlock}>
                <AmountDisplay value={qrAmountValue ?? 0} asset={senderAsset} />
                <KeypadNumeric value={qrAmountStr} onChange={setQrAmountStr} />
              </View>
            ) : null}

            <FadeIn style={styles.qrBlock}>
              <QpayQrCode value={uri} />

              <View style={styles.idRow}>
                <Text style={[typography.subtitle, { color: theme.ink }]}>{profile?.qpayId ?? ''}</Text>
                <PressableScale
                  onPress={copyQpayId}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Copy Qpay ID"
                  style={styles.iconButton}
                >
                  <Icon name="copy" size={18} color={theme.ink} />
                </PressableScale>
              </View>
              <Toast message="Copied" visible={copied} />

              <StatusTag
                label={qrMode === 'static' ? 'Never expires' : 'Amount locked'}
                emphasis={qrMode === 'static' ? 'solid' : 'outline'}
              />

              <Button label="Share code" variant="secondary" onPress={shareCode} style={styles.shareButton} />
            </FadeIn>

            <View style={styles.hintBlock}>
              <SectionLabel>How this works</SectionLabel>
              <Card variant="flat">
                <Text style={[typography.body, styles.hint, { color: theme.muted }]}>
                  {qrMode === 'static'
                    ? 'Print this once and leave it on the counter. It never expires — whoever scans it types the amount.'
                    : 'Locks the amount for this one payment. Use it once the total is already known.'}
                </Text>
              </Card>
            </View>
          </View>
        ) : (
          <View>
            {confirmation ? (
              <RequestConfirmation confirmation={confirmation} onNewRequest={() => setConfirmation(null)} />
            ) : target ? (
              <View>
                <View style={styles.recipientRow}>
                  <Avatar name={target.name} size={44} />
                  <View style={styles.recipientText}>
                    <Text style={[typography.bodyMedium, { color: theme.ink }]} numberOfLines={1}>
                      {target.name}
                    </Text>
                    <Text style={[typography.label, { color: theme.muted }]} numberOfLines={1}>
                      {target.qpayId}
                    </Text>
                  </View>
                </View>

                <View style={styles.amountBlock}>
                  <AmountDisplay value={reqAmountValue} asset={senderAsset} size="display" />
                </View>

                <Input
                  label="Add a note"
                  value={reqNote}
                  onChangeText={setReqNote}
                  placeholder="What's it for?"
                  containerStyle={styles.noteField}
                />

                <KeypadNumeric value={reqAmountStr} onChange={setReqAmountStr} />

                {sendError ? (
                  <FadeIn style={[styles.notice, { borderColor: theme.ink }]}>
                    <Icon name="alert" size={16} color={theme.ink} />
                    <Text style={[typography.label, styles.noticeText, { color: theme.ink }]}>{sendError}</Text>
                  </FadeIn>
                ) : null}

                <View style={styles.requestActions}>
                  <Button
                    label="Send request"
                    onPress={sendRequest}
                    loading={sending}
                    disabled={reqAmountValue <= 0}
                  />
                  <Button label="Choose someone else" variant="ghost" onPress={() => setTarget(null)} />
                </View>
              </View>
            ) : (
              <View>
                {recent.length > 0 ? (
                  <View style={styles.recentBlock}>
                    <SectionLabel>Recent</SectionLabel>
                    <View style={styles.chipRow}>
                      <Stagger interval={30} direction="right" distance={10}>
                        {recent.map((c) => (
                          <ContactChip
                            key={c.id}
                            name={c.name}
                            subtitle={c.qpayId}
                            onPress={() => setTarget({ qpayId: c.qpayId, name: c.name })}
                          />
                        ))}
                      </Stagger>
                    </View>
                  </View>
                ) : null}

                <Button
                  label="Choose a contact"
                  variant="secondary"
                  onPress={() => navigation.navigate('ContactPicker', { mode: 'request' })}
                  style={styles.chooseButton}
                />

                <View style={styles.requestsBlock}>
                  <SectionLabel>Your requests</SectionLabel>
                  {openRequests.length === 0 ? (
                    <EmptyState icon="request" title="No requests yet" body="Requests you send will show up here." />
                  ) : (
                    <Stagger interval={35} distance={10}>
                      {openRequests.map((r) => (
                        <RequestRow key={r.id} request={r} onCancel={() => cancelPaymentRequest(r.id)} />
                      ))}
                    </Stagger>
                  )}
                </View>
              </View>
            )}
          </View>
        )}
      </ConnectionGate>
    </Screen>
  );
}

/** Springs the checkmark in and fires the success haptic once, matching SendScreen's success moment. */
function RequestConfirmation({
  confirmation,
  onNewRequest,
}: {
  confirmation: { name: string; amount: number | null; asset: string };
  onNewRequest: () => void;
}) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    haptic('success');
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, ...motion.spring.gentle }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.durations.base,
        easing: motion.easing.decelerate,
        useNativeDriver: true,
      }),
    ]).start();
    // Mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.confirmBlock}>
      <Animated.View
        style={[styles.confirmIcon, { backgroundColor: theme.ink, opacity, transform: [{ scale }] }]}
      >
        <Icon name="check" size={32} color={theme.paper} />
      </Animated.View>
      <Text style={[typography.subtitle, { color: theme.ink }]}>Request sent</Text>
      <Text style={[typography.body, styles.confirmBody, { color: theme.muted }]}>
        {confirmation.amount != null
          ? `${formatAmount(confirmation.amount, confirmation.asset)} requested from ${confirmation.name}`
          : `Open request created for ${confirmation.name}`}
      </Text>
      <Button label="New request" onPress={onNewRequest} style={styles.newRequestButton} />
    </View>
  );
}

function RequestRow({ request, onCancel }: { request: PaymentRequest; onCancel: () => void }) {
  const theme = useTheme();
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    setCancelling(true);
    haptic('select');
    try {
      await onCancel();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Card style={styles.requestRow}>
      <View style={styles.requestRowTop}>
        <View style={styles.requestRowText}>
          <Text style={[typography.bodyMedium, { color: theme.ink }]} numberOfLines={1}>
            {request.note ?? 'Open request'}
          </Text>
          <Text style={[typography.label, { color: theme.muted }]}>
            {formatRelativeTime(request.createdAt)}
          </Text>
        </View>
        <Text style={[typography.bodyMedium, { color: theme.ink }]}>
          {request.amount != null ? formatAmount(request.amount, request.asset) : 'Any amount'}
        </Text>
      </View>
      <View style={styles.requestRowFooter}>
        <StatusTag
          label={request.status}
          emphasis={request.status === 'paid' ? 'solid' : 'outline'}
        />
        {request.status === 'open' ? (
          <Button label="Cancel" variant="ghost" onPress={handleCancel} loading={cancelling} />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  spacer: { height: spacing.lg },
  qrAmountBlock: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md },
  qrBlock: { alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: { minHeight: 0, paddingVertical: 0, paddingHorizontal: spacing.xs },
  shareButton: { alignSelf: 'stretch' },
  hintBlock: { marginTop: spacing.xl },
  hint: { lineHeight: 21 },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  recipientText: { flex: 1, gap: 2 },
  amountBlock: { alignItems: 'center', paddingVertical: spacing.lg },
  noteField: { marginBottom: spacing.lg },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  noticeText: { flex: 1 },
  requestActions: { gap: spacing.sm, marginTop: spacing.lg },
  recentBlock: { marginBottom: spacing.lg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  chooseButton: { marginBottom: spacing.xl },
  requestsBlock: { gap: spacing.sm },
  requestRow: { marginBottom: spacing.sm },
  requestRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  requestRowText: { flex: 1, gap: 2 },
  requestRowFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  confirmBlock: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl },
  confirmIcon: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  confirmBody: { textAlign: 'center' },
  newRequestButton: { marginTop: spacing.lg, alignSelf: 'stretch' },
});
