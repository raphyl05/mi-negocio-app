export type LoginErrors = {
  username?: string;
  password?: string;
};

export function validateLogin(input: { username: string; password: string }): LoginErrors {
  const errors: LoginErrors = {};

  if (!input.username.trim()) {
    errors.username = 'El usuario es obligatorio';
  }

  if (!input.password) {
    errors.password = 'La contraseña es obligatoria';
  }

  return errors;
}