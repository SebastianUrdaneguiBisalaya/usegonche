"use client";

import { Globe } from "lucide-react";
import * as React from "react";
import PhoneInputLib, {
  type Country,
  type Flags,
  getCountryCallingCode,
  isValidPhoneNumber,
  type Labels,
} from "react-phone-number-input";
import { Icon } from "../../foundations/icon/icon";
import { Input } from "../input/input";
import { Select } from "../select/select";

interface CountrySelectOption {
  readonly value?: Country;
  readonly label: string;
  readonly divider?: boolean;
}

interface PhoneInputCountrySelectProps {
  readonly value?: Country;
  readonly options: readonly CountrySelectOption[];
  readonly onChange: (country?: Country) => void;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly flags?: Flags;
  readonly searchPlaceholder: string;
  readonly "aria-label"?: string;
}

const INTERNATIONAL = "ZZ";

/** A country's flag when `flags` is provided, otherwise its ISO code — never both, so rows stay one weight. */
function CountryMark({
  country,
  name,
  flags,
}: {
  readonly country: Country;
  readonly name: string;
  readonly flags?: Flags;
}) {
  const Flag = flags?.[country];

  return Flag ? (
    <span className="flex h-3.5 w-5 shrink-0 overflow-hidden rounded-[2px] border border-border [&>svg]:size-full">
      <Flag title={name} />
    </span>
  ) : (
    <span className="w-5 shrink-0 font-medium">{country}</span>
  );
}

/**
 * Country picker slot of `PhoneInput`: a compact `Select` trigger (flag or ISO
 * code, calling code) opening a searchable list. Search matches the country
 * name, its ISO code and its calling code.
 */
function PhoneInputCountrySelect({
  value,
  options,
  onChange,
  disabled,
  readOnly,
  flags,
  searchPlaceholder,
  "aria-label": ariaLabel,
}: PhoneInputCountrySelectProps) {
  const selected = options.find(
    (option) => !option.divider && option.value === value,
  );

  return (
    <Select.Root
      className="h-auto shrink-0"
      onChange={(next: string) =>
        onChange(next === INTERNATIONAL ? undefined : (next as Country))
      }
      value={value ?? INTERNATIONAL}
    >
      <Select.Trigger
        aria-label={ariaLabel}
        className="h-auto w-auto gap-1.5 rounded-sm border-0 bg-transparent p-0"
        disabled={disabled || readOnly}
      >
        {value ? (
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <CountryMark
              country={value}
              flags={flags}
              name={selected?.label ?? value}
            />
            <span className="text-muted-foreground">
              +{getCountryCallingCode(value)}
            </span>
          </span>
        ) : (
          <Icon
            aria-hidden="true"
            icon={Globe}
            size="sm"
          />
        )}
      </Select.Trigger>
      <Select.Content width={288}>
        <Select.Search placeholder={searchPlaceholder} />
        <Select.ItemList>
          {options
            .filter((option) => !option.divider)
            .map((option) => (
              <Select.Item
                key={option.value ?? INTERNATIONAL}
                label={
                  option.value
                    ? `${option.label} ${option.value} +${getCountryCallingCode(option.value)}`
                    : option.label
                }
                value={option.value ?? INTERNATIONAL}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  {option.value ? (
                    <CountryMark
                      country={option.value}
                      flags={flags}
                      name={option.label}
                    />
                  ) : (
                    <Icon
                      aria-hidden="true"
                      className="w-5"
                      icon={Globe}
                      size="sm"
                    />
                  )}
                  <span className="truncate">{option.label}</span>
                  {option.value && (
                    <span className="ml-auto shrink-0 text-muted-foreground">
                      +{getCountryCallingCode(option.value)}
                    </span>
                  )}
                </span>
              </Select.Item>
            ))}
        </Select.ItemList>
      </Select.Content>
    </Select.Root>
  );
}

