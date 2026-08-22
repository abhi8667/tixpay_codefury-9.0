import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { PaymentIntent } from '@tixpay/types';
import { parseUpiDeepLink } from '@tixpay/engine';
import { t, space, radius } from '../theme';

interface QrScannerProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (intent: PaymentIntent) => void;
}

/**
 * Real QR scanning, real parsing.
 *
 * `parseUpiDeepLink` is one of the few parts of this build that is not
 * simulated — UPI QR codes are plain deep links, so a genuine shop QR scans
 * and resolves here. Protect that: it is the most convincing thirty seconds
 * of the demo.
 *
 * Two things this guards against on stage:
 *   1. A judge scans a random non-UPI QR. The parser returns null rather than
 *      throwing, and we show a friendly rejection instead of a crash.
 *   2. The venue has no working camera (emulator, Expo Go on a laptop). The
 *      paste field below takes a `upi://pay?...` string through the exact same
 *      parser, so the demo survives a hardware failure.
 */
export const QrScanner: React.FC<QrScannerProps> = ({ visible, onClose, onScanned }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [rejected, setRejected] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualUrl, setManualUrl] = useState('upi://pay?pa=croma.store@ybl&pn=Croma&am=8000&mc=5732&cu=INR');

  // Guard against the camera firing the same frame a dozen times while the
  // modal animates out.
  const [handled, setHandled] = useState(false);

  const accept = useCallback(
    (url: string) => {
      const intent = parseUpiDeepLink(url);
      if (!intent) {
        setRejected('That is not a UPI payment code.');
        return false;
      }
      setRejected(null);
      onScanned(intent);
      return true;
    },
    [onScanned]
  );

  const handleBarcode = useCallback(
    ({ data }: { data: string }) => {
      if (handled) return;
      setHandled(true);
      const ok = accept(data);
      // On a rejection, re-arm so the next QR in frame gets a chance.
      if (!ok) setTimeout(() => setHandled(false), 1200);
    },
    [handled, accept]
  );

  const close = () => {
    setHandled(false);
    setRejected(null);
    onClose();
  };

  const cameraUsable =
    permission?.granted && Platform.OS !== 'web' && !manualEntry;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={close}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={close} style={styles.backBtn}>
            <Text style={styles.backText}>{'←'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Scan to pay</Text>
          <View style={styles.backBtn} />
        </View>

        {cameraUsable ? (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcode}
            />
            <View style={styles.reticle} pointerEvents="none" />
            <Text style={styles.hint}>Point at any UPI QR code</Text>
          </View>
        ) : (
          <View style={styles.permissionWrap}>
            {!permission?.granted && !manualEntry ? (
              <>
                <Text style={styles.permTitle}>Camera access</Text>
                <Text style={styles.permBody}>
                  Used only to read the QR in front of you. Nothing is recorded, stored, or
                  sent anywhere.
                </Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
                  <Text style={styles.primaryBtnText}>Allow camera</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.permTitle}>Paste a UPI link</Text>
                <Text style={styles.permBody}>
                  Same parser the camera uses.
                </Text>
                <TextInput
                  style={styles.input}
                  value={manualUrl}
                  onChangeText={setManualUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  placeholder="upi://pay?pa=..."
                  placeholderTextColor={t.textDim}
                />
                <TouchableOpacity style={styles.primaryBtn} onPress={() => accept(manualUrl)}>
                  <Text style={styles.primaryBtnText}>Parse link</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {rejected && (
          <View style={styles.rejectBar}>
            <Text style={styles.rejectText}>{rejected}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.toggleLink}
          onPress={() => {
            setManualEntry((v) => !v);
            setRejected(null);
          }}
        >
          <Text style={styles.toggleText}>
            {manualEntry ? 'Use camera instead' : 'Enter a UPI link manually'}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.bg,
    padding: space.md,
  },
  header: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backText: {
    color: t.text,
    fontSize: 24,
  },
  title: {
    color: t.text,
    fontSize: 16,
    fontWeight: '700',
  },
  cameraWrap: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginVertical: space.md,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticle: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderColor: t.warn,
    borderRadius: radius.md,
  },
  hint: {
    position: 'absolute',
    bottom: space.md,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  permissionWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  permTitle: {
    color: t.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: space.xs,
  },
  permBody: {
    color: t.textDim,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: space.md,
  },
  input: {
    color: t.text,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
    fontSize: 13,
    minHeight: 80,
    marginBottom: space.md,
  },
  primaryBtn: {
    backgroundColor: t.warn,
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  rejectBar: {
    backgroundColor: '#261214',
    borderColor: t.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
    marginBottom: space.sm,
  },
  rejectText: {
    color: t.danger,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  toggleLink: {
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  toggleText: {
    color: t.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
});
