import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { useAppStore, type Payee } from '../../store/useAppStore';
import { redact } from '../utils/redaction';
import { formatIstDate } from '@tixpay/engine';
import { FadeIn, PressableScale, EmptyState, money } from '../components/motion';

export interface PayTarget {
  name: string;
  vpa: string;
  /** Prefill for the amount step. Set by a QR that carried one. */
  amount?: number;
}

interface PayeePickerProps {
  onSelect: (target: PayTarget) => void;
  onScan: () => void;
}

/** A payment address, loosely. Deliberately permissive about the handle. */
const VPA_PATTERN = /^[a-z0-9][a-z0-9._-]{1,}@[a-z][a-z0-9.-]{1,}$/i;

/** Colour a payee's initial ring so a long list is scannable. */
const AVATAR_COLORS = ['#5B8DEF', '#2DD4A0', '#F5A524', '#C084FC', '#F0553D', '#38BDF8'];
const colorFor = (key: string): string => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % 997;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
};

/**
 * Who to pay.
 *
 * This screen exists because the Pay tab used to open straight onto a
 * hardcoded 'Croma Electronics / croma.store@ybl' with ₹8,000 already typed
 * in. That was staging for one demo beat, and it made the whole tab read as a
 * mock: there was no way to pay anybody else, and the one payee had no
 * relationship to the statement the user had just imported.
 *
 * The recents below are real — every counterparty the imported statement
 * actually paid, ranked by recency, with the count and total the file states.
 */
