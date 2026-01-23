export function formatCurrency(value, currencyCode = 'USD') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)}`;
  }
}
