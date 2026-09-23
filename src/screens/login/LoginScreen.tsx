import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Column from '../../components/Column';
import PrimaryButton from '../../components/PrimaryButton';
import Screen from '../../components/Screen';
import TextField from '../../components/TextField';
import { getUser, isSetupDone, setNewPassword, verifyLogin, verifySecurityAnswer } from '../../services/setupService';
import { apiLogin, apiRecoveryRequest, apiRecoveryResetPassword, apiRecoveryVerify } from '../../services/authApi';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../theme';
import { getDeviceId } from '../../utils/syncIdentity';
import { validateAnswer, validateNewPassword } from '../../utils/securityValidation';
import { validateLogin } from '../../utils/loginValidation';
import type { LoginErrors } from '../../utils/loginValidation';

type LoginScreenProps = {
  onLogin: () => void;
  onCreateAccount: () => void;
};

type SecurityErrors = {
  username?: string;
  answer?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export default function LoginScreen({ onLogin, onCreateAccount }: LoginScreenProps) {
  const { colors, spacing, typography } = useTheme();
  const { login: authLogin } = useAuth();
  const [mode, setMode] = useState<'login' | 'recover' | 'cloud' | 'create'>('login');
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const [netError, setNetError] = useState<string | null>(null);

  useEffect(() => {
    const detect = async () => {
      try {
        const setupDone = await isSetupDone();
        const user = await getUser();
        setHasAccount(setupDone && !!user);
        setMode(setupDone && !!user ? 'login' : 'create');
      } catch {
        setHasAccount(false);
        setMode('create');
      }
    };
    void detect();
  }, []);

  if (mode === 'recover') {
    return <RecoveryForm onBack={() => setMode('login')} onLogin={onLogin} />;
  }

  if (mode === 'cloud') {
    return <CloudRecoveryForm onBack={() => setMode('login')} onLogin={onLogin} />;
  }

  if (mode === 'create') {
    return <CreateAccountView onCreateAccount={onCreateAccount} onLoadAccount={() => setMode('login')} accountExists={hasAccount} />;
  }

  return (
    <LoginForm
      onLogin={onLogin}
      onAuthLogin={authLogin}
      netError={netError}
      setNetError={setNetError}
      onCreate={() => setMode('create')}
      onForgot={() => setMode('recover')}
      onCloudForgot={() => setMode('cloud')}
    />
  );
}

function LoginForm({ onLogin, onAuthLogin, netError, setNetError, onCreate, onForgot, onCloudForgot }: { onLogin: () => void; onAuthLogin: (identifier: string, password: string, deviceId: string) => Promise<{ ok: boolean; error?: { code: string; message: string } }>; netError: string | null; setNetError: (e: string | null) => void; onCreate: () => void; onForgot?: () => void; onCloudForgot?: () => void }) {
  const { colors, spacing, typography } = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const nextErrors = validateLogin({ username, password });
    setErrors(nextErrors);
    setGeneralError(null);
    setNetError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const deviceId = await getDeviceId();
      const res = await onAuthLogin(username, password, deviceId);
      if (res.ok) {
        onLogin();
      } else if (res.error?.code === 'NETWORK') {
        setNetError('Sin conexion. Intenta de nuevo cuando tengas red.');
      } else {
        setGeneralError(res.error?.message || 'Usuario o contrasea incorrectos.');
      }
    } catch {
      setGeneralError('No se pudo iniciar sesin. Intntalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Column>
            <View style={styles.header}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight, overflow: 'hidden' }]}>
                <Image source={require('../../../assets/logo-vendelo-app.png')} style={styles.logo} resizeMode="contain" />
              </View>
              <Text
                style={[
                  styles.title,
                  { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
                ]}
              >
                Iniciar sesión
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
                Ingresa con tu correo y contraseña
              </Text>
            </View>

            {generalError ? (
              <View style={[styles.banner, { backgroundColor: colors.danger }]}>
                <Text style={[styles.bannerText, { color: colors.white }]}>{generalError}</Text>
              </View>
            ) : null}

            <View style={styles.form}>
              <TextField
                label="Correo o usuario"
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  setGeneralError(null);
                }}
                error={errors.username}
                placeholder="Tu correo o usuario"
                autoCapitalize="none"
              />
              <TextField
                label="Contraseña"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setGeneralError(null);
                }}
                error={errors.password}
                secureTextEntry
                placeholder="Tu contraseña"
              />
            </View>

            <View style={styles.action}>
              <PrimaryButton label="Entrar" onPress={handleSubmit} loading={loading} />
            </View>

            {onCreate ? (
              <Pressable onPress={onCreate} hitSlop={8} style={styles.forgotLink}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption, fontWeight: '500' }}>
                  ¿Es tu primera vez? Crea tu cuenta aquí.
                </Text>
              </Pressable>
            ) : null}

            {onForgot ? (
              <Pressable onPress={onForgot} hitSlop={8} style={styles.forgotLink}>
                <Text style={{ color: colors.primary, fontSize: typography.sizes.body, fontWeight: '600' }}>
                  ¿Olvidaste tu contraseña?
                </Text>
              </Pressable>
            ) : null}

            {onCloudForgot ? (
              <Pressable onPress={onCloudForgot} hitSlop={8} style={styles.cloudLink}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption, fontWeight: '500' }}>
                  ¿Perdiste tu teléfono? Recupera tu cuenta con tu correo o teléfono.
                </Text>
              </Pressable>
            ) : null}
          </Column>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function CreateAccountView({ onCreateAccount, onLoadAccount, accountExists }: { onCreateAccount: () => void; onLoadAccount: () => void; accountExists: boolean | null }) {
  const { colors, spacing, typography } = useTheme();

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Column>
            <View style={styles.header}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight, overflow: 'hidden' }]}>
                <Image source={require('../../../assets/logo-vendelo-app.png')} style={styles.logo} resizeMode="contain" />
              </View>
              <Text
                style={[
                  styles.title,
                  { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
                ]}
              >
                Crea tu cuenta
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
                {accountExists === false
                  ? 'Este dispositivo aún no tiene cuenta. Crea la tuya para empezar.'
                  : 'Detectamos que aún no tienes una cuenta en este dispositivo. Configúrala para empezar.'}
              </Text>
            </View>

            <View style={styles.action}>
              <PrimaryButton label="Crear mi cuenta" onPress={onCreateAccount} />
            </View>

            <Pressable onPress={onLoadAccount} hitSlop={8} style={styles.forgotLink}>
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption, fontWeight: '500' }}>
                ¿Ya tienes una cuenta? Inicia sesión
              </Text>
            </Pressable>
          </Column>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function RecoveryForm({ onBack, onLogin }: { onBack: () => void; onLogin: () => void }) {
  const { colors, spacing, typography } = useTheme();

  const [username, setUsername] = useState('');
  const [hasQuestion, setHasQuestion] = useState<boolean | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [verified, setVerified] = useState(false);
  const [firstPassword, setFirstPassword] = useState(false);
  const [newPassword, setNewPasswordValue] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<SecurityErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const checkUser = async () => {
    setErrors((prev) => ({ ...prev, username: undefined }));
    setGeneralError(null);
    setVerified(false);
    setFirstPassword(false);
    if (!username.trim()) {
      setErrors((prev) => ({ ...prev, username: 'Escribe tu usuario.' }));
      return;
    }
    setLoading(true);
    try {
      const user = await getUser();
      if (!user || user.username.trim().toLocaleLowerCase() !== username.trim().toLocaleLowerCase()) {
        setGeneralError('Ese usuario no existe.');
        setHasQuestion(null);
        return;
      }
      if (!user.passwordHash || !user.passwordSalt) {
        setHasQuestion(null);
        setFirstPassword(true);
        return;
      }
      if (!user.securityQuestion) {
        setHasQuestion(false);
        return;
      }
      setHasQuestion(true);
      setQuestion(user.securityQuestion);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async () => {
    const issue = validateAnswer(answer);
    setErrors((prev) => ({ ...prev, answer: issue ?? undefined }));
    if (issue) return;
    setLoading(true);
    setGeneralError(null);
    try {
      const ok = await verifySecurityAnswer(username, answer);
      if (!ok) {
        setGeneralError('La respuesta no es correcta. Inténtalo de nuevo.');
        return;
      }
      setAnswer('');
      setVerified(true);
    } finally {
      setLoading(false);
    }
  };

  const handleNewPassword = async () => {
    const next = validateNewPassword(newPassword, confirmPassword);
    setErrors(next);
    setGeneralError(null);
    if (Object.keys(next).length > 0) return;
    setLoading(true);
    try {
      const saved = await setNewPassword(username, newPassword);
      if (!saved) {
        setGeneralError('No se pudo cambiar la contraseña.');
        return;
      }
      setNewPasswordValue('');
      setConfirmPassword('');
      onLogin();
    } finally {
      setLoading(false);
    }
  };

  const showQuestionForm = hasQuestion === true && !verified;
  const showNewPasswordForm = hasQuestion === true && verified;

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Column>
            <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="shield-checkmark-outline" size={36} color={colors.primary} />
            </View>
            <Text
              style={[
                styles.title,
                { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
              ]}
            >
              Recuperar contraseña
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
              Responde tu pregunta de seguridad para crear una nueva contraseña.
            </Text>
          </View>

          {generalError ? (
            <View style={[styles.banner, { backgroundColor: colors.danger }]}>
              <Text style={[styles.bannerText, { color: colors.white }]}>{generalError}</Text>
            </View>
          ) : null}

          {hasQuestion === null && !firstPassword ? (
            <View style={styles.form}>
              <TextField
                label="Usuario"
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  setGeneralError(null);
                }}
                error={errors.username}
                placeholder="Tu usuario"
                autoCapitalize="none"
              />
              <PrimaryButton label="Continuar" onPress={checkUser} loading={loading} />
            </View>
          ) : null}

          {firstPassword ? (
            <View style={styles.form}>
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>
                Tu cuenta fue restaurada desde un respaldo y no tiene contraseña. Crea una nueva para ingresar.
              </Text>
              <TextField
                label="Nueva contraseña"
                value={newPassword}
                onChangeText={setNewPasswordValue}
                secureTextEntry
                error={errors.newPassword}
                placeholder="Mínimo 6 caracteres"
                autoCapitalize="none"
              />
              <TextField
                label="Confirmar contraseña"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                error={errors.confirmPassword}
                autoCapitalize="none"
              />
              <PrimaryButton label="Crear contraseña" onPress={handleNewPassword} loading={loading} />
            </View>
          ) : null}

          {hasQuestion === false ? (
            <View style={styles.card}>
              <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body, lineHeight: 22 }}>
                Este usuario aún no tiene una pregunta de seguridad configurada. Defínela en{' '}
                <Text style={{ fontWeight: '700' }}>Más → Seguridad</Text> mientras estés conectado, y podrás recuperar la
                contraseña aquí.
              </Text>
              <PrimaryButton label="Volver a iniciar sesión" variant="outline" onPress={onBack} />
            </View>
          ) : null}

          {showQuestionForm ? (
            <View style={styles.form}>
              <View style={[styles.questionBox, { backgroundColor: colors.surfaceMuted, borderRadius: 14 }]}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption, fontWeight: '700', marginBottom: 4 }}>
                  PREGUNTA DE SEGURIDAD
                </Text>
                <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '600' }}>{question}</Text>
              </View>
              <TextField
                label="Respuesta"
                value={answer}
                onChangeText={(text) => {
                  setAnswer(text);
                  setGeneralError(null);
                }}
                error={errors.answer}
                placeholder="Tu respuesta"
                autoCapitalize="none"
              />
              <PrimaryButton label="Verificar respuesta" onPress={handleAnswer} loading={loading} />
              <PrimaryButton label="Volver" variant="outline" onPress={onBack} />
            </View>
          ) : null}

          {showNewPasswordForm ? (
            <View style={styles.form}>
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>
                Respuesta verificada. Elige tu nueva contraseña.
              </Text>
              <TextField
                label="Nueva contraseña"
                value={newPassword}
                onChangeText={setNewPasswordValue}
                secureTextEntry
                error={errors.newPassword}
                placeholder="Mínimo 6 caracteres"
                autoCapitalize="none"
              />
              <TextField
                label="Confirmar contraseña"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                error={errors.confirmPassword}
                autoCapitalize="none"
              />
              <PrimaryButton label="Guardar nueva contraseña" onPress={handleNewPassword} loading={loading} />
            </View>
          ) : null}
        </Column>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function CloudRecoveryForm({ onBack }: { onBack: () => void; onLogin: () => void }) {
  const { colors, typography } = useTheme();
  const [step, setStep] = useState<'identifier' | 'code' | 'password'>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [recoveryToken, setRecoveryToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestCode = async () => {
    const id = identifier.trim();
    setGeneralError(null);
    if (id.length < 3) {
      setGeneralError('Escribe tu correo o tu teléfono.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRecoveryRequest(id);
      if (!res.ok || !res.data) {
        setGeneralError(res.error?.message || 'No se pudo pedir el código.');
        return;
      }
      setDebugCode(res.data.debugCode ?? null);
      setStep('code');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setGeneralError(null);
    if (!code.trim()) {
      setGeneralError('Escribe el código que recibiste.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRecoveryVerify(identifier.trim(), code.trim());
      if (!res.ok || !res.data) {
        setGeneralError(res.error?.message || 'El código no es correcto.');
        return;
      }
      setRecoveryToken(res.data.recoveryToken);
      setStep('password');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    setGeneralError(null);
    if (newPassword.length < 6) {
      setGeneralError('La contraseña debe tener mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setGeneralError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRecoveryResetPassword(recoveryToken, newPassword);
      if (!res.ok) {
        setGeneralError(res.error?.message || 'No se pudo cambiar la contraseña.');
        return;
      }
      Alert.alert('Contraseña restablecida', '¿Volvemos a la pantalla de inicio de sesión para entrar con tu nueva contraseña?');
      onBack();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Column>
            <View style={styles.header}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="cloud-upload-outline" size={36} color={colors.primary} />
              </View>
              <Text
                style={[
                  styles.title,
                  { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
                ]}
              >
                Recuperar cuenta
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
                Te enviaremos un código al correo o teléfono de tu cuenta para crear una nueva contraseña.
              </Text>
            </View>

            {generalError ? (
              <View style={[styles.banner, { backgroundColor: colors.danger }]}>
                <Text style={[styles.bannerText, { color: colors.white }]}>{generalError}</Text>
              </View>
            ) : null}

            {step === 'identifier' ? (
              <View style={styles.form}>
                <TextField
                  label="Correo o teléfono"
                  value={identifier}
                  onChangeText={(text) => {
                    setIdentifier(text);
                    setGeneralError(null);
                  }}
                  placeholder="tucorreo@ejemplo.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <PrimaryButton label="Enviar código" onPress={requestCode} loading={loading} />
                <PrimaryButton label="Volver" variant="outline" onPress={onBack} />
              </View>
            ) : null}

            {step === 'code' ? (
              <View style={styles.form}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>
                  Ingresa el código de 6 dígitos que enviamos.
                </Text>
                {debugCode ? (
                  <View style={[styles.questionBox, { backgroundColor: colors.surfaceMuted, borderRadius: 14 }]}>
                    <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption, fontWeight: '700', marginBottom: 4 }}>
                      MODO DESARROLLO
                    </Text>
                    <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }}>{debugCode}</Text>
                  </View>
                ) : null}
                <TextField
                  label="Código"
                  value={code}
                  onChangeText={(text) => {
                    setCode(text);
                    setGeneralError(null);
                  }}
                  keyboardType="number-pad"
                  placeholder="000000"
                />
                <PrimaryButton label="Verificar código" onPress={verifyCode} loading={loading} />
                <PrimaryButton label="Volver" variant="outline" onPress={() => { setStep('identifier'); setGeneralError(null); }} />
              </View>
            ) : null}

            {step === 'password' ? (
              <View style={styles.form}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>
                  Crea tu nueva contraseña. Las demás sesiones se cerrarán.
                </Text>
                <TextField
                  label="Nueva contraseña"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholder="Mínimo 6 caracteres"
                  autoCapitalize="none"
                />
                <TextField
                  label="Confirmar contraseña"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <PrimaryButton label="Guardar nueva contraseña" onPress={resetPassword} loading={loading} />
              </View>
            ) : null}
          </Column>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 72,
    height: 72,
  },
  title: {
    letterSpacing: -0.5,
  },
  subtitle: {
    textAlign: 'center',
  },
  banner: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  card: {
    gap: 16,
  },
  questionBox: {
    padding: 14,
  },
  action: {
    marginTop: 24,
  },
  forgotLink: {
    alignSelf: 'center',
    marginTop: 18,
  },
  cloudLink: {
    alignSelf: 'center',
    marginTop: 10,
  },
});