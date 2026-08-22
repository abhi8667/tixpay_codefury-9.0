import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { t, space, radius } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { FadeIn, PressableScale, money } from '../components/motion';
import { useAppStore } from '../../store/useAppStore';

interface BankScreenProps {
  onBack?: () => void;
  onOpenMandates?: () => void;
}

export const BankScreen: React.FC<BankScreenProps> = ({ onBack, onOpenMandates }) => {
  const imported = useAppStore((s) => s.imported);
  const cardsList = useAppStore((s) => s.cardsList);
  const addCard = useAppStore((s) => s.addCard);
  const loadSampleStatement = useAppStore((s) => s.loadSampleStatement);
  const pipelineCache = useAppStore((s) => s._pipelineCache);
  const getLedger = useAppStore((s) => s.ledger);
  const getMandates = useAppStore((s) => s.mandates);

  const ledger = useMemo(() => getLedger(), [getLedger, pipelineCache]);
  const mandates = useMemo(() => getMandates(), [getMandates, pipelineCache]);

  const bankName = imported?.bank ?? 'HDFC Bank';
  const accountTail = imported?.accountTail ?? '4471';
  const rowCount = imported?.rows ?? 267;
  const currentBalance = ledger?.currentBalance ?? 21597;

  // Modal States
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showAddCardModal, setShowAddCardModal] = useState(false);

  // New Card Form
  const [newCardName, setNewCardName] = useState('');
  const [newCardNetwork, setNewCardNetwork] = useState<'AMEX' | 'RUPAY' | 'VISA' | 'MASTERCARD'>('VISA');
  const [newCardReward, setNewCardReward] = useState('2.0');
  const [isUpiLinkable, setIsUpiLinkable] = useState(false);

  const handleCreateCard = () => {
    if (!newCardName.trim()) return;
    addCard({
      id: `card-${Date.now()}`,
      name: newCardName.trim(),
      network: newCardNetwork,
      upiLinkable: isUpiLinkable || newCardNetwork === 'RUPAY',
      rewardRate: parseFloat(newCardReward) || 1.5,
      categoryRates: {},
      mccExclusions: [],
    });
    setNewCardName('');
    setShowAddCardModal(false);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Bank & Accounts" onBack={onBack} subtitle="Reconciled Bank Accounts & Cards" />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── 1. Primary Reconciled Bank Account ─────────────────────────── */}
        <FadeIn delay={0}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Primary Bank Account</Text>
            <PressableScale style={styles.addBtn} onPress={() => setShowAddAccountModal(true)}>
              <Text style={styles.addBtnText}>+ Add Account</Text>
            </PressableScale>
          </View>

          <View style={styles.accountCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.bankBadge}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={t.warn} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M3 21h18" />
                  <Path d="M3 10h18" />
                  <Path d="M5 6l7-3 7 3" />
                  <Path d="M4 10v11" />
                  <Path d="M20 10v11" />
                </Svg>
                <Text style={styles.bankName}>{bankName}</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>0 Drift Verified</Text>
              </View>
            </View>

            <Text style={styles.accountTailText}>Account ending in •••• {accountTail}</Text>

            <View style={styles.balanceSection}>
              <Text style={styles.balanceLabel}>RECONCILED BALANCE</Text>
              <Text style={styles.balanceValue}>{money(currentBalance)}</Text>
            </View>

            <View style={styles.cardMetaRow}>
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Statement Rows</Text>
                <Text style={styles.metaValue}>{rowCount} txns read</Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Active Mandates</Text>
                <Text style={styles.metaValue}>{mandates.length} auto-debits</Text>
              </View>
            </View>
          </View>
        </FadeIn>

        {/* ── 2. Linked Cards & Payment Rails ────────────────────────────── */}
        <FadeIn delay={60}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Linked Cards &amp; UPI Rails</Text>
            <PressableScale style={styles.addBtn} onPress={() => setShowAddCardModal(true)}>
              <Text style={styles.addBtnText}>+ Add Card</Text>
            </PressableScale>
          </View>

          {cardsList.map((card) => (
            <View key={card.id} style={styles.creditCardBox}>
              <View style={styles.creditCardHeader}>
                <View>
                  <Text style={styles.cardTitle}>{card.name}</Text>
                  <Text style={styles.cardNetworkText}>{card.network} • {card.upiLinkable ? 'UPI Enabled' : 'Swipe / Tap Only'}</Text>
                </View>
                {card.upiLinkable ? (
                  <View style={styles.upiBadge}>
                    <Text style={styles.upiBadgeText}>UPI</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.cardRewardRow}>
                <Text style={styles.rewardText}>Base Reward Rate: {card.rewardRate}%</Text>
                {card.ytdSpend ? (
                  <Text style={styles.waiverText}>
                    YTD Spend: {money(card.ytdSpend)} / {money(card.feeWaiverThreshold ?? 100000)}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </FadeIn>

        {/* ── 3. Connected Mandates Preview ──────────────────────────────── */}
        <FadeIn delay={120}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Bank Mandates ({mandates.length})</Text>
            <PressableScale onPress={onOpenMandates}>
              <Text style={styles.linkText}>View All →</Text>
            </PressableScale>
          </View>

          {mandates.slice(0, 3).map((mandate) => (
            <View key={mandate.id} style={styles.mandateRow}>
              <View style={styles.mandateIconCircle}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={t.warn} strokeWidth={2}>
                  <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mandateTitle}>{mandate.displayName}</Text>
                <Text style={styles.mandateSubtext}>{mandate.cadence} • Next debit on {mandate.nextDebit.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
              </View>
              <Text style={styles.mandateAmount}>{money(mandate.amount)}</Text>
            </View>
          ))}
        </FadeIn>
      </ScrollView>

      {/* ── 4. Add Bank Account Modal ─────────────────────────────────────── */}
      <Modal visible={showAddAccountModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Link Bank Account</Text>
            <Text style={styles.modalSubtitle}>Import a bank statement file (CSV) to analyze account cash flows on-device.</Text>

            <PressableScale
              style={styles.sampleBankBtn}
              onPress={() => {
                loadSampleStatement();
                setShowAddAccountModal(false);
              }}
            >
              <Text style={styles.sampleBankBtnText}>Import HDFC Sample Account (••4471)</Text>
            </PressableScale>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddAccountModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── 5. Add Card Modal ─────────────────────────────────────────────── */}
      <Modal visible={showAddCardModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Credit / Debit Card</Text>

            <Text style={styles.inputLabel}>CARD NAME</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Axis Atlas Credit Card"
              placeholderTextColor="#64748B"
              value={newCardName}
              onChangeText={setNewCardName}
            />

            <Text style={styles.inputLabel}>CARD NETWORK</Text>
            <View style={styles.networkRow}>
              {(['VISA', 'MASTERCARD', 'RUPAY', 'AMEX'] as const).map((net) => (
                <TouchableOpacity
                  key={net}
                  style={[styles.networkPill, newCardNetwork === net && styles.networkPillActive]}
                  onPress={() => {
                    setNewCardNetwork(net);
                    if (net === 'RUPAY') setIsUpiLinkable(true);
                  }}
                >
                  <Text style={[styles.networkPillText, newCardNetwork === net && styles.networkPillTextActive]}>{net}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>BASE REWARD RATE (%)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="2.0"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              value={newCardReward}
              onChangeText={setNewCardReward}
            />

            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleCreateCard}>
              <Text style={styles.modalSubmitText}>Save Card</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddCardModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  content: { flex: 1 },
  scrollContent: { padding: space.md, paddingBottom: 48 },

  sectionTitle: {
    color: t.text,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.md,
    marginBottom: space.sm,
  },
  addBtn: {
    backgroundColor: 'rgba(245, 165, 36, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: t.warn,
  },
  addBtnText: {
    color: t.warn,
    fontSize: 12,
    fontWeight: '700',
  },
  linkText: {
    color: t.warn,
    fontSize: 12,
    fontWeight: '700',
  },

  // Account Card
  accountCard: {
    backgroundColor: '#111622',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bankName: {
    color: t.text,
    fontSize: 16,
    fontWeight: '700',
  },
  verifiedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  verifiedText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  accountTailText: {
    color: t.textDim,
    fontSize: 13,
    marginTop: 6,
  },
  balanceSection: {
    marginTop: space.md,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  balanceLabel: {
    color: t.textFaint,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  balanceValue: {
    color: t.text,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.md,
    backgroundColor: '#0A0C10',
    padding: space.sm,
    borderRadius: radius.sm,
  },
  metaCol: {},
  metaLabel: {
    color: t.textFaint,
    fontSize: 10,
  },
  metaValue: {
    color: t.textDim,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },

  // Credit Cards
  creditCardBox: {
    backgroundColor: '#111622',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  creditCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: t.text,
    fontSize: 14,
    fontWeight: '700',
  },
  cardNetworkText: {
    color: t.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  upiBadge: {
    backgroundColor: 'rgba(245, 165, 36, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: t.warn,
  },
  upiBadgeText: {
    color: t.warn,
    fontSize: 10,
    fontWeight: '800',
  },
  cardRewardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.sm,
    paddingTop: space.xs,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  rewardText: {
    color: t.textDim,
    fontSize: 11,
  },
  waiverText: {
    color: t.warn,
    fontSize: 11,
    fontWeight: '600',
  },

  // Mandate Row
  mandateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111622',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
    marginBottom: space.xs,
    gap: 10,
  },
  mandateIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mandateTitle: {
    color: t.text,
    fontSize: 13,
    fontWeight: '600',
  },
  mandateSubtext: {
    color: t.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  mandateAmount: {
    color: t.text,
    fontSize: 13,
    fontWeight: '700',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.md,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#111622',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: space.lg,
  },
  modalTitle: {
    color: t.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: t.textDim,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: space.md,
  },
  sampleBankBtn: {
    backgroundColor: t.warn,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginBottom: space.sm,
  },
  sampleBankBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  inputLabel: {
    color: t.textFaint,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: space.sm,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#0A0C10',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: t.text,
    fontSize: 13,
  },
  networkRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  networkPill: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#0A0C10',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  networkPillActive: {
    backgroundColor: 'rgba(245, 165, 36, 0.15)',
    borderColor: t.warn,
  },
  networkPillText: {
    color: t.textDim,
    fontSize: 10,
    fontWeight: '700',
  },
  networkPillTextActive: {
    color: t.warn,
  },
  modalSubmitBtn: {
    backgroundColor: t.warn,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: space.md,
    marginBottom: space.xs,
  },
  modalSubmitText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: t.textDim,
    fontSize: 13,
  },
});
