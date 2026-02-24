// Formatação automática de CPF/CNPJ e Telefone
export function formatCPF_CNPJ(value) {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    // CNPJ: 00.000.000/0001-00
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
}

export function formatPhone(value) {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length <= 10) {
    // (11) 1234-5678
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  } else {
    // (11) 91234-5678
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  }
}

// Calcula força da senha (0-100)
export function calculatePasswordStrength(password) {
  if (!password) return 0;
  
  let strength = 0;
  
  // Comprimento
  if (password.length >= 8) strength += 25;
  if (password.length >= 12) strength += 10;
  
  // Letras maiúsculas
  if (/[A-Z]/.test(password)) strength += 15;
  
  // Números
  if (/[0-9]/.test(password)) strength += 15;
  
  // Caracteres especiais
  if (/[^A-Za-z0-9]/.test(password)) strength += 20;
  
  // Variedade de caracteres
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
  if (strength < 40) return 'Fraca';
  if (strength < 70) return 'Média';
  return 'Forte';
}