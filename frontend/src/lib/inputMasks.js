// Auto-formatting for Tax ID (SSN/EIN) and Phone
export function formatCPF_CNPJ(value) {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length <= 9) {
    // EIN: XX-XXXXXXX
    if (digits.length <= 2) return digits;
    return `${digits.slice(0,2)}-${digits.slice(2)}`;
  } else {
    // SSN: XXX-XX-XXXX (for individual users)
    return digits.slice(0, 9)
      .replace(/(\d{3})(\d)/, '$1-$2')
      .replace(/(\d{2})(\d)/, '$1-$2');
  }
}

export function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
}

// Calculate password strength (0-100)
export function calculatePasswordStrength(password) {
  if (!password) return 0;
  
  let strength = 0;
  
  // Length
  if (password.length >= 8) strength += 25;
  if (password.length >= 12) strength += 10;
  
  // Uppercase letters
  if (/[A-Z]/.test(password)) strength += 15;
  
  // Numbers
  if (/[0-9]/.test(password)) strength += 15;
  
  // Special characters
  if (/[^A-Za-z0-9]/.test(password)) strength += 20;
  
  // Character variety
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  
  const varietyCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
  strength += varietyCount * 5;
  
  return Math.min(strength, 100);
}

export function getStrengthColor(strength) {
  if (strength < 40) return 'bg-red-500';
  if (strength < 70) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function getStrengthText(strength) {
  if (strength < 40) return 'Weak';
  if (strength < 70) return 'Medium';
  return 'Strong';
}

// Validates an EIN (Employer Identification Number, digits-only string, length 9)
export function validateCNPJ(ein) {
  const digits = ein.replace(/\D/g, '');
  if (digits.length !== 9) return false;
  // Reject all-same-digit patterns
  if (/^(\d)\1{8}$/.test(digits)) return false;
  // Basic format validation — first two digits are the campus prefix (01-99)
  const prefix = parseInt(digits.slice(0, 2));
  return prefix >= 1 && prefix <= 99;
}