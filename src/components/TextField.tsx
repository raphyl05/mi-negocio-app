import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import type { KeyboardTypeOptions, TextInputProps } from 'react-native';
import { useTheme } from '../theme';

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  secureTextEntry?: boolean;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
};

export default function TextField({
  label,
  value,
  onChangeText,
  error,
  secureTextEntry = false,
  placeholder,
  keyboardType,
  autoCapitalize = 'sentences',
}: TextFieldProps) {
  const { colors, spacing, typography } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor,
            borderRadius: 14,
            borderWidth: 1.5,
            padding: spacing.md,
            color: colors.textPrimary,
            fontSize: typography.sizes.body,
          },
        ]}
      />
      {error ? (
        <Text style={[styles.error, { color: colors.danger, fontSize: typography.sizes.caption }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    marginLeft: 4,
  },
  input: {
    minHeight: 52,
  },
  error: {
    marginLeft: 4,
  },
});