export const PayeePicker: React.FC<PayeePickerProps> = ({ onSelect, onScan }) => {
  const payeesFor = useAppStore((s) => s.payees);
  const pipelineCache = useAppStore((s) => s._pipelineCache);
  const redactionOn = useAppStore((s) => s.redactionOn);
  const accountTail = useAppStore((s) => s.ledger()?.accountTail);

  const [query, setQuery] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualVpa, setManualVpa] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // `payees()` builds a fresh array, so it must not be selected directly — the
  // new reference on every render would re-render forever. The cache is the
  // stable thing that changes exactly when the data does.
  const payees = useMemo(() => payeesFor(40), [payeesFor, pipelineCache]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return payees;
    return payees.filter(
      (p) => p.name.toLowerCase().includes(q) || p.vpa.toLowerCase().includes(q),
    );
  }, [payees, query]);

  const queryIsAddress = VPA_PATTERN.test(query.trim());

  const submitManual = () => {
    const vpa = manualVpa.trim().toLowerCase();
    if (!VPA_PATTERN.test(vpa)) {
      setManualError('That does not look like a UPI ID. Try name@bank.');
      return;
    }
    setManualError(null);
    onSelect({ name: manualName.trim() || vpa.split('@')[0]!, vpa });
  };

  const renderPayee = (p: Payee, index: number) => (
    <FadeIn key={p.id} delay={Math.min(index * 18, 220)}>
      <PressableScale
        style={styles.payeeRow}
        onPress={() => onSelect({ name: p.name, vpa: p.vpa })}
        accessibilityLabel={`Pay ${p.name}`}
      >
        <View style={[styles.avatar, { borderColor: colorFor(p.id) }]}>
          <Text style={[styles.avatarText, { color: colorFor(p.id) }]}>
            {p.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.payeeMeta}>
          <Text style={styles.payeeName} numberOfLines={1}>
            {p.name}
          </Text>
          <Text style={styles.payeeVpa} numberOfLines={1}>
            {redactionOn ? redact.vpa(p.vpa) : p.vpa}
          </Text>
        </View>
        <View style={styles.payeeRight}>
          <Text style={styles.payeeLast}>{money(p.lastAmount)}</Text>
          <Text style={styles.payeeWhen}>
            {p.timesPaid > 1 ? `${p.timesPaid}× · ` : ''}
            {formatIstDate(p.lastPaid)}
          </Text>
        </View>
      </PressableScale>
    </FadeIn>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search a payee, or type a UPI ID"
          placeholderTextColor={t.textFaint}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* A typed address is payable directly — no reason to make the user open
          the manual form for something they have already finished typing. */}
      {queryIsAddress && (
        <PressableScale
          style={styles.directPay}
          onPress={() => onSelect({ name: query.trim().split('@')[0]!, vpa: query.trim().toLowerCase() })}
        >
          <Text style={styles.directPayText}>Pay {query.trim()} →</Text>
        </PressableScale>
      )}

      <View style={styles.actionsRow}>
        <PressableScale style={styles.actionCard} onPress={onScan} accessibilityLabel="Scan a QR code">
          <Text style={styles.actionIcon}>📷</Text>
          <Text style={styles.actionLabel}>Scan QR</Text>
        </PressableScale>
        <PressableScale
          style={styles.actionCard}
          onPress={() => {
            setManualMode((v) => !v);
            setManualError(null);
          }}
          accessibilityLabel="Enter a UPI ID"
        >
          <Text style={styles.actionIcon}>⌨️</Text>
          <Text style={styles.actionLabel}>UPI ID</Text>
        </PressableScale>
        <PressableScale
          style={styles.actionCard}
          onPress={() =>
            onSelect({
              name: 'Your own account',
              vpa: `self${accountTail ?? ''}@tixpay`,
            })
          }
          accessibilityLabel="Pay yourself"
        >
          <Text style={styles.actionIcon}>🔁</Text>
          <Text style={styles.actionLabel}>Self</Text>
        </PressableScale>
      </View>

      {manualMode && (
        <FadeIn style={styles.manualCard}>
          <Text style={styles.manualLabel}>UPI ID</Text>
          <TextInput
            value={manualVpa}
            onChangeText={(v) => {
              setManualVpa(v);
              setManualError(null);
            }}
            placeholder="name@okhdfcbank"
            placeholderTextColor={t.textFaint}
            style={styles.manualInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.manualLabel}>Name (optional)</Text>
          <TextInput
            value={manualName}
            onChangeText={setManualName}
            placeholder="Who is this?"
            placeholderTextColor={t.textFaint}
            style={styles.manualInput}
          />
          {manualError ? <Text style={styles.manualError}>{manualError}</Text> : null}
          <PressableScale style={styles.manualBtn} onPress={submitManual}>
            <Text style={styles.manualBtnText}>Continue</Text>
          </PressableScale>
        </FadeIn>
      )}

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <Text style={styles.sectionTitle}>
          {query ? 'Matching payees' : 'Paid before, from your statement'}
        </Text>

        {filtered.length === 0 ? (
          <EmptyState
            icon={payees.length === 0 ? '📄' : '🔍'}
            title={payees.length === 0 ? 'No payees yet' : 'Nobody matches that'}
            body={
              payees.length === 0
                ? 'Recent payees are read from the statement you imported. This one lists no outgoing payments we could address.'
                : 'Nothing in your statement matches that name or UPI ID.'
            }
            hint={
              payees.length === 0
                ? 'You can still scan a QR or type a UPI ID above.'
                : 'Type a full UPI ID to pay someone new.'
            }
          />
        ) : (
          filtered.map(renderPayee)
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    marginHorizontal: space.md,
    marginTop: space.md,
    height: 46,
  },
  searchIcon: { fontSize: 14, marginRight: space.sm },
  searchInput: { flex: 1, color: t.text, fontSize: 15, padding: 0 },
  directPay: {
    marginHorizontal: space.md,
    marginTop: space.sm,
    backgroundColor: '#1E190E',
    borderColor: t.warn,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  directPayText: { color: t.warn, fontSize: 14, fontWeight: '700' },
  actionsRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.md,
    marginTop: space.md,
  },
  actionCard: {
    flex: 1,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  actionIcon: { fontSize: 20, marginBottom: 4 },
  actionLabel: { color: t.text, fontSize: 12, fontWeight: '600' },
  manualCard: {
    marginHorizontal: space.md,
    marginTop: space.sm,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  manualLabel: { color: t.textDim, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  manualInput: {
    color: t.text,
    fontSize: 15,
    backgroundColor: t.surfaceHi,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 10,
    marginBottom: space.sm,
  },
  manualError: { color: t.danger, fontSize: 12, marginBottom: space.sm },
  manualBtn: {
    backgroundColor: t.warn,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  manualBtnText: { color: '#000000', fontSize: 14, fontWeight: '800' },
  list: { flex: 1, marginTop: space.md },
  listContent: { paddingHorizontal: space.md, paddingBottom: 32 },
  sectionTitle: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: space.sm,
  },
  payeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: t.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  avatarText: { fontSize: 16, fontWeight: '800' },
  payeeMeta: { flex: 1, marginRight: space.sm },
  payeeName: { color: t.text, fontSize: 14, fontWeight: '600' },
  payeeVpa: { color: t.textDim, fontSize: 11, marginTop: 1 },
  payeeRight: { alignItems: 'flex-end' },
  payeeLast: { color: t.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  payeeWhen: { color: t.textFaint, fontSize: 10, marginTop: 1 },
});
