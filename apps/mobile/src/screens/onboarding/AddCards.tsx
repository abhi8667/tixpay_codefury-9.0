import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { t, typography, space, radius } from '../../theme';
import { useAppStore } from '../../../store/useAppStore';

interface AddCardsProps {
  onNext: () => void;
}

export const AddCards: React.FC<AddCardsProps> = ({ onNext }) => {
  const cards = useAppStore((state) => state.cards());
  const [selectedIds, setSelectedIds] = useState<string[]>(['card-amex-gold']);

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Link Credit & Debit Cards</Text>
        <Text style={styles.subtitle}>
          Select cards to enable smart instrument routing and fee-waiver arbitrage
        </Text>
      </View>

      <View style={styles.list}>
        {cards.map((card) => {
          const isSelected = selectedIds.includes(card.id);
          return (
            <TouchableOpacity
              key={card.id}
              style={[styles.cardRow, isSelected && styles.selectedCardRow]}
              onPress={() => toggleSelect(card.id)}
              activeOpacity={0.8}
            >
              <View style={styles.cardIcon}>
                <Text style={styles.networkBadge}>{card.network}</Text>
              </View>

              <View style={styles.cardMeta}>
                <Text style={styles.cardName}>{card.name}</Text>
                <Text style={styles.cardSub}>
                  {card.upiLinkable ? '✓ UPI Linkable (RuPay)' : 'Credit Rail • Swipe/Tap'}
                </Text>
              </View>

              <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.btn} onPress={onNext} activeOpacity={0.8}>
        <Text style={styles.btnText}>Continue with {selectedIds.length} Card(s)</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.bg,
    padding: space.lg,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: space.xl,
  },
  title: {
    ...typography.title,
    fontSize: 24,
    marginBottom: space.xs,
  },
  subtitle: {
    ...typography.caption,
    fontSize: 14,
  },
  list: {
    flex: 1,
    justifyContent: 'center',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  selectedCardRow: {
    borderColor: t.warn,
    backgroundColor: t.surfaceHi,
  },
  cardIcon: {
    width: 50,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  networkBadge: {
    color: t.warn,
    fontSize: 10,
    fontWeight: '800',
  },
  cardMeta: {
    flex: 1,
  },
  cardName: {
    color: t.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardSub: {
    color: t.textDim,
    fontSize: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: t.warn,
    borderColor: t.warn,
  },
  checkmark: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  btn: {
    backgroundColor: t.warn,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  btnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
});
