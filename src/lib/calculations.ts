// Tax and Total Calculation Utilities
// Single source of truth for all calculations

const TAX_RATE = 0.03; // 3%

export interface OrderCalculation {
  subtotal: number;
  tipAmount: number;
  taxAmount: number;
  total: number;
}

export function calculateOrderTotal(subtotal: number, tipPercentage: number = 0): OrderCalculation {
  const tipAmount = subtotal * (tipPercentage / 100);
  const taxableAmount = subtotal + tipAmount;
  const taxAmount = taxableAmount * TAX_RATE;
  const total = taxableAmount + taxAmount;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    tipAmount: Number(tipAmount.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    total: Number(total.toFixed(2))
  };
}

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