export interface PhoneInputRootProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "defaultValue" | "onChange"
  > {
  /** Phone number in E.164 format (e.g. `"+14155550123"`), for controlled usage. Pair it with `onChange`. */
  value?: string;
  /** Initial phone number in E.164 format, for uncontrolled usage. */
  defaultValue?: string;
  /** Called with the E.164 number whenever it changes, or `undefined` when the field is empty or incomplete. */
  onChange?: (value?: string) => void;
  /** ISO 3166-1 alpha-2 country preselected when there is no number yet (e.g. `"US"`). */
  defaultCountry?: Country;
  /** Restricts the picker to these countries. Omit it to list every supported country. */
  countries?: Country[];
  /**
   * Embedded SVG flags, shown beside the calling code. Import them with `import flags from "react-phone-number-input/flags"` — they are left out by default so the bundle stays small, and the picker shows the ISO code instead.
   */
  flags?: Flags;
  /**
   * Country names and the picker's accessible name, for localizing. Import one with e.g. `import es from "react-phone-number-input/locale/es.json"`.
   */
  labels?: Labels;
  /** Shows the number in international format (`+1 415 555 0123`) and lets the user type a calling code to switch country. @default false */
  international?: boolean;
  /**
   * Placeholder of the country picker's search field.
   * @default "Search country"
   */
  searchPlaceholder?: string;
  /** Placeholder shown while the field is empty. */
  placeholder?: string;
  /** Name of the underlying `<input>`, for native form submission. */
  name?: string;
  /** Disables the field and the country picker. @default false */
  disabled?: boolean;
  /**
   * Stops the user typing past the longest valid length for the selected country (e.g. 9 digits in Peru). Needs a country: it has no effect in `international` mode until one is chosen.
   * @default true
   */
  limitMaxLength?: boolean;
  /** Error text shown below the field; also wired to the field via `aria-invalid`/`aria-describedby`. Takes precedence over `invalidMessage`. */
  errorMessage?: string;
  /** Error text shown automatically once the field has been left with an incomplete or invalid number. Leave it out to validate yourself with `errorMessage`. */
  invalidMessage?: string;
  /** Called when the number input loses focus. */
  onBlur?: React.FocusEventHandler<HTMLElement>;
}

/**
 * Compound telephone field: a searchable country picker (`Select`) plus a number input that
 * formats as you type and validates the national length per country
 * (via `react-phone-number-input`). Built on `Input`, so its container,
 * padding, gap, label and error text are identical to it. Value is the
 * E.164 string, ready to store or send.
 * @example
 * ```tsx
 * const [phone, setPhone] = React.useState<string>();
 *
 * <PhoneInput.Root defaultCountry="US" onChange={setPhone} value={phone}>
 *   <PhoneInput.Label>Phone number</PhoneInput.Label>
 * </PhoneInput.Root>
 * ```
 */
function PhoneInputRoot({
  value: controlledValue,
  defaultValue,
  onChange,
  defaultCountry,
  countries,
  flags,
  labels,
  international = false,
  searchPlaceholder = "Search country",
  placeholder,
  name,
  disabled = false,
  limitMaxLength = true,
  errorMessage: errorMessageProp,
  invalidMessage,
  onBlur,
  children,
  ...props
}: PhoneInputRootProps) {
  const [internalValue, setInternalValue] = React.useState<string | undefined>(
    defaultValue,
  );
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const handleChange = React.useCallback(
    (next?: string) => {
      if (!isControlled) setInternalValue(next);
      onChange?.(next);
    },
    [
      isControlled,
      onChange,
    ],
  );

  const [touched, setTouched] = React.useState(false);
  const errorMessage =
    errorMessageProp ??
    (invalidMessage && touched && value && !isValidPhoneNumber(value)
      ? invalidMessage
      : undefined);

  const CountrySelect = React.useMemo(
    () =>
      function BoundCountrySelect(
        selectProps: Omit<
          PhoneInputCountrySelectProps,
          "flags" | "searchPlaceholder"
        >,
      ) {
        return (
          <PhoneInputCountrySelect
            {...selectProps}
            flags={flags}
            searchPlaceholder={searchPlaceholder}
          />
        );
      },
    [
      flags,
      searchPlaceholder,
    ],
  );

  return (
    <Input
      errorMessage={errorMessage}
      {...props}
    >
      {children}
      <PhoneInputLib
        className="flex min-w-0 flex-1 items-center gap-2"
        countries={countries}
        countrySelectComponent={CountrySelect}
        defaultCountry={defaultCountry}
        disabled={disabled}
        inputComponent={PhoneInputField}
        international={international}
        labels={labels}
        limitMaxLength={limitMaxLength}
        name={name}
        numberInputProps={{
          "aria-invalid": errorMessage ? true : undefined,
        }}
        onBlur={(event) => {
          setTouched(true);
          onBlur?.(event);
        }}
        onChange={handleChange}
        placeholder={placeholder}
        value={value}
      />
    </Input>
  );
}

/** The number `<input>`: an `Input.Field`, so its text size, color, placeholder and disabled styles match every other field. */
function PhoneInputField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input.Field
      type="tel"
      {...props}
    />
  );
}

export const PhoneInput = Object.assign(PhoneInputRoot, {
  Label: Input.Label,
  Root: PhoneInputRoot,
});
