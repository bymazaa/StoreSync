/** Exact decimal helpers for client-side previews; persisted totals are recalculated by Prisma Decimal on the server. */
function parse(value: string | number): { coefficient: bigint; scale: number } {
  const text = String(value).trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return { coefficient: BigInt(0), scale: 0 };
  const fraction = match[3] ?? "";
  const coefficient = BigInt(`${match[1]}${match[2]}${fraction}`);
  return { coefficient, scale: fraction.length };
}

function power10(scale: number) { return BigInt(10) ** BigInt(scale); }

function roundedQuotient(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return (remainder < BigInt(0) ? -remainder : remainder) * BigInt(2) >= denominator
    ? quotient + (numerator < BigInt(0) ? -BigInt(1) : BigInt(1))
    : quotient;
}

export function multiplyDecimal(left: string, right: string, precision = 4): string {
  const a = parse(left); const b = parse(right);
  const coefficient = a.coefficient * b.coefficient;
  const sourceScale = a.scale + b.scale;
  const target = sourceScale > precision ? roundedQuotient(coefficient, power10(sourceScale - precision)) : coefficient * power10(precision - sourceScale);
  return format(target, precision);
}

export function convertUnitDecimal(value: string, fromConversion: string, toConversion: string, precision = 4): string {
  const amount = parse(value); const from = parse(fromConversion); const to = parse(toConversion);
  if (from.coefficient <= BigInt(0)) return "0";
  const numerator = amount.coefficient * to.coefficient * power10(from.scale + precision);
  const denominator = from.coefficient * power10(amount.scale + to.scale);
  return format(roundedQuotient(numerator, denominator), precision);
}

export function moneyProductCents(left: string, right: string): bigint {
  const a = parse(left); const b = parse(right);
  const coefficient = a.coefficient * b.coefficient;
  const scale = a.scale + b.scale;
  return scale > 2 ? roundedQuotient(coefficient, power10(scale - 2)) : coefficient * power10(2 - scale);
}

export function decimalCents(value: string): bigint {
  const parsed = parse(value);
  return parsed.scale > 2 ? roundedQuotient(parsed.coefficient, power10(parsed.scale - 2)) : parsed.coefficient * power10(2 - parsed.scale);
}

export function percentOfCents(amount: bigint, percentage: string): bigint {
  const parsed = parse(percentage);
  return roundedQuotient(amount * parsed.coefficient, BigInt(100) * power10(parsed.scale));
}

export function centsToMoney(cents: bigint): string {
  const sign = cents < BigInt(0) ? "-" : "";
  const absolute = cents < BigInt(0) ? -cents : cents;
  return `${sign}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, "0")}`;
}

function format(coefficient: bigint, scale: number): string {
  const sign = coefficient < BigInt(0) ? "-" : "";
  const absolute = coefficient < BigInt(0) ? -coefficient : coefficient;
  if (scale === 0) return `${sign}${absolute}`;
  const digits = String(absolute).padStart(scale + 1, "0");
  return `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}
