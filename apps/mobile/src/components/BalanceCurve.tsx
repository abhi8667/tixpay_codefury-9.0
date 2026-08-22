import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle, ClipPath, Rect } from 'react-native-svg';
import { line, area, curveMonotoneX } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import { t, typography, radius, space } from '../theme';
import { Rupee } from './Rupee';
import type { BalanceCurve as BalanceCurveType, Shortfall } from '@tixpay/types';
import { formatIstDate } from '@tixpay/engine';

const SCREEN_WIDTH = Dimensions.get('window').width - 32; // padding space.md * 2
const HEIGHT = 220;

interface BalanceCurveProps {
  curve: BalanceCurveType;
  shortfall?: Shortfall | null;
  onDipPress?: () => void;
  isResolved?: boolean;
}

export const BalanceCurve: React.FC<BalanceCurveProps> = ({
  curve,
  shortfall,
  onDipPress,
  isResolved = false,
}) => {
  const [scrubberIdx, setScrubberIdx] = useState<number | null>(null);

  if (!curve || curve.length === 0) return null;

  const minBal = Math.min(...curve.map((c) => c.balance), -5000);
  const maxBal = Math.max(...curve.map((c) => c.balance), 20000);

  const xScale = scaleLinear()
    .domain([0, curve.length - 1])
    .range([10, SCREEN_WIDTH - 10]);

  const yScale = scaleLinear()
    .domain([minBal, maxBal])
    .range([HEIGHT - 25, 15]);

  const zeroY = yScale(0);

  // Generate d3 line path
  const lineGenerator = line<(typeof curve)[0]>()
    .x((_, i) => xScale(i))
    .y((d) => yScale(d.balance))
    .curve(curveMonotoneX);

  const pathD = lineGenerator(curve) || '';

  // Area path for gradient fill above zero
  const areaGenerator = area<(typeof curve)[0]>()
    .x((_, i) => xScale(i))
    .y0(zeroY)
    .y1((d) => yScale(d.balance))
    .curve(curveMonotoneX);

  const areaD = areaGenerator(curve) || '';

  // Find lowest point for dip marker
  const lowestPointIdx = curve.reduce(
    (minIdx, pt, idx) => (pt.balance < curve[minIdx].balance ? idx : minIdx),
    0
  );
  const lowestPt = curve[lowestPointIdx];
  const dipX = xScale(lowestPointIdx);
  const dipY = yScale(lowestPt.balance);
  const hasDeficit = !isResolved && lowestPt.balance < 0;

  return (
    <View style={styles.container}>
      <Svg width={SCREEN_WIDTH} height={HEIGHT}>
        <Defs>
          {/* Green Area Gradient */}
          <LinearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={t.ok} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={t.ok} stopOpacity="0.0" />
          </LinearGradient>

          {/* Red Deficit Clip Area */}
          <ClipPath id="redClip">
            <Rect x={0} y={zeroY} width={SCREEN_WIDTH} height={HEIGHT - zeroY} />
          </ClipPath>
        </Defs>

        {/* Horizontal Grid Lines */}
        {[-10000, 0, 10000, 20000].map((val) => {
          const y = yScale(val);
          if (y < 0 || y > HEIGHT) return null;
          return (
            <Line
              key={val}
              x1={0}
              y1={y}
              x2={SCREEN_WIDTH}
              y2={y}
              stroke={val === 0 ? t.textFaint : t.border}
              strokeDasharray={val === 0 ? '4 4' : undefined}
              strokeWidth={val === 0 ? 1.5 : 1}
              opacity={0.4}
            />
          );
        })}

        {/* Green Area Fill */}
        <Path d={areaD} fill="url(#emeraldGradient)" />

        {/* Red Deficit Region Fill */}
        {hasDeficit && (
          <Path d={areaD} fill={t.danger} opacity={0.25} clipPath="url(#redClip)" />
        )}

        {/* Main Curve Stroke */}
        <Path
          d={pathD}
          fill="none"
          stroke={isResolved ? t.ok : hasDeficit ? '#E53E3E' : t.ok}
          strokeWidth={2.5}
        />

        {/* Dip Marker Pulse Target */}
        {hasDeficit && (
          <>
            <Circle cx={dipX} cy={dipY} r={14} fill={t.danger} opacity={0.2} />
            <Circle cx={dipX} cy={dipY} r={7} fill={t.danger} stroke="#FFFFFF" strokeWidth={2} />
          </>
        )}

        {/* Scrubber Line */}
        {scrubberIdx !== null && (
          <>
            <Line
              x1={xScale(scrubberIdx)}
              y1={0}
              x2={xScale(scrubberIdx)}
              y2={HEIGHT}
              stroke={t.warn}
              strokeDasharray="2 2"
              strokeWidth={1}
            />
            <Circle
              cx={xScale(scrubberIdx)}
              cy={yScale(curve[scrubberIdx].balance)}
              r={5}
              fill={t.warn}
            />
          </>
        )}
      </Svg>

      {/* Red Shortfall Label above dip */}
      {hasDeficit && (
        <TouchableOpacity
          style={[styles.dipBadge, { left: dipX - 45, top: dipY - 38 }]}
          onPress={onDipPress}
          activeOpacity={0.8}
        >
          <Rupee amount={Math.abs(lowestPt.balance)} style={styles.dipBadgeText} prefix="" />
          <Text style={styles.dipBadgeSub}>short</Text>
        </TouchableOpacity>
      )}

      {/* Date labels, read off the curve itself.
          These were four hardcoded March dates, so the axis disagreed with the
          line above it the moment the World Clock moved — the fastest way to
          lose a room is a chart whose axis is decoration. */}
      <View style={styles.xAxis}>
        {[0, 0.33, 0.66, 0.99].map((fraction) => {
          const point = curve[Math.min(Math.floor(fraction * curve.length), curve.length - 1)];
          return (
            <Text key={fraction} style={styles.xLabel}>
              {point ? formatIstDate(point.date) : ''}
            </Text>
          );
        })}
      </View>

      {/* Tap the dip Callout Pill */}
      {hasDeficit && (
        <TouchableOpacity style={styles.pillCTA} onPress={onDipPress} activeOpacity={0.8}>
          <Text style={styles.pillCTAText}>👆 Tap the dip to fix this shortfall</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: space.sm,
    alignItems: 'center',
    position: 'relative',
  },
  dipBadge: {
    position: 'absolute',
    alignItems: 'center',
    backgroundColor: '#3D100C',
    borderColor: t.danger,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dipBadgeText: {
    color: t.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  dipBadgeSub: {
    color: t.danger,
    fontSize: 9,
    fontWeight: '700',
  },
  xAxis: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm,
    marginTop: space.xs,
  },
  xLabel: {
    color: t.textDim,
    fontSize: 11,
    fontWeight: '500',
  },
  pillCTA: {
    backgroundColor: '#1E2330',
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: space.md,
  },
  pillCTAText: {
    color: t.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
