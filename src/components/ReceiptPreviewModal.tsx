import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import PrimaryButton from './PrimaryButton';
import { logoDataUri } from '../services/printerService';
import { usePrinter } from '../hooks/usePrinter';
import { useTheme } from '../theme';

type Props = {
  visible: boolean;
  title: string;
  text: string;
  logoBase64?: string;
  note?: string;
  onClose: () => void;
};

export default function ReceiptPreviewModal({ visible, title, text, logoBase64, note, onClose }: Props) {
  const { colors, typography } = useTheme();
  const { available, printReceiptText } = usePrinter();
  const [printing, setPrinting] = useState(false);
  const logoUri = logoDataUri(logoBase64);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const result = await printReceiptText(text, logoBase64);
      Alert.alert('Impresión', result.message);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: 16 }]}>
          <View style={styles.header}>
            <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.bold }}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {logoUri ? <Image source={{ uri: logoUri }} style={styles.logo} resizeMode="contain" /> : null}
            <Text
              selectable
              style={{
                color: colors.textPrimary,
                fontFamily: 'monospace',
                fontSize: 13,
                lineHeight: 19,
              }}
            >
              {text}
            </Text>
          </ScrollView>
          {note ? (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: typography.sizes.caption,
                textAlign: 'center',
                marginTop: 12,
              }}
            >
              {note}
            </Text>
          ) : null}
          <View style={styles.actions}>
            {available ? (
              <PrimaryButton label="Imprimir" onPress={handlePrint} loading={printing} />
            ) : null}
            <PrimaryButton label="Cerrar" variant={available ? 'outline' : 'primary'} onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    maxHeight: '80%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  logo: {
    width: 64,
    height: 64,
    alignSelf: 'center',
    marginBottom: 12,
  },
  actions: {
    marginTop: 14,
    gap: 10,
  },
});