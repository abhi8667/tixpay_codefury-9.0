import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { t, typography, space, radius } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { FadeIn, PressableScale, ProgressBar, EmptyState, money } from '../components/motion';
import { useAppStore } from '../../store/useAppStore';
import { RISK_QUESTIONS, PROFILE_COPY } from '@tixpay/engine';

interface RiskProfileScreenProps {
  onBack?: () => void;
  onOpenSipCheck?: () => void;
}

const ALLOCATION_META = [
  { key: 'equity' as const, label: 'Equity', color: '#5B8DEF' },
  { key: 'debt' as const, label: 'Debt', color: '#2DD4A0' },
  { key: 'gold' as const, label: 'Gold', color: '#F5A524' },
  { key: 'cash' as const, label: 'Cash', color: '#94A3B8' },
];

/**
 * Risk profiling, scored twice.
 *
 * Everyone's version of this screen asks five questions and hands back
 * "Aggressive" to whoever ticked the brave-sounding boxes. That measures how a
 * person feels about risk on a calm afternoon, which is not the thing that
 * decides whether they can hold an equity position through a bad quarter.
 *
 * So the questionnaire scores appetite, the imported statement scores capacity,
 * and the lower one binds. When capacity is what capped the profile the screen
 * says so and names the figures — the buffer, the savings rate, the share of
 * income already committed — so the answer can be argued with rather than
 * merely accepted.
 */
