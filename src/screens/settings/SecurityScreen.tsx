import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import PrimaryButton from '../../components/PrimaryButton';
import Screen from '../../components/Screen';
import TextField from '../../components/TextField';
import { useAuth } from '../../contexts/AuthContext';
import type { RootStackParamList } from '../../navigation/types';
import { getUser, hasSecurityQuestion, saveSecurityQuestion, setNewPassword, verifyLogin } from '../../services/setupService';
import { useTheme } from '../../theme';
import { validateAnswer, validateNewPassword, validateSecurityQuestion } from '../../utils/securityValidation';
import type { SecurityErrors } from '../../utils/securityValidation';

export default function SecurityScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [username, setUsername] = useState('');
  const [hasQuestion, setHasQuestion] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [savingQ, setSavingQ] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPasswordValue] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<SecurityErrors>({});
  const [savingP, setSavingP] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    getUser().then((user) => {
      if (user) setUsername(user.username);
    });
    hasSecurityQuestion().then(setHasQuestion);
    setLoaded(true);
  }, []);

  const handleSaveQuestion = async () => {
    const questionIssue = validateSecurityQuestion(question);
    const answerIssue = validateAnswer(answer);
    setQuestionError(questionIssue);
    setAnswerError(answerIssue);
    if (questionIssue || answerIssue) return;

    setSavingQ(true);
    try {
      const saved = await saveSecurityQuestion(question, answer);
      if (!saved) return;
      setHasQuestion(true);
      setAnswer('');
      Alert.alert('Listo', 'Tu pregunta de seguridad quedó guardada. La usarás para recuperar la contraseña.');
    } finally {
      setSavingQ(false);
    }
  };

  const handleChangePassword = async () => {
    const errors = validateNewPassword(newPassword, confirmPassword);
    setPasswordErrors(errors);
    setPasswordError(null);
    if (Object.keys(errors).length > 0) return;

    const currentOk = await verifyLogin(username, currentPassword);
    if (!currentOk) {
      setPasswordError('La contraseña actual no es correcta.');
      return;
    }

    const saved = await setNewPassword(username, newPassword);
    if (!saved) {
      setPasswordError('No se pudo cambiar la contraseña. Intenta nuevamente.');
      return;
    }
    setCurrentPassword('');
    setNewPasswordValue('');
    setConfirmPassword('');
    Alert.alert('Contraseña actualizada', 'Tu nueva contraseña ya está activa.');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text
          style={[
            styles.title,
            { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
          ]}
        >
          Seguridad
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
          Usuario: {username || '…'}
        </Text>

        <Card style={styles.card}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
            {hasQuestion ? 'CAMBIAR PREGUNTA DE SEGURIDAD' : 'PREGUNTA DE SEGURIDAD'}
          </Text>
          <Text style={[styles.note, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
            {hasQuestion
              ? 'La usarás si olvidas tu contraseña. Puedes actualizarla aquí.'
              : 'Defínela para poder recuperar tu contraseña si la olvidas.'}
          </Text>
          <TextField label="Pregunta secreta" value={question} onChangeText={(t) => { setQuestion(t); setQuestionError(null); }} error={questionError ?? undefined} placeholder="Ej. ¿Cuál es el nombre de tu primera mascota?" />
          <TextField label="Respuesta" value={answer} onChangeText={(t) => { setAnswer(t); setAnswerError(null); }} error={answerError ?? undefined} placeholder="Tu respuesta (no distingue mayúsculas)" />
          <PrimaryButton label={hasQuestion ? 'Guardar nueva pregunta' : 'Guardar pregunta'} onPress={handleSaveQuestion} loading={savingQ} />
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
            CAMBIAR CONTRASEÑA
          </Text>
          {passwordError ? (
            <View style={[styles.banner, { backgroundColor: colors.danger }]}>
              <Text style={[styles.bannerText, { color: colors.white }]}>{passwordError}</Text>
            </View>
          ) : null}
          <TextField label="Contraseña actual" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholder="Para confirmar el cambio" autoCapitalize="none" />
          <TextField label="Nueva contraseña" value={newPassword} onChangeText={setNewPasswordValue} secureTextEntry error={passwordErrors.newPassword} placeholder="Mínimo 6 caracteres" autoCapitalize="none" />
          <TextField label="Confirmar contraseña" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry error={passwordErrors.confirmPassword} autoCapitalize="none" />
          <PrimaryButton label="Cambiar contraseña" variant="outline" onPress={handleChangePassword} loading={savingP} />
        </Card>

        <Text style={[styles.footer, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          Si olvidas la contraseña, usa “¿Olvidaste tu contraseña?” en la pantalla de inicio de sesión y responde la pregunta
          de seguridad.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  title: {
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 16,
  },
  card: {
    gap: 12,
    marginBottom: 16,
  },
  sectionLabel: {
    letterSpacing: 1,
    fontWeight: '700',
  },
  note: {
    lineHeight: 20,
  },
  banner: {
    borderRadius: 12,
    padding: 12,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    marginTop: 4,
  },
});