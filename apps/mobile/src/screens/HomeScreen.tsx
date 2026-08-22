import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  ImageBackground,
  TouchableOpacity,
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { t, space, radius } from '../theme';
import { FadeIn, PressableScale, money } from '../components/motion';
import { useAppStore } from '../../store/useAppStore';
import { UpiPinModal } from '../components/UpiPinModal';
import { UtilityFlowModal, type UtilityType } from '../components/UtilityFlowModal';
import { PaymentSuccessScreen } from './PaymentSuccessScreen';
import type { Shortfall } from '@tixpay/types';

interface HomeScreenProps {
  onOpenScan: () => void;
  onOpenPayContact: (vpa: string, payeeName: string) => void;
  onOpenInsights: () => void;
  onOpenKeeper: () => void;
  onOpenMandates: () => void;
  onOpenChat: () => void;
  onTapDip: (shortfall: Shortfall) => void;
}

// Fallback sample contacts if transaction payees are not populated yet
const SAMPLE_CONTACTS = [
  { id: '1', name: 'Tarun Aadhitya', vpa: 'tarun@upi', initial: 'T', color: '#8B5CF6' },
  { id: '2', name: 'Anshul Rajni', vpa: 'anshul@upi', initial: 'A', color: '#EC4899' },
  { id: '3', name: 'Ekansh Nandi', vpa: 'ekansh@upi', initial: 'E', color: '#3B82F6' },
  { id: '4', name: 'Kiran M C', vpa: 'kiran@upi', initial: 'K', color: '#10B981' },
  { id: '5', name: 'BigBasket Pay', vpa: 'bigbasket@payu', initial: 'B', color: '#F59E0B' },
];

const UTILITY_ITEMS = [
  { id: 'electricity', label: 'Electricity', icon: '⚡', vpa: 'bescom@statebank', name: 'BESCOM Electricity' },
  { id: 'mobile', label: 'Mobile Recharge', icon: '📱', vpa: 'jio.recharge@upi', name: 'Jio Mobile Recharge' },
  { id: 'fastag', label: 'FASTag', icon: '🚗', vpa: 'netc.fastag@icici', name: 'NHAI FASTag Recharge' },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenScan,
  onOpenPayContact,
  onOpenInsights,
  onOpenKeeper,
  onOpenMandates,
  onOpenChat,
  onTapDip,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  const [utilityModalType, setUtilityModalType] = useState<UtilityType | null>(null);
  const [successPayment, setSuccessPayment] = useState<{ visible: boolean; amount: number; payeeName: string; vpa: string }>({
    visible: false,
    amount: 0,
    payeeName: '',
    vpa: '',
  });

  const pipelineCache = useAppStore((s) => s._pipelineCache);
  const getLedger = useAppStore((s) => s.ledger);
  const getShortfalls = useAppStore((s) => s.shortfalls);
  const getMandates = useAppStore((s) => s.mandates);
  const getPayees = useAppStore((s) => s.payees);
  const keeperBalance = useAppStore((s) => s.keeperBalance);

  const ledger = useMemo(() => getLedger(), [getLedger, pipelineCache]);
  const shortfalls = useMemo(() => getShortfalls(), [getShortfalls, pipelineCache]);
  const mandates = useMemo(() => getMandates(), [getMandates, pipelineCache]);
  const payeesList = useMemo(() => getPayees(8), [getPayees, pipelineCache]);

  const balance = ledger?.currentBalance ?? 21597;
  const safeToSpend = 16597;
  const activeShortfall = shortfalls.length > 0 ? shortfalls[0] : null;

  const toggleBalancePrivacy = () => {
    if (isBalanceHidden) {
      // Require PIN to unhide
      setShowPinModal(true);
    } else {
      setIsBalanceHidden(true);
    }
  };

  const contactsToDisplay =
    payeesList.length > 0
      ? payeesList.slice(0, 8).map((p, idx) => ({
          id: p.id,
          name: p.name || p.vpa.split('@')[0],
          vpa: p.vpa,
          initial: (p.name || p.vpa)[0].toUpperCase(),
          color: SAMPLE_CONTACTS[idx % SAMPLE_CONTACTS.length]?.color || '#3B82F6',
        }))
      : SAMPLE_CONTACTS;

  return (
    <View style={styles.outerWrap}>
      {/* ── Background Cyberpunk Cityscape Atmosphere ──────────────────────── */}
      <View style={styles.bgWrapper} pointerEvents="none">
        <ImageBackground
          source={require('../data/cyberpunk_city_bg.jpg')}
          style={styles.bgImage}
          resizeMode="cover"
        >
          <View style={styles.bgOverlayGradient} />
        </ImageBackground>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* ── 1. Top Bar: Branding, Avatar & Search Bar ───────────────────── */}
        <FadeIn delay={0}>
          <View style={styles.headerRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>TX</Text>
            </View>

            <View style={styles.searchBar}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#A0AEC0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx="11" cy="11" r="8" />
                <Path d="M21 21l-4.35-4.35" />
              </Svg>
              <TextInput
                style={styles.searchInput}
                placeholder="Pay any contact or VPA"
                placeholderTextColor="#718096"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <PressableScale style={styles.iconBtn} onPress={onOpenChat}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={t.warn} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </Svg>
            </PressableScale>
          </View>
        </FadeIn>

        {/* ── 2. Hero SCAN & PAY Promotional Card ─────────────────────────── */}
        <FadeIn delay={60}>
          <PressableScale style={styles.scanHeroCard} onPress={onOpenScan}>
            {/* Embedded QR background graphic */}
            <View style={styles.qrBackgroundPattern}>
              <Svg width="100%" height="100%" viewBox="0 0 200 200">
                <Path d="M10 10h50v50H10zM140 10h50v50h-50zM10 140h50v50H10z" fill="none" stroke="rgba(245,165,36,0.12)" strokeWidth={4} />
                <Path d="M25 25h20v20H25zM155 25h20v20h-20zM25 155h20v20H25z" fill="rgba(245,165,36,0.18)" />
                <Path d="M80 20h40M80 50h40M20 80v40M50 80v40M80 80h40v40H80zM140 80h40M80 140v40M120 140v40M140 140h40v40h-40z" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
              </Svg>
            </View>

            <View style={styles.scanBadgeWrap}>
              <View style={styles.qrFrame}>
                <Svg width={38} height={38} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M3 7V5a2 2 0 0 1 2-2h2" />
                  <Path d="M17 3h2a2 2 0 0 1 2 2v2" />
                  <Path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                  <Path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                  <Rect x="7" y="7" width="10" height="10" rx="1" />
                </Svg>
              </View>
              <Text style={styles.scanHeroTitle}>SCAN &amp; PAY</Text>
              <Text style={styles.scanHeroSubtitle}>Tap to scan any UPI QR code instantly</Text>
            </View>
          </PressableScale>
        </FadeIn>

        {/* ── 3. Quick Action Buttons (Check Balance, Mandates, Keeper Jar) ── */}
        <FadeIn delay={120}>
          <View style={styles.quickActionsRow}>
            <PressableScale style={styles.quickActionBtn} onPress={onOpenInsights}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={t.warn} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx="12" cy="12" r="10" />
                <Path d="M12 8v4l3 3" />
              </Svg>
              <Text style={styles.quickActionText}>Check Balance</Text>
            </PressableScale>

            <PressableScale style={styles.quickActionBtn} onPress={onOpenMandates}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </Svg>
              <Text style={styles.quickActionText}>Mandates</Text>
            </PressableScale>

            <PressableScale style={styles.quickActionBtn} onPress={onOpenKeeper}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M6 3h12v2H6z" />
                <Path d="M5 5v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5" />
              </Svg>
              <Text style={styles.quickActionText}>Keeper Jar</Text>
            </PressableScale>
          </View>
        </FadeIn>

        {/* ── 4. Everyday Utilities Grid ──────────────────────────────────── */}
        <FadeIn delay={150}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Everyday Utilities</Text>
            <Text style={styles.sectionSubtitle}>Pre-payment cash flow guard applied on all billers</Text>
          </View>

          <View style={styles.utilitiesGrid}>
            {UTILITY_ITEMS.map((u) => (
              <PressableScale
                key={u.id}
                style={styles.utilityTile}
                onPress={() => setUtilityModalType(u.id as UtilityType)}
              >
                <View style={styles.utilityIconWrap}>
                  {u.id === 'electricity' && (
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={t.warn} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </Svg>
                  )}
                  {u.id === 'mobile' && (
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <Rect x="5" y="2" width="14" height="20" rx="2" />
                      <Path d="M12 18h.01" />
                    </Svg>
                  )}
                  {u.id === 'fastag' && (
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
                      <Path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
                      <Path d="M5 9l2-4h10l2 4v6h-14z" />
                    </Svg>
                  )}
                </View>
                <Text style={styles.utilityLabel}>{u.label}</Text>
              </PressableScale>
            ))}
          </View>
        </FadeIn>

        {/* ── 5. Recent IDs Horizontal Carousel ──────────────────────────── */}
        <FadeIn delay={180}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent IDs</Text>
            <Text style={styles.sectionSubtitle}>Tap to send money directly</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contactsScroll}>
            {contactsToDisplay.map((contact, index) => (
              <PressableScale
                key={contact.id + index}
                style={styles.contactItem}
                onPress={() => onOpenPayContact(contact.vpa, contact.name)}
              >
                <View style={[styles.contactAvatar, { backgroundColor: contact.color || '#3B82F6' }]}>
                  <Text style={styles.contactInitial}>{contact.initial}</Text>
                </View>
                <Text style={styles.contactName} numberOfLines={1}>
                  {contact.name}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>
        </FadeIn>

        {/* ── 6. Account Insights Card with Eye Toggle ────────────────────── */}
        <FadeIn delay={240}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.sectionTitle}>Account Insights</Text>
              <TouchableOpacity style={styles.eyeBtn} onPress={toggleBalancePrivacy}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={t.warn} strokeWidth={2}>
                  {isBalanceHidden ? (
                    <>
                      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <Path d="M1 1l22 22" />
                    </>
                  ) : (
                    <>
                      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <Circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </Svg>
                <Text style={styles.eyeBtnText}>{isBalanceHidden ? 'Show' : 'Hide'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>On-Device 30-Day Projection</Text>
          </View>

          <View style={styles.insightsCard}>
            <View style={styles.balanceRow}>
              <View>
                <Text style={styles.cardLabel}>ACCOUNT BALANCE</Text>
                <Text style={styles.balanceValue}>{isBalanceHidden ? '₹ •••••' : money(balance)}</Text>
              </View>
              <View style={styles.safeTag}>
                <Text style={styles.safeTagLabel}>SAFE TO SPEND</Text>
                <Text style={styles.safeTagValue}>{isBalanceHidden ? '₹ •••••' : money(safeToSpend)}</Text>
              </View>
            </View>

            {activeShortfall ? (
              <PressableScale style={styles.alertBanner} onPress={() => onTapDip(activeShortfall)}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={2}>
                  <Path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </Svg>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.alertText}>
                    Potential shortfall of {money(activeShortfall.deficit)} on {activeShortfall.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                  <Text style={styles.alertSubtext}>Tap to view 1-tap remedy options</Text>
                </View>
              </PressableScale>
            ) : (
              <View style={styles.healthyBanner}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth={2}>
                  <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <Path d="M22 4L12 14.01l-3-3" />
                </Svg>
                <Text style={styles.healthyText}>Cash flow healthy for the next 30 days ({mandates.length} active mandates)</Text>
              </View>
            )}

            <View style={styles.cardFooter}>
              <Text style={styles.keeperInfo}>Keeper Reserve: {isBalanceHidden ? '₹ •••••' : money(keeperBalance > 0 ? keeperBalance : 12450)}</Text>
              <PressableScale style={styles.viewMoreBtn} onPress={onOpenInsights}>
                <Text style={styles.viewMoreText}>Full Projection →</Text>
              </PressableScale>
            </View>
          </View>
        </FadeIn>
      </ScrollView>

      {/* ── UPI PIN Verification Modal ────────────────────────────────────── */}
      <UpiPinModal
        visible={showPinModal}
        title="UPI PIN Required"
        subtitle="Enter 4-digit UPI PIN to view account balance"
        onSuccess={() => {
          setIsBalanceHidden(false);
          setShowPinModal(false);
        }}
        onCancel={() => setShowPinModal(false)}
      />

      <UtilityFlowModal
        visible={!!utilityModalType}
        utilityType={utilityModalType}
        onClose={() => setUtilityModalType(null)}
        onPaySuccess={(payment) => {
          setSuccessPayment({
            visible: true,
            amount: payment.amount,
            payeeName: payment.payeeName,
            vpa: payment.vpa,
          });
        }}
      />

      <PaymentSuccessScreen
        visible={successPayment.visible}
        amount={successPayment.amount}
        payeeName={successPayment.payeeName}
        vpa={successPayment.vpa}
        onDismiss={() =>
          setSuccessPayment({ visible: false, amount: 0, payeeName: '', vpa: '' })
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrap: {
    flex: 1,
    backgroundColor: '#05070A',
  },
  bgWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  bgOverlayGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 7, 10, 0.45)',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: space.md,
    paddingBottom: 44,
  },

  // 1. Top Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.md,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#161C2C',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 165, 36, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: t.warn,
    fontWeight: '800',
    fontSize: 13,
  },
  searchBar: {
    flex: 1,
    height: 44,
    backgroundColor: 'rgba(17, 22, 34, 0.85)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: t.text,
    fontSize: 13,
    marginLeft: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(17, 22, 34, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 2. Scan & Pay Hero Card
  scanHeroCard: {
    height: 190,
    backgroundColor: 'rgba(18, 22, 36, 0.85)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 165, 36, 0.45)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: space.md,
    position: 'relative',
    shadowColor: t.warn,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  qrBackgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.65,
  },
  scanBadgeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  qrFrame: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: t.warn,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: t.warn,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  scanHeroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  scanHeroSubtitle: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    marginTop: 4,
  },

  // 3. Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: space.md,
    gap: 10,
  },
  quickActionBtn: {
    flex: 1,
    height: 52,
    backgroundColor: 'rgba(17, 22, 34, 0.88)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // 4. Utilities Grid
  utilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: space.lg,
  },
  utilityTile: {
    width: '31%',
    backgroundColor: 'rgba(17, 22, 34, 0.88)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilityIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  utilityLabel: {
    color: t.text,
    fontSize: 11,
    fontWeight: '600',
  },

  // 5. Recent IDs
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: t.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  contactsScroll: {
    gap: 16,
    paddingBottom: space.lg,
  },
  contactItem: {
    alignItems: 'center',
    width: 66,
  },
  contactAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  contactInitial: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  contactName: {
    color: t.text,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Eye Button
  eyeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 165, 36, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: t.warn,
  },
  eyeBtnText: {
    color: t.warn,
    fontSize: 11,
    fontWeight: '700',
  },

  // 6. Account Insights
  insightsCard: {
    backgroundColor: 'rgba(17, 22, 34, 0.88)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: space.md,
    marginTop: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardLabel: {
    color: t.textFaint,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  balanceValue: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },
  safeTag: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  safeTagLabel: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  safeTagValue: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '800',
  },
  alertBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  alertSubtext: {
    color: t.textDim,
    fontSize: 10,
    marginTop: 2,
  },
  healthyBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  healthyText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  keeperInfo: {
    color: t.textDim,
    fontSize: 12,
  },
  viewMoreBtn: {
    paddingVertical: 4,
  },
  viewMoreText: {
    color: t.warn,
    fontSize: 12,
    fontWeight: '700',
  },
});
