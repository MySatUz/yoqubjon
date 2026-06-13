const BLOCKED_PASSWORDS = new Set([
  '12345678',
  '123456789',
  'admin123',
  'admin1234',
  'password',
  'password1',
  'password12',
  'password123',
  'qwerty123',
]);

export function getPasswordPolicyError(password: string) {
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }

  if (BLOCKED_PASSWORDS.has(password.trim().toLowerCase())) {
    return 'Choose a stronger password';
  }

  return null;
}

export function isBlockedPassword(password: string) {
  return Boolean(getPasswordPolicyError(password));
}
