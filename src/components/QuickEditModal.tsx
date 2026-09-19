import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme';
import { parseMoney } from '../utils/money';

type Mode = 'price' | 'stock' | 'text';

type QuickEditModalProps = {
  visible: boolean;
  mode: Mode;
  productName: string;
  currentValue: string;
  onSubmit: (value: string, direction: 'add' | 'subtract') => void;
  onClose: () => void;
};

export default function QuickEditModal({
  visible,
  mode,
  productName,
  currentValue,
  onSubmit,
  onClose,
}: QuickEditModalProps) {
  const { colors, spacing, typography } = useTheme();
  const [value, setValue] = useState('');
  const [direction, setDirection] = useState<'add' | 'subtract'>('add');
  const [error, setError] = useState<string | null>(null);

  const isPrice = mode === 'price';
  const isText = mode === 'text';

  const inputLabel = isPrice ? 'Nuevo precio (RD$)' : isText ? 'Nuevo nombre' : 'Cantidad';
  const inputPlaceholder = isPrice ? 'Ej. 300 o 300.50' : isText ? 'Ej. Comidas rápidas' : 'Ej. 20';
  const iconName: 'pricetag-outline' | 'cube-outline' | 'create-outline' = isPrice ? 'pricetag-outline' : isText ? 'create-outline' : 'cube-outline';

  const handleConfirm = () => {
    if (isPrice) {
      const cents = parseMoney(value);
      if (cents === null || cents <= 0) {
        setError('Ingresa un precio válido mayor a 0, por ejemplo 250 o 250.50');
        return;
      }
    } else if (isText) {
      if (!value.trim()) {
        setError('Ingresa el nuevo nombre');
        return;
      }
    } else {
      const cleaned = value.trim();
      if (!/^\d+$/.test(cleaned) || parseInt(cleaned, 10) <= 0) {
        setError('Ingresa la cantidad a sumar o a quitar, por ejemplo 20');
        return;
      }
    }
    setError(null);
    onSubmit(value.trim(), direction);
  };

  const handleClose = () => {
    setError(null);
    setValue('');
    setDirection('add');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: 20 }]}>
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name={iconName} size={22} color={colors.primary} />
            </View>
            <View style={styles.headerText}>
              <Text
                style={[styles.title, { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: typography.weights.extrabold }]}
              >
                {isPrice ? 'Cambiar precio' : isText ? 'Renombrar' : 'Ajustar stock'}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }} numberOfLines={1}>
                {productName} · actual: {currentValue}
              </Text>
            </View>
          </View>

          {!isPrice && !isText ? (
            <View style={styles.segmentRow}>
              <SegmentOption label="➕ Agregar" active={direction === 'add'} onPress={() => setDirection('add')} />
              <SegmentOption label="➖ Quitar" active={direction === 'subtract'} onPress={() => setDirection('subtract')} />
            </View>
          ) : null}

          <View style={styles.field}>
            <Text
              style={[
                styles.label,
                { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold },
              ]}
            >
              {inputLabel}
            </Text>
            <TextInput
              value={value}
              onChangeText={(text) => {
                setValue(text);
                setError(null);
              }}
              keyboardType={isText ? 'default' : isPrice ? 'decimal-pad' : 'number-pad'}
              placeholder={inputPlaceholder}
              placeholderTextColor={colors.textSecondary}
              autoFocus
              autoCapitalize={isText ? 'sentences' : 'none'}
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
            {error ? <Text style={{ color: colors.danger, fontSize: typography.sizes.caption }}>{error}</Text> : null}
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
              style={({ pressed }) => [styles.confirmButton, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={{ color: colors.textOnPrimary, fontSize: 15, fontWeight: '800' }}>Guardar</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SegmentOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.segmentOption,
        { backgroundColor: active ? colors.primaryLight : colors.surfaceMuted, borderColor: active ? colors.primary : colors.border },
      ]}
    >
      <Text style={{ color: active ? colors.primary : colors.textSecondary, fontWeight: '700' }}>{label}</Text>
    </Pressable>
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
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  segmentOption: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
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