/**
 * Formats a number as USD currency string.
 * @param {number} value - The value to format.
 * @param {object} [opts] - Options.
 * @param {boolean} [opts.abbreviate=false] - Use K/M suffixes for large values.
 * @returns {string} Formatted string like "$ 1,234,567.89" or "$ 1.50M"
 */
export default function formatBRL(value, { abbreviate = false } = {}) {
  if (value == null || isNaN(value)) return '—';
  if (abbreviate) {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}$ ${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}$ ${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$ ${abs.toFixed(2)}`;
  }
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/**
 * Alias for clarity — same function, USD formatting.
 */
export const formatUSD = formatBRL;
