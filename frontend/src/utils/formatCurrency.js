export function formatCurrency(value, currencyCode = 'USD') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';

  const normalizedCurrency = String(currencyCode || 'USD').toUpperCase();

  // DOP se muestra con prefijo local explícito: RD$ 1,000
  if (normalizedCurrency === 'DOP') {
    const hasDecimals = Math.abs(numeric % 1) > Number.EPSILON;
    const formattedNumber = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2
    }).format(numeric);
    return `RD$ ${formattedNumber}`;
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)}`;
  }
}
