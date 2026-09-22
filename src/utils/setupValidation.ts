export type SetupInput = {
  name: string;
  username: string;
  password: string;
  confirmPassword: string;
  email?: string;
  phone?: string;
};

export type SetupErrors = {
  name?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
  email?: string;
  phone?: string;
};

export const MIN_PASSWORD_LENGTH = 4;

export function validateSetup(input: SetupInput): SetupErrors {
  const errors: SetupErrors = {};

  if (!input.name.trim()) {
    errors.name = 'El nombre del negocio es obligatorio';
  }

  if (!input.username.trim()) {
    errors.username = 'El usuario es obligatorio';
  }

  const email = (input.email ?? '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Correo electrónico inválido';
  }

  const phone = (input.phone ?? '').trim();
  if (phone && phone.replace(/\D/g, '').length < 8) {
    errors.phone = 'Teléfono inválido';
  }

  if (!input.password) {
    errors.password = 'La contraseña es obligatoria';
  } else {
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`;
    }

    if (!input.confirmPassword) {
      errors.confirmPassword = 'Confirma tu contraseña';
    } else if (input.password !== input.confirmPassword) {
      errors.confirmPassword = 'Las contraseñas no coinciden';
    }
  }

  return errors;
}