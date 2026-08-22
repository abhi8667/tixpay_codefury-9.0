import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import { t, typography, space, radius } from '../../theme';
import { useAppStore } from '../../../store/useAppStore';

/**
 * Banks that only offer "Excel" exports hand out a real binary .xls/.xlsx
 * workbook, not a CSV with a misleading extension — the file below is a
 * genuine OLE2 workbook from JasperReports. Reading that as text produces
 * garbage bytes, so binary formats are decoded with SheetJS and converted to
 * CSV text first; the CSV parser downstream never has to know the
 * difference.
 */
function isBinaryWorkbook(name: string): boolean {
  return /\.xlsx?$/i.test(name);
}

async function readStatementText(uri: string, name: string): Promise<string> {
  if (!isBinaryWorkbook(name)) {
    return FileSystem.readAsStringAsync(uri);
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const workbook = XLSX.read(base64, { type: 'base64' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return '';
  return XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]!);
}

interface StatementImportProps {
  onImported: () => void;
}

/**
 * The only way data enters this app.
 *
 * The user picks one exported statement. The system picker hands back a scoped
 * URI for that single file — there is no permission to grant, nothing stays
 * granted afterwards, and we cannot go looking for anything we were not given.
 *
 * That is the entire privacy story, and it is worth stating on the screen
 * rather than in a settings page nobody opens.
 */
export const StatementImport: React.FC<StatementImportProps> = ({ onImported }) => {
  const importStatement = useAppStore((s) => s.importStatement);
  const loadSampleStatement = useAppStore((s) => s.loadSampleStatement);
  const importError = useAppStore((s) => s.importError);
  const imported = useAppStore((s) => s.imported);

  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const error = localError ?? importError;

  const pickFile = useCallback(async () => {
    setBusy(true);
    setLocalError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        // Android reports CSV under several MIME types depending on which app
        // produced it, and some file managers report none at all. Accepting a
        // list plus the wildcard is the difference between a picker that opens
        // on every device and one that shows an empty folder on a few. Excel
        // MIME types are included because several banks only export .xls/.xlsx.
        type: [
          'text/csv', 'text/comma-separated-values', 'text/plain',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '*/*',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        setBusy(false);
        return;
      }

      const file = result.assets[0];
      if (!file) {
        setLocalError('Could not read that file. Try picking it again.');
        setBusy(false);
        return;
      }

      const text = await readStatementText(file.uri, file.name ?? '');
      const ok = importStatement(text, file.name ?? 'Statement.csv', false);

      setBusy(false);
      if (ok) onImported();
    } catch (e) {
      // A picker that throws must not take the screen down with it — the user
      // still has the sample path, and a dead button is worse than an error.
      console.warn('[StatementImport] pick failed:', e);
      setLocalError('Could not open that file. It may not be a CSV or Excel export.');
      setBusy(false);
    }
  }, [importStatement, onImported]);

  const useSample = useCallback(() => {
    setLocalError(null);
    loadSampleStatement();
    onImported();
  }, [loadSampleStatement, onImported]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>📄</Text>
        </View>
        <Text style={styles.title}>Import your statement</Text>
        <Text style={styles.subtitle}>
          Export a statement (CSV or Excel) from your net banking and hand it to TiXPay. We
          read the transactions, find your auto-debits, and project your balance 30 days
          forward.
        </Text>
      </View>

      <View style={styles.privacyCard}>
        <Text style={styles.privacyHeader}>🔒 What this does and does not touch</Text>
        <Text style={styles.privacyBullet}>• One file you choose — nothing else on the device</Text>
        <Text style={styles.privacyBullet}>• No SMS, no contacts, no bank login, no standing permission</Text>
        <Text style={styles.privacyBullet}>• Zero network requests — the analysis runs on this phone</Text>
        <Text style={styles.privacyBullet}>• Nothing is uploaded, and nothing is written to disk</Text>
      </View>

      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>
            TiXPay reads CSV and Excel (.xls/.xlsx) exports. In net banking, choose "Download
            as CSV" or "Excel" for your account statement.
          </Text>
        </View>
      )}

      {imported && !error && (
        <View style={styles.receiptCard}>
          <Text style={styles.receiptHeader}>✓ {imported.sourceName}</Text>
          <Text style={styles.receiptLine}>
            {imported.parsed} of {imported.rows} rows read · {imported.bank}
            {imported.accountTail ? ` ••${imported.accountTail}` : ''}
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, busy && styles.btnDisabled]}
          onPress={pickFile}
          disabled={busy}
          activeOpacity={0.8}
        >
          {busy ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text style={styles.btnText}>Choose statement file</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={useSample} activeOpacity={0.8}>
          <Text style={styles.secondaryText}>Try it with a sample statement</Text>
        </TouchableOpacity>

        <Text style={styles.sampleNote}>
          The sample is generated data, not anyone's account. Use it to see the app work
          before handing over a real file.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  content: { padding: space.lg, paddingBottom: space.xl },
  header: { marginTop: space.lg, alignItems: 'center' },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: t.surfaceHi,
    borderColor: t.accent,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  icon: { fontSize: 32 },
  title: { ...typography.title, fontSize: 24, marginBottom: space.xs, textAlign: 'center' },
  subtitle: {
    ...typography.caption,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  privacyCard: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.lg,
  },
  privacyHeader: { color: t.ok, fontSize: 14, fontWeight: '700', marginBottom: space.sm },
  privacyBullet: { color: t.textDim, fontSize: 13, lineHeight: 20, marginBottom: 4 },
  errorCard: {
    backgroundColor: 'rgba(240,85,61,0.10)',
    borderColor: t.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.md,
  },
  errorText: { color: t.danger, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  errorHint: { color: t.textDim, fontSize: 12, lineHeight: 18, marginTop: space.xs },
  receiptCard: {
    backgroundColor: 'rgba(45,212,160,0.10)',
    borderColor: t.ok,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.md,
  },
  receiptHeader: { color: t.ok, fontSize: 14, fontWeight: '700' },
  receiptLine: { color: t.textDim, fontSize: 12, marginTop: 2 },
  actions: { marginTop: space.lg },
  btn: {
    backgroundColor: t.warn,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#000000', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  secondaryText: { color: t.text, fontSize: 15, fontWeight: '600' },
  sampleNote: {
    color: t.textFaint,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: space.sm,
  },
});
