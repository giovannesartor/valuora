/**
 * Formats a number as Brazilian Real currency string.
 * @param {number} value - The value to format.
 * @returns {string} Formatted string like "R$ 1.234.567,89"
 */
export default function formatBRL(value) {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
