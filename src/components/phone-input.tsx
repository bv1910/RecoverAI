import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  AsYouType,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

import { COUNTRIES, DEFAULT_COUNTRY, findCountry } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Validates a national number for a country and returns the E.164 value. */
export function toE164(national: string, country: CountryCode): string | null {
  const parsed = parsePhoneNumberFromString(national, country);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

type Props = {
  country: CountryCode;
  onCountryChange: (country: CountryCode) => void;
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function PhoneInput({
  country,
  onCountryChange,
  value,
  onValueChange,
  id,
  disabled,
  ariaLabel = "Phone number",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = findCountry(country) ?? findCountry(DEFAULT_COUNTRY)!;

  const placeholder = useMemo(() => {
    const examples: Partial<Record<string, string>> = {
      IN: "98765 43210",
      US: "(555) 000-1234",
      GB: "7400 123456",
    };
    return examples[country] ?? "Phone number";
  }, [country]);

  const handleChange = (raw: string) => {
    const formatter = new AsYouType(country);
    onValueChange(formatter.input(raw.replace(/[^\d\s()+-]/g, "")));
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select country calling code"
            disabled={disabled}
            className="h-12 shrink-0 gap-1.5 rounded-xl px-3 font-normal"
          >
            <span className="text-base leading-none">{selected.flag}</span>
            <span className="text-sm text-foreground">{selected.dialCode}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command
            filter={(itemValue, search) =>
              itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
            }
          >
            <CommandInput placeholder="Search country or code…" />
            <CommandList>
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {COUNTRIES.map((c) => (
                  <CommandItem
                    key={c.code}
                    value={`${c.name} ${c.dialCode} ${c.code}`}
                    onSelect={() => {
                      onCountryChange(c.code);
                      setOpen(false);
                    }}
                    className="gap-2"
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="flex-1 truncate text-sm">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.dialCode}</span>
                    {c.code === country ? (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        aria-label={ariaLabel}
        disabled={disabled}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        maxLength={24}
        className="h-12 rounded-xl"
      />
    </div>
  );
}
