// Central currency configuration.
// To support other currencies in future, update CURRENCY_CODE and CURRENCY_LOCALE.
export const CURRENCY_CODE   = 'ETB';
export const CURRENCY_LOCALE = 'en-ET';

export const currencyFormatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
  style: 'currency',
  currency: CURRENCY_CODE,
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}
