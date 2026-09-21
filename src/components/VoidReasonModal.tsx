import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Keyboard, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme';

type VoidReasonModalProps = {
  visible: boolean;
  orderLabel: string;
  voiding: boolean;
  onSubmit: (reason: string) => void;
  onClose: () => void;
};

export default function VoidReasonModal({
  visible,
  orderLabel,
  voiding,
  onSubmit,
  onClose,
}: VoidReasonModalProps) {
  const { colors, typography } = useTheme();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    const reason = value.trim();
    if (!reason) {
      setError('Agrega un motivo para poder anular la venta.');
      return;
    }
    setError(null);
    onSubmit(reason);
  };

  const handleClose = () => {
    setError(null);
    setValue('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: 20 }]}>
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: colors.danger + '1F' }]}>
              <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
            </View>
            <View style={styles.headerText}>
              <Text
                style={[styles.title, { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.extrabold }]}
              >
                Anular venta
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }} numberOfLines={1}>
                {orderLabel} · esta acción no se puede deshacer
              </Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text
              style={[
                styles.label,
                { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold },
              ]}
            >
              Motivo de la anulación *
            </Text>
            <TextInput
              value={value}
              onChangeText={(text) => {
                setValue(text);
                setError(null);
              }}
              placeholder="Ej. Cliente devolvió el producto"
              placeholderTextColor={colors.textSecondary}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: error ? colors.danger : colors.border,
                  color: colors.textPrimary,
                  fontSize: typography.sizes.body,
                },
              ]}
            />
            {error ? (
              <Text style={{ color: colors.danger, fontSize: typography.sizes.caption }}>{error}</Text>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [
                styles.cancelButton,
                { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '700' }}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={voiding}
              style={({ pressed }) => [
                styles.confirmButton,
                { backgroundColor: colors.danger, opacity: pressed || voiding ? 0.75 : 1 },
              ]}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>{voiding ? 'Anulando…' : 'Anular venta'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    letterSpacing: -0.3,
  },
  field: {
    gap: 6,
  },
  label: {
    marginLeft: 4,
  },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});