// Mirrors the server's password rules (accounts/validators.py and settings).
export const PASSWORD_RULES: { label: string; test: (password: string) => boolean }[] = [
  { label: 'At least 10 characters', test: (p) => p.length >= 10 },
  { label: 'A capital letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'A number', test: (p) => /[0-9]/.test(p) },
  { label: 'A special character (like ! or #)', test: (p) => /[^A-Za-z0-9]/.test(p) },
]
