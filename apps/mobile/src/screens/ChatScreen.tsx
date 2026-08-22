import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { t, typography, space, radius } from '../theme';
import { runCoachTurn, type GeminiContent } from '../lib/gemini';
import { COACH_TOOLS, COACH_SYSTEM_INSTRUCTION, executeCoachTool } from '../lib/coachTools';
import { hasGeminiKey } from '../config';
import { useAppStore } from '../../store/useAppStore';

interface ChatScreenProps {
  onBack?: () => void;
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'coach';
  text: string;
}

const SUGGESTIONS = [
  'Why did my spending go up this month?',
  'Am I on track for my goal?',
  'Can I afford a ₹5,000 SIP?',
  'What can I safely spend today?',
];

/**
 * "Money Coach" — a conversational front-end over the engine's own outputs.
 *
 * The model never sees a raw transaction: `coachTools.ts` hands it only
 * already-computed aggregates (category totals, a goal projection, a SIP
 * verdict), and the system prompt forbids it from stating a number that
 * didn't come back from a tool call. That's the difference between this and
 * a generic chatbot — it can't hallucinate a balance.
 */
export const ChatScreen: React.FC<ChatScreenProps> = ({ onBack }) => {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const historyRef = useRef<GeminiContent[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const hasData = useAppStore((s) => s.hasData());

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text: trimmed }]);
    setInput('');
    setErrorNotice(null);
    setLoading(true);

    try {
      const { reply, history } = await runCoachTurn(
        historyRef.current,
        trimmed,
        COACH_SYSTEM_INSTRUCTION,
        COACH_TOOLS,
        executeCoachTool,
      );
      historyRef.current = history;
      setMessages((prev) => [...prev, { id: `c_${Date.now()}`, role: 'coach', text: reply }]);
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Something went wrong reaching the coach.');
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={56}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Money Coach</Text>
        <View style={styles.backBtn} />
      </View>

      {!hasGeminiKey && (
        <View style={styles.warnBanner}>
          <Text style={styles.warnText}>
            No Gemini API key configured. Add EXPO_PUBLIC_GEMINI_API_KEY to apps/mobile/.env and restart the dev server.
          </Text>
        </View>
      )}

      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.scrollContent}>
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Ask about your money</Text>
            <Text style={styles.emptySub}>
              Grounded in your actual spend, goal, and cash-flow projection — never a made-up number.
            </Text>
            <View style={styles.suggestionList}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity key={s} style={styles.suggestionPill} onPress={() => send(s)} disabled={!hasData}>
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {!hasData && <Text style={styles.noDataText}>Import a statement first.</Text>}
          </View>
        )}

        {messages.map((m) => (
          <View key={m.id} style={[styles.bubbleRow, m.role === 'user' && styles.bubbleRowUser]}>
            <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleCoach]}>
              <Text style={[styles.bubbleText, m.role === 'user' && styles.bubbleTextUser]}>{m.text}</Text>
            </View>
          </View>
        ))}

        {loading && (
          <View style={styles.bubbleRow}>
            <View style={[styles.bubble, styles.bubbleCoach]}>
              <ActivityIndicator color={t.textDim} size="small" />
            </View>
          </View>
        )}

        {errorNotice && (
          <View style={styles.errorBubble}>
            <Text style={styles.errorText}>{errorNotice}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={hasData ? 'Ask the coach…' : 'Import a statement first'}
          placeholderTextColor={t.textFaint}
          style={styles.input}
          editable={hasData && !loading}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading || !hasData) && styles.btnDisabled]}
          onPress={() => send(input)}
          disabled={!input.trim() || loading || !hasData}
        >
          <Text style={styles.sendBtnText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  headerRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  backBtn: { width: 32 },
  backText: { color: t.text, fontSize: 22 },
  headerTitle: { ...typography.title, fontSize: 18 },
  warnBanner: {
    backgroundColor: '#2A1416',
    borderBottomWidth: 1,
    borderBottomColor: t.danger,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  warnText: { color: t.danger, fontSize: 12, lineHeight: 17 },
  content: { flex: 1 },
  scrollContent: { padding: space.md, paddingBottom: space.lg },
  emptyState: { alignItems: 'center', paddingTop: space.xl },
  emptyIcon: { fontSize: 40, marginBottom: space.sm },
  emptyTitle: { color: t.text, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  emptySub: { color: t.textDim, fontSize: 13, textAlign: 'center', paddingHorizontal: space.lg, lineHeight: 18 },
  suggestionList: { marginTop: space.lg, width: '100%', gap: space.sm },
  suggestionPill: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  suggestionText: { color: t.text, fontSize: 13, fontWeight: '600' },
  noDataText: { color: t.textFaint, fontSize: 12, marginTop: space.md },
  bubbleRow: { flexDirection: 'row', marginBottom: space.sm },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', borderRadius: radius.md, padding: space.md },
  bubbleCoach: { backgroundColor: t.surface, borderColor: t.border, borderWidth: 1 },
  bubbleUser: { backgroundColor: t.warn },
  bubbleText: { color: t.text, fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: '#000', fontWeight: '600' },
  errorBubble: {
    backgroundColor: '#2A1416',
    borderColor: t.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  errorText: { color: t.danger, fontSize: 13 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderTopWidth: 1,
    borderTopColor: t.border,
    gap: space.sm,
  },
  input: {
    flex: 1,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: t.text,
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: t.warn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#000', fontSize: 18, fontWeight: '700' },
});
