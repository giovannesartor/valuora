/**
 * Formats a number as Brazilian Real currency string.
 * @param {number} value - The value to format.
 * @param {object} [opts] - Options.
 * @param {boolean} [opts.abbreviate=false] - Use K/M suffixes for large values.
 * @returns {string} Formatted string like "R$ 1.234.567,89" or "R$ 1,50M"
 */
export default function formatBRL(value, { abbreviate = false } = {}) {
  if (value == null || isNaN(value)) return '—';
  if (abbreviate) {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(1)}K`;
    return `${sign}R$ ${abs.toFixed(2)}`;
  }
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
