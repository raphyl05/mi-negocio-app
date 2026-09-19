export type SecurityErrors = {
  question?: string;
  answer?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export function validateSecurityQuestion(question: string): string | null {
  const trimmed = question.trim();
  if (!trimmed) return 'Escribe una pregunta de seguridad.';
  if (trimmed.length < 5) return 'La pregunta es demasiado corta.';
  return null;
}

export function validateAnswer(answer: string): string | null {
  if (!answer.trim()) return 'Escribe la respuesta a tu pregunta de seguridad.';
  if (answer.trim().length < 2) return 'La respuesta es demasiado corta.';
  return null;
}

export function validateNewPassword(newPassword: string, confirmPassword: string): SecurityErrors {
  const errors: SecurityErrors = {};
  if (newPassword.length < 6) {
    errors.newPassword = 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (confirmPassword !== newPassword) {
    errors.confirmPassword = 'Las contraseñas no coinciden.';
  }
  return errors;
}