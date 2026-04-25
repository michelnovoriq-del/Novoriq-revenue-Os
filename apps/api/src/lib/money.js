const CENTS_PER_DOLLAR = 100;

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function dollarsToCents(amount) {
  return isFiniteNumber(amount) ? Math.round(amount * CENTS_PER_DOLLAR) : 0;
}

export function nullableDollarsToCents(amount) {
  if (amount === null || amount === undefined) {
    return null;
  }

  return dollarsToCents(amount);
}

export function centsToDollars(cents) {
  return isFiniteNumber(cents) ? cents / CENTS_PER_DOLLAR : 0;
}

export function nullableCentsToDollars(cents) {
  if (cents === null || cents === undefined) {
    return null;
  }

  return centsToDollars(cents);
}

export function normalizeStoredCents({ cents, amount, defaultValue = 0 }) {
  if (isFiniteNumber(cents)) {
    return Math.round(cents);
  }

  if (amount === null || amount === undefined) {
    return defaultValue;
  }

  return dollarsToCents(amount);
}

export function normalizeNullableStoredCents({ cents, amount }) {
  if (cents === null || amount === null) {
    return null;
  }

  if (isFiniteNumber(cents)) {
    return Math.round(cents);
  }

  if (amount === undefined) {
    return undefined;
  }

  return nullableDollarsToCents(amount);
}

export function calculateFeeCents(recoveredAmountCents, percentage) {
  if (!isFiniteNumber(recoveredAmountCents) || !isFiniteNumber(percentage)) {
    return 0;
  }

  return Math.round(recoveredAmountCents * percentage);
}

export function formatCentsAsCurrency(cents) {
  return centsToDollars(cents).toFixed(2);
}
