import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

const PHONE_REGEX = /\+?\d[\d\s().-]{6,}/g;

export function extractPhonesWithContext(
  text: string,
  defaultCountry: CountryCode = 'US'
) {
  const results: { raw: string; e164?: string; index: number }[] = [];
  const seen = new Set<string>();

  PHONE_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = PHONE_REGEX.exec(text)) !== null) {
    const raw = m[0].trim();
    const parsed = parsePhoneNumberFromString(raw, { defaultCountry });
    const e164 = parsed?.isPossible() ? parsed.number : undefined;
    const key = e164 ?? raw;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ raw, e164, index: m.index ?? 0 });
  }

  return results;
}

export function normalizePhoneNumber(input: string, defaultCountry: CountryCode = "US") {
  const parsed = parsePhoneNumberFromString(input, { defaultCountry });
  if (parsed?.isPossible()) return parsed.number;
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00") && digits.length > 2) return `+${digits.slice(2)}`;
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.startsWith("+")) return digits;
  return `+${digits}`;
}

export function toDialable(normalized: string, trunkPrefix?: string | null) {
  if (!normalized) return normalized;
  const digits = normalized.replace(/\D/g, "");
  if (!digits) return normalized;
  if (trunkPrefix && trunkPrefix.length > 0) {
    return digits.startsWith(trunkPrefix) ? digits : `${trunkPrefix}${digits}`;
  }
  return digits;
}
