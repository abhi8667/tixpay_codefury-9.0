import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Svg, { Path, Rect, Circle, Line, Polyline } from 'react-native-svg';
import { t, space, radius } from '../theme';
import { PressableScale, money } from './motion';
import { UpiPinModal } from './UpiPinModal';
import { useAppStore } from '../../store/useAppStore';

export type UtilityType = 'electricity' | 'mobile' | 'fastag';

interface UtilityFlowModalProps {
  visible: boolean;
  utilityType: UtilityType | null;
  onClose: () => void;
  onPaySuccess: (payment: { amount: number; payeeName: string; vpa: string }) => void;
}

const ELECTRICITY_PROVIDERS = [
  { id: 'bescom', name: 'BESCOM', region: 'Bengaluru / Karnataka', vpa: 'bescom@statebank' },
  { id: 'msedcl', name: 'MSEDCL (Mahadiscom)', region: 'Maharashtra', vpa: 'msedcl@icici' },
  { id: 'tneb', name: 'TNEB (TANGEDCO)', region: 'Tamil Nadu', vpa: 'tneb@sbi' },
  { id: 'kseb', name: 'KSEB', region: 'Kerala', vpa: 'kseb@axis' },
  { id: 'bses', name: 'BSES Yamuna / Rajdhani', region: 'Delhi NCR', vpa: 'bses@paytm' },
  { id: 'adani', name: 'Adani Electricity', region: 'Mumbai Suburbs', vpa: 'adani.elec@hdfc' },
  { id: 'tata', name: 'Tata Power', region: 'Mumbai / Delhi', vpa: 'tatapower@icici' },
];

const RECHARGE_PLANS = [
  { id: 'p1', category: 'Popular', amount: 299, validity: '28 days', data: '1.5 GB/day', calls: 'Unlimited Calls', sms: '100 SMS/day' },
  { id: 'p2', category: 'Popular', amount: 479, validity: '56 days', data: '1.5 GB/day', calls: 'Unlimited Calls', sms: '100 SMS/day' },
  { id: 'p3', category: 'Unlimited', amount: 719, validity: '84 days', data: '2.0 GB/day', calls: 'Unlimited Calls', sms: '100 SMS/day' },
  { id: 'p4', category: '5G', amount: 349, validity: '28 days', data: 'Unlimited 5G Data', calls: 'Unlimited Calls', sms: '100 SMS/day' },
  { id: 'p5', category: 'Data', amount: 155, validity: 'Existing Pack', data: '12 GB Data Add-on', calls: 'No Voice', sms: 'None' },
  { id: 'p6', category: 'Validity', amount: 1799, validity: '365 days', data: '24 GB Total', calls: 'Unlimited Calls', sms: '3600 SMS/year' },
];

