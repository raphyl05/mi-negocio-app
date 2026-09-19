import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
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
  multiline?: boolean;
  formatOnFocus?: (text: string) => string;
  formatOnBlur?: (text: string) => string;
  sanitize?: (text: string) => string;
  selectTextOnFocus?: boolean;
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
  multiline = false,
  formatOnFocus,
  formatOnBlur,
  sanitize,
  selectTextOnFocus = false,
}: TextFieldProps) {
  const { colors, spacing, typography } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  const handleChangeText = (text: string) => {
    onChangeText(sanitize ? sanitize(text) : text);
  };

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={handleChangeText}
        onFocus={() => {
          setFocused(true);
          if (formatOnFocus) {
            const next = formatOnFocus(value);
            if (next !== value) onChangeText(next);
          }
        }}
        onBlur={() => {
          setFocused(false);
          if (formatOnBlur) {
            const next = formatOnBlur(value);
            if (next !== value) onChangeText(next);
          }
        }}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        multiline={multiline}
        returnKeyType={multiline ? 'default' : 'done'}
        onSubmitEditing={multiline ? undefined : () => Keyboard.dismiss()}
        blurOnSubmit={multiline ? false : true}
        selectTextOnFocus={selectTextOnFocus}
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
          multiline ? styles.multiline : undefined,
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
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  error: {
    marginLeft: 4,
  },
});