import {
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";

export type Country = {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
};

const displayNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

function flagEmoji(code: string) {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join("");
}

/** Every country supported for phone numbers, sorted by country name. */
export const COUNTRIES: Country[] = getCountries()
  .map((code) => ({
    code,
    name: displayNames?.of(code) ?? code,
    dialCode: `+${getCountryCallingCode(code)}`,
    flag: flagEmoji(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const DEFAULT_COUNTRY: CountryCode = "IN";

export function findCountry(code: CountryCode) {
  return COUNTRIES.find((c) => c.code === code);
}