export const RiskProfileScreen: React.FC<RiskProfileScreenProps> = ({
  onBack,
  onOpenSipCheck,
}) => {
  const riskAnswers = useAppStore((s) => s.riskAnswers);
  const setRiskAnswer = useAppStore((s) => s.setRiskAnswer);
  const resetRiskAnswers = useAppStore((s) => s.resetRiskAnswers);
  const riskProfile = useAppStore((s) => s.riskProfile);
  const pipelineCache = useAppStore((s) => s._pipelineCache);
  const keeperBalance = useAppStore((s) => s.keeperBalance);

  const result = useMemo(
    () => riskProfile(),
    [riskProfile, pipelineCache, riskAnswers, keeperBalance],
  );

  const answeredCount = RISK_QUESTIONS.filter(
    (q) => typeof riskAnswers[q.id] === 'number',
  ).length;
  const complete = answeredCount === RISK_QUESTIONS.length;

  if (!result) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Risk Profile" onBack={onBack} />
        <EmptyState
          icon="🎚️"
          title="Import a statement first"
          body="Half of this answer comes from your account — the buffer you hold, what you save, what is already committed. Without one there is only the quiz."
        />
      </View>
    );
  }

  const copy = PROFILE_COPY[result.profile];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Risk Profile"
        onBack={onBack}
        subtitle={`${answeredCount} of ${RISK_QUESTIONS.length} answered`}
        right={
          answeredCount > 0 ? (
            <PressableScale style={styles.resetBtn} onPress={resetRiskAnswers} haptic={false}>
              <Text style={styles.resetText}>Reset</Text>
            </PressableScale>
          ) : undefined
        }
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* ── The two scores ───────────────────────────────────────────── */}
        <FadeIn style={styles.scoreCard}>
          <Text style={styles.scoreCardLabel}>
            {complete ? 'Your profile' : 'Provisional — finish the questions below'}
          </Text>
          <Text style={styles.profileName}>{copy.label}</Text>
          <Text style={styles.profileBlurb}>{copy.blurb}</Text>

          <View style={styles.dualRow}>
            <View style={styles.dualItem}>
              <Text style={styles.dualLabel}>Appetite</Text>
              <Text style={styles.dualValue}>{result.attitudeScore}</Text>
              <ProgressBar
                progress={result.attitudeScore / 100}
                color={t.accent}
                height={5}
                style={styles.dualBar}
              />
              <Text style={styles.dualNote}>What you told the questions</Text>
            </View>
            <View style={styles.dualItem}>
              <Text style={styles.dualLabel}>Capacity</Text>
              <Text style={styles.dualValue}>{result.capacityScore}</Text>
              <ProgressBar
                progress={result.capacityScore / 100}
                color={result.cappedByCapacity ? t.warn : t.ok}
                height={5}
                style={styles.dualBar}
              />
              <Text style={styles.dualNote}>What your statement can absorb</Text>
            </View>
          </View>

          <View
            style={[
              styles.bindingBox,
              result.cappedByCapacity ? styles.bindingWarn : styles.bindingOk,
            ]}
          >
            <Text
              style={[
                styles.bindingText,
                result.cappedByCapacity ? styles.bindingTextWarn : styles.bindingTextOk,
              ]}
            >
              {result.headline}
            </Text>
          </View>
        </FadeIn>

        {/* ── Why capacity scored what it did ──────────────────────────── */}
        <FadeIn delay={60} style={styles.card}>
          <Text style={styles.cardTitle}>What your account says</Text>
          {result.capacityReasons.map((reason) => (
            <View key={reason} style={styles.reasonRow}>
              <Text style={styles.reasonDot}>•</Text>
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </FadeIn>

        {/* ── Suggested mix ────────────────────────────────────────────── */}
        <FadeIn delay={90} style={styles.card}>
          <Text style={styles.cardTitle}>A mix that matches</Text>
          <View style={styles.stackBar}>
            {ALLOCATION_META.map((a) => {
              const pct = result.allocation[a.key];
              if (pct <= 0) return null;
              return (
                <View
                  key={a.key}
                  style={{ flex: pct, backgroundColor: a.color, height: '100%' }}
                />
              );
            })}
          </View>
          <View style={styles.legendRow}>
            {ALLOCATION_META.map((a) => (
              <View key={a.key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: a.color }]} />
                <Text style={styles.legendLabel}>
                  {a.label} {result.allocation[a.key]}%
                </Text>
              </View>
            ))}
          </View>

          {result.suggestedMonthlySip ? (
            <PressableScale style={styles.sipCta} onPress={onOpenSipCheck}>
              <Text style={styles.sipCtaText}>
                Test a {money(result.suggestedMonthlySip)} monthly SIP against your cash flow →
              </Text>
            </PressableScale>
          ) : (
            <Text style={styles.noSip}>
              Your statement shows no reliable monthly surplus, so there is no SIP figure to
              suggest. Building a buffer comes before this.
            </Text>
          )}

          <Text style={styles.disclaimer}>
            This is an asset-class mix, not advice about any particular fund or security. TiXPay
            is not a registered investment adviser.
          </Text>
        </FadeIn>

        {/* ── The questionnaire ────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Five questions</Text>

        {RISK_QUESTIONS.map((q) => (
          <View key={q.id} style={styles.card}>
            <Text style={styles.question}>{q.prompt}</Text>
            {q.options.map((opt) => {
              const selected = riskAnswers[q.id] === opt.score;
              return (
                <PressableScale
                  key={opt.label}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => setRiskAnswer(q.id, opt.score)}
                >
                  <View style={[styles.optionDot, selected && styles.optionDotOn]} />
                  <Text style={[styles.optionLabel, selected && styles.optionLabelOn]}>
                    {opt.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  content: { flex: 1 },
  scrollContent: { padding: space.md, paddingBottom: 48 },
  resetBtn: { paddingHorizontal: space.sm, paddingVertical: 6 },
  resetText: { color: t.textDim, fontSize: 12, fontWeight: '600' },

  scoreCard: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  scoreCardLabel: { ...typography.caption, marginBottom: 2 },
  profileName: { ...typography.display, fontSize: 28 },
  profileBlurb: { color: t.textDim, fontSize: 13, lineHeight: 19, marginTop: 4 },

  dualRow: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  dualItem: { flex: 1 },
  dualLabel: { color: t.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  dualValue: {
    color: t.text,
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  dualBar: { marginTop: 4 },
  dualNote: { color: t.textFaint, fontSize: 10, marginTop: 4, lineHeight: 14 },

  bindingBox: {
    marginTop: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: space.sm,
  },
  bindingOk: { backgroundColor: '#0A261C', borderColor: t.ok },
  bindingWarn: { backgroundColor: '#262010', borderColor: t.warn },
  bindingText: { fontSize: 12, fontWeight: '600', lineHeight: 18 },
  bindingTextOk: { color: t.ok },
  bindingTextWarn: { color: t.warn },

  card: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.md,
  },
  cardTitle: {
    color: t.textDim,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: space.sm,
  },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 3 },
  reasonDot: { color: t.warn, fontSize: 13, width: 14 },
  reasonText: { flex: 1, color: t.textDim, fontSize: 12, lineHeight: 18 },

  stackBar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: t.surfaceHi,
  },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  legendLabel: { color: t.textDim, fontSize: 11, fontWeight: '600' },

  sipCta: {
    marginTop: space.md,
    backgroundColor: '#262010',
    borderColor: t.warn,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 11,
    paddingHorizontal: space.sm,
  },
  sipCtaText: { color: t.warn, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  noSip: { color: t.textDim, fontSize: 12, lineHeight: 18, marginTop: space.md },
  disclaimer: { color: t.textFaint, fontSize: 10, lineHeight: 15, marginTop: space.md },

  sectionTitle: {
    color: t.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: space.lg,
    marginBottom: 2,
  },
  question: { color: t.text, fontSize: 14, fontWeight: '600', marginBottom: space.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    marginBottom: 4,
    backgroundColor: t.surfaceHi,
  },
  optionSelected: { backgroundColor: '#262010', borderWidth: 1, borderColor: t.warn },
  optionDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: t.border,
    marginRight: space.sm,
  },
  optionDotOn: { borderColor: t.warn, backgroundColor: t.warn },
  optionLabel: { flex: 1, color: t.textDim, fontSize: 13 },
  optionLabelOn: { color: t.text, fontWeight: '600' },
});