export const UtilityFlowModal: React.FC<UtilityFlowModalProps> = ({
  visible,
  utilityType,
  onClose,
  onPaySuccess,
}) => {
  const executePayment = useAppStore((s) => s.executePayment);

  // Common State
  const [step, setStep] = useState<number>(1);
  const [showPinModal, setShowPinModal] = useState(false);

  // Electricity State
  const [searchProvider, setSearchProvider] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<typeof ELECTRICITY_PROVIDERS[0] | null>(null);
  const [consumerNo, setConsumerNo] = useState('');
  const [elecAmount, setElecAmount] = useState('1450');

  // Mobile State
  const [mobileNo, setMobileNo] = useState('');
  const [operator, setOperator] = useState('Airtel');
  const [circle, setCircle] = useState('Karnataka');
  const [planTab, setPlanTab] = useState<'Popular' | 'Unlimited' | 'Data' | '5G' | 'Validity'>('Popular');
  const [selectedPlan, setSelectedPlan] = useState<typeof RECHARGE_PLANS[0] | null>(null);

  // FASTag State
  const [vehicleNo, setVehicleNo] = useState('KA 01 AB 1234');
  const [fastagAmount, setFastagAmount] = useState(500);
  const [customFastagAmount, setCustomFastagAmount] = useState('');

  useEffect(() => {
    if (visible) {
      setStep(1);
      setShowPinModal(false);
      setSelectedProvider(null);
      setConsumerNo('');
      setMobileNo('');
      setSelectedPlan(null);
    }
  }, [visible, utilityType]);

  if (!visible || !utilityType) return null;

  // Auto-detect mobile operator when number length >= 10
  const handleMobileNumberChange = (text: string) => {
    setMobileNo(text);
    if (text.length >= 10) {
      const firstDigit = text.replace(/[^0-9]/g, '')[0];
      if (firstDigit === '9' || firstDigit === '8') setOperator('Airtel');
      else if (firstDigit === '7') setOperator('Jio');
      else setOperator('Vi (Vodafone Idea)');
    }
  };

  const handleExecuteUtilityPayment = (finalAmount: number, payeeName: string, vpa: string) => {
    executePayment(finalAmount, payeeName, vpa);
    setShowPinModal(false);
    onClose();
    onPaySuccess({ amount: finalAmount, payeeName, vpa });
  };

  const filteredProviders = ELECTRICITY_PROVIDERS.filter(
    (p) =>
      p.name.toLowerCase().includes(searchProvider.toLowerCase()) ||
      p.region.toLowerCase().includes(searchProvider.toLowerCase())
  );

  const filteredPlans = RECHARGE_PLANS.filter((p) => p.category === planTab);

  /**
   * Android back mirrors the header's own back affordance: one step at a time,
   * closing only from the first. Wiring it straight to `onClose` would throw
   * away a half-filled biller form on a single tap.
   */
  const handleRequestClose = () => {
    if (step > 1) setStep(step - 1);
    else onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleRequestClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* ── Modal Header ─────────────────────────────────────────────── */}
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={step > 1 ? () => setStep(step - 1) : onClose}>
              <Text style={styles.backText}>{step > 1 ? '← Back' : '✕ Close'}</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {utilityType === 'electricity' && 'Electricity Bill'}
              {utilityType === 'mobile' && 'Mobile Recharge'}
              {utilityType === 'fastag' && 'FASTag Recharge'}
            </Text>
            <View style={{ width: 60 }} />
          </View>

          {/* ── ⚡ 1. ELECTRICITY FLOW ──────────────────────────────────── */}
          {utilityType === 'electricity' && (
            <ScrollView contentContainerStyle={styles.bodyScroll} showsVerticalScrollIndicator={false}>
              {step === 1 && (
                <View>
                  <Text style={styles.stepTitle}>Step 1 — Select Provider</Text>
                  <Text style={styles.stepSubtitle}>Electricity Board / Provider in your region</Text>

                  <View style={styles.searchWrap}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#718096" strokeWidth={2}>
                      <Circle cx="11" cy="11" r="8" />
                      <Line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </Svg>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search provider (e.g. BESCOM, Adani)"
                      placeholderTextColor="#64748B"
                      value={searchProvider}
                      onChangeText={setSearchProvider}
                    />
                  </View>

                  <Text style={styles.sectionHeaderLabel}>POPULAR PROVIDERS</Text>
                  {filteredProviders.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.providerRow}
                      onPress={() => {
                        setSelectedProvider(p);
                        setStep(2);
                      }}
                    >
                      <View style={styles.providerIconCircle}>
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={t.warn} strokeWidth={2}>
                          <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                        </Svg>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.providerName}>{p.name}</Text>
                        <Text style={styles.providerRegion}>{p.region}</Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {step === 2 && selectedProvider && (
                <View>
                  <Text style={styles.stepTitle}>Step 2 — Consumer Details</Text>
                  <Text style={styles.stepSubtitle}>Paying to {selectedProvider.name}</Text>

                  <Text style={styles.inputLabel}>CONSUMER NUMBER / CA NUMBER / ACCOUNT NO</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 482019385"
                    placeholderTextColor="#64748B"
                    value={consumerNo}
                    onChangeText={setConsumerNo}
                    keyboardType="numeric"
                  />

                  <Text style={styles.inputLabel}>BILL AMOUNT (₹)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="1450"
                    placeholderTextColor="#64748B"
                    value={elecAmount}
                    onChangeText={setElecAmount}
                    keyboardType="numeric"
                  />

                  <TouchableOpacity
                    style={[styles.primaryBtn, !consumerNo && styles.btnDisabled]}
                    disabled={!consumerNo}
                    onPress={() => setShowPinModal(true)}
                  >
                    <Text style={styles.primaryBtnText}>Proceed to Pay {money(parseFloat(elecAmount) || 0)}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}

          {/* ── 📱 2. MOBILE RECHARGE FLOW ───────────────────────────────── */}
          {utilityType === 'mobile' && (
            <ScrollView contentContainerStyle={styles.bodyScroll} showsVerticalScrollIndicator={false}>
              {step === 1 && (
                <View>
                  <Text style={styles.stepTitle}>Step 1 — Mobile Number</Text>
                  <Text style={styles.stepSubtitle}>Enter 10-digit mobile number to recharge</Text>

                  <Text style={styles.inputLabel}>MOBILE NUMBER</Text>
                  <View style={styles.phoneInputRow}>
                    <Text style={styles.countryCode}>+91</Text>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="98765 43210"
                      placeholderTextColor="#64748B"
                      value={mobileNo}
                      onChangeText={handleMobileNumberChange}
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                  </View>

                  {mobileNo.length >= 10 && (
                    <View style={styles.detectedBadge}>
                      <Text style={styles.detectedText}>
                        Detected: <Text style={{ color: '#60A5FA', fontWeight: '800' }}>{operator}</Text> • {circle}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.primaryBtn, mobileNo.length < 10 && styles.btnDisabled]}
                    disabled={mobileNo.length < 10}
                    onPress={() => setStep(2)}
                  >
                    <Text style={styles.primaryBtnText}>Continue to Select Plan</Text>
                  </TouchableOpacity>
                </View>
              )}

              {step === 2 && (
                <View>
                  <View style={styles.metaBanner}>
                    <Text style={styles.metaBannerText}>+91 {mobileNo} • {operator} ({circle})</Text>
                  </View>

                  <Text style={styles.stepTitle}>Step 2 — Select Plan</Text>

                  {/* Plan Tabs */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.planTabRow}>
                    {(['Popular', 'Unlimited', '5G', 'Data', 'Validity'] as const).map((tab) => (
                      <TouchableOpacity
                        key={tab}
                        style={[styles.planTabPill, planTab === tab && styles.planTabPillActive]}
                        onPress={() => setPlanTab(tab)}
                      >
                        <Text style={[styles.planTabText, planTab === tab && styles.planTabTextActive]}>{tab}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Plans List */}
                  {filteredPlans.map((plan) => (
                    <TouchableOpacity
                      key={plan.id}
                      style={styles.planCard}
                      onPress={() => {
                        setSelectedPlan(plan);
                        setShowPinModal(true);
                      }}
                    >
                      <View style={styles.planCardHeader}>
                        <Text style={styles.planPrice}>{money(plan.amount)}</Text>
                        <View style={styles.validityBadge}>
                          <Text style={styles.validityText}>{plan.validity}</Text>
                        </View>
                      </View>
                      <Text style={styles.planMeta}>{plan.data} • {plan.calls}</Text>
                      <Text style={styles.planSub}>{plan.sms}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          )}

          {/* ── 🚗 3. FASTAG RECHARGE FLOW ───────────────────────────────── */}
          {utilityType === 'fastag' && (
            <ScrollView contentContainerStyle={styles.bodyScroll} showsVerticalScrollIndicator={false}>
              {step === 1 && (
                <View>
                  <Text style={styles.stepTitle}>Step 1 — FASTag Identification</Text>
                  <Text style={styles.stepSubtitle}>Enter Vehicle Registration Number</Text>

                  <Text style={styles.inputLabel}>VEHICLE NUMBER</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="KA 01 AB 1234"
                    placeholderTextColor="#64748B"
                    value={vehicleNo}
                    onChangeText={setVehicleNo}
                    autoCapitalize="characters"
                  />

                  <TouchableOpacity
                    style={[styles.primaryBtn, !vehicleNo && styles.btnDisabled]}
                    disabled={!vehicleNo}
                    onPress={() => setStep(2)}
                  >
                    <Text style={styles.primaryBtnText}>Fetch FASTag Details</Text>
                  </TouchableOpacity>
                </View>
              )}

              {step === 2 && (
                <View>
                  {/* Linked FASTag Details Card */}
                  <View style={styles.fastagDetailsCard}>
                    <View style={styles.fastagHeaderRow}>
                      <View>
                        <Text style={styles.vehicleNoText}>{vehicleNo.toUpperCase()}</Text>
                        <Text style={styles.issuerText}>HDFC Bank FASTag</Text>
                      </View>
                      <View style={styles.tagBadge}>
                        <Text style={styles.tagBadgeText}>FASTag</Text>
                      </View>
                    </View>

                    <View style={styles.balRow}>
                      <Text style={styles.balLabel}>Available Balance</Text>
                      <Text style={styles.balVal}>₹184</Text>
                    </View>

                    <View style={styles.lowBalBadge}>
                      <Text style={styles.lowBalText}>⚠️ Low Balance • Recharge recommended</Text>
                    </View>
                  </View>

                  <Text style={styles.stepTitle}>Step 2 — Select Recharge Amount</Text>
                  <View style={styles.chipRow}>
                    {[200, 500, 1000].map((amt) => (
                      <TouchableOpacity
                        key={amt}
                        style={[styles.chip, fastagAmount === amt && styles.chipActive]}
                        onPress={() => setFastagAmount(amt)}
                      >
                        <Text style={[styles.chipText, fastagAmount === amt && styles.chipTextActive]}>₹{amt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowPinModal(true)}>
                    <Text style={styles.primaryBtnText}>Recharge {money(fastagAmount)}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}

          {/* ── UPI PIN Gate Modal ────────────────────────────────────────── */}
          <UpiPinModal
            visible={showPinModal}
            title={
              utilityType === 'electricity'
                ? `Pay Electricity Bill ${money(parseFloat(elecAmount) || 0)}`
                : utilityType === 'mobile'
                ? `Recharge Mobile ${money(selectedPlan?.amount || 299)}`
                : `Recharge FASTag ${money(fastagAmount)}`
            }
            subtitle={
              utilityType === 'electricity'
                ? `To ${selectedProvider?.name || 'BESCOM'}`
                : utilityType === 'mobile'
                ? `To ${operator} (${mobileNo})`
                : `To HDFC FASTag (${vehicleNo.toUpperCase()})`
            }
            onSuccess={() => {
              const amt =
                utilityType === 'electricity'
                  ? parseFloat(elecAmount) || 1450
                  : utilityType === 'mobile'
                  ? selectedPlan?.amount || 299
                  : fastagAmount;

              const payee =
                utilityType === 'electricity'
                  ? selectedProvider?.name || 'BESCOM Electricity'
                  : utilityType === 'mobile'
                  ? `${operator} Mobile (${mobileNo})`
                  : `HDFC FASTag (${vehicleNo.toUpperCase()})`;

              const vpa =
                utilityType === 'electricity'
                  ? selectedProvider?.vpa || 'bescom@statebank'
                  : utilityType === 'mobile'
                  ? 'recharge@upi'
                  : 'netc.fastag@icici';

              handleExecuteUtilityPayment(amt, payee, vpa);
            }}
            onCancel={() => setShowPinModal(false)}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '88%',
    backgroundColor: '#0A0C10',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.md,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backBtn: { paddingVertical: 4 },
  backText: { color: t.warn, fontSize: 13, fontWeight: '700' },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  bodyScroll: { padding: space.md, paddingBottom: 48 },

  stepTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 4 },
  stepSubtitle: { color: t.textDim, fontSize: 12, marginTop: 2, marginBottom: space.md },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111622',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: space.md,
  },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 13, marginLeft: 8 },

  sectionHeaderLabel: { color: t.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111622',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
    marginBottom: space.xs,
    gap: 12,
  },
  providerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerName: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  providerRegion: { color: t.textDim, fontSize: 11, marginTop: 2 },
  chevron: { color: t.textDim, fontSize: 18 },

  inputLabel: { color: t.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginTop: space.sm, marginBottom: 6 },
  textInput: {
    backgroundColor: '#111622',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: space.md,
  },

  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111622',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    marginBottom: space.xs,
  },
  countryCode: { color: t.warn, fontSize: 16, fontWeight: '800', marginRight: 10 },
  phoneInput: { flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '700', paddingVertical: 12 },
  detectedBadge: {
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
    marginBottom: space.md,
  },
  detectedText: { color: t.textDim, fontSize: 11 },

  metaBanner: {
    backgroundColor: '#111622',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: space.sm,
    marginBottom: space.sm,
  },
  metaBannerText: { color: t.warn, fontSize: 12, fontWeight: '700' },

  planTabRow: { flexDirection: 'row', gap: 8, marginBottom: space.md },
  planTabPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#111622',
    marginRight: 6,
  },
  planTabPillActive: { backgroundColor: t.warn, borderColor: t.warn },
  planTabText: { color: t.textDim, fontSize: 12, fontWeight: '600' },
  planTabTextActive: { color: '#000000', fontWeight: '800' },

  planCard: {
    backgroundColor: '#111622',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  planCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planPrice: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  validityBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#34D399',
  },
  validityText: { color: '#34D399', fontSize: 10, fontWeight: '800' },
  planMeta: { color: t.text, fontSize: 12, fontWeight: '600', marginTop: 6 },
  planSub: { color: t.textDim, fontSize: 11, marginTop: 2 },

  fastagDetailsCard: {
    backgroundColor: '#111622',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  fastagHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vehicleNoText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.8 },
  issuerText: { color: t.textDim, fontSize: 11, marginTop: 2 },
  tagBadge: { backgroundColor: t.warn, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  tagBadgeText: { color: '#000000', fontSize: 10, fontWeight: '800' },
  balRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm, paddingTop: space.xs, borderTopWidth: 1, borderTopColor: '#1E293B' },
  balLabel: { color: t.textFaint, fontSize: 11 },
  balVal: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  lowBalBadge: { backgroundColor: 'rgba(245, 165, 36, 0.15)', padding: 6, borderRadius: 6, borderWidth: 1, borderColor: t.warn, marginTop: space.xs },
  lowBalText: { color: t.warn, fontSize: 11, fontWeight: '700' },

  chipRow: { flexDirection: 'row', gap: 10, marginBottom: space.md },
  chip: { flex: 1, paddingVertical: 12, backgroundColor: '#111622', borderWidth: 1, borderColor: '#1E293B', borderRadius: radius.sm, alignItems: 'center' },
  chipActive: { backgroundColor: t.warn, borderColor: t.warn },
  chipText: { color: t.textDim, fontSize: 14, fontWeight: '700' },
  chipTextActive: { color: '#000000', fontWeight: '800' },

  primaryBtn: {
    backgroundColor: t.warn,
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: space.sm,
  },
  primaryBtnText: { color: '#000000', fontSize: 14, fontWeight: '800' },
  btnDisabled: { opacity: 0.45 },
});
