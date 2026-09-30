import Decimal from "decimal.js";

const currencyFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("en-ZA", {
  useGrouping: true,
  maximumFractionDigits: 0,
});

const documentDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

export function formatCurrency(value: Decimal.Value): string {
  const amount = new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const isNegative = amount.isNegative() && !amount.isZero();
  const [integer, fraction] = amount.abs().toFixed(2).split(".");
  const sampleParts = currencyFormatter.formatToParts(isNegative ? -1234.56 : 1234.56);
  const integerIndex = sampleParts.findIndex((part) => part.type === "integer");
  const fractionIndex = sampleParts.findIndex((part) => part.type === "fraction");
  const prefix = sampleParts.slice(0, integerIndex).map((part) => part.value).join("");
  const suffix = sampleParts.slice(fractionIndex + 1).map((part) => part.value).join("");
  const decimalSeparator = sampleParts.find((part) => part.type === "decimal")?.value ?? ".";

  return `${prefix}${integerFormatter.format(BigInt(integer))}${decimalSeparator}${fraction}${suffix}`;
}

export function formatDocumentDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError("Date must use YYYY-MM-DD format.");
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError("Date must be a valid calendar date.");
  }

  return documentDateFormatter.format(date);
}