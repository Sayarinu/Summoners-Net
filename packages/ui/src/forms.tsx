import { Check, ChevronDown, Search, X } from "lucide-react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";
import {
  Button as AriaButton,
  Checkbox as AriaCheckbox,
  ComboBox as AriaComboBox,
  FieldError as AriaFieldError,
  Input as AriaInput,
  Label as AriaLabel,
  ListBox,
  ListBoxItem,
  Popover as AriaPopover,
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  Select as AriaSelect,
  SelectValue,
  Switch as AriaSwitch,
  Text as AriaText,
} from "react-aria-components";

import { analyticsData, cx, Icon } from "./internal.js";
import type { AnalyticsProps } from "./internal.js";

export interface FieldProps {
  readonly children: ReactNode;
  readonly description?: string | undefined;
  readonly error?: string | undefined;
  readonly htmlFor: string;
  readonly label: string;
  readonly optional?: boolean;
  readonly required?: boolean | undefined;
}

export function Field({
  children,
  description,
  error,
  htmlFor,
  label,
  optional = false,
  required = false,
}: FieldProps) {
  const messageId = `${htmlFor}-message`;

  return (
    <div className={cx("np-field", error && "np-field--invalid")}>
      <div className="np-field__label-row">
        <label htmlFor={htmlFor}>{label}</label>
        {optional ? <span>Optional</span> : null}
        {required ? <span aria-hidden="true">Required</span> : null}
      </div>
      {children}
      {error ? (
        <span className="np-field__error" id={messageId} role="alert">
          {error}
        </span>
      ) : description ? (
        <span className="np-field__description" id={messageId}>
          {description}
        </span>
      ) : null}
    </div>
  );
}

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix" | "size">, AnalyticsProps {
  readonly description?: string;
  readonly error?: string;
  readonly label: string;
  readonly prefix?: ReactNode;
  readonly suffix?: ReactNode;
}

export function Input({
  analyticsId,
  className,
  description,
  error,
  id: providedId,
  label,
  prefix,
  required,
  suffix,
  ...props
}: InputProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const describedBy = description || error ? `${id}-message` : undefined;

  return (
    <Field description={description} error={error} htmlFor={id} label={label} required={required}>
      <div className={cx("np-input-shell", error && "np-input-shell--invalid", className)}>
        {prefix ? (
          <span className="np-input-shell__affix np-input-shell__affix--start">{prefix}</span>
        ) : null}
        <input
          {...props}
          {...analyticsData(analyticsId)}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          id={id}
          required={required}
        />
        {suffix ? (
          <span className="np-input-shell__affix np-input-shell__affix--end">{suffix}</span>
        ) : null}
      </div>
    </Field>
  );
}

export interface SearchInputProps extends Omit<InputProps, "prefix" | "suffix" | "type"> {
  readonly onClear?: () => void;
}

export function SearchInput({ onClear, value, ...props }: SearchInputProps) {
  const hasValue = typeof value === "string" && value.length > 0;

  return (
    <Input
      {...props}
      prefix={<Icon icon={Search} size="small" />}
      suffix={
        hasValue && onClear ? (
          <button
            aria-label="Clear search"
            className="np-input-shell__clear"
            onClick={onClear}
            type="button"
          >
            <Icon icon={X} size="small" />
          </button>
        ) : null
      }
      type="search"
      value={value}
    />
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, AnalyticsProps {
  readonly description?: string;
  readonly error?: string;
  readonly label: string;
}

export function Textarea({
  analyticsId,
  className,
  description,
  error,
  id: providedId,
  label,
  required,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;

  return (
    <Field description={description} error={error} htmlFor={id} label={label} required={required}>
      <textarea
        {...props}
        {...analyticsData(analyticsId)}
        aria-describedby={description || error ? `${id}-message` : undefined}
        aria-invalid={error ? true : undefined}
        className={cx("np-textarea", error && "np-textarea--invalid", className)}
        id={id}
        required={required}
      />
    </Field>
  );
}

export interface SelectOption {
  readonly description?: string;
  readonly label: string;
  readonly value: string;
}

export interface SelectProps
  extends
    Omit<SelectHTMLAttributes<HTMLSelectElement>, "defaultValue" | "onChange" | "value">,
    AnalyticsProps {
  readonly defaultValue?: string;
  readonly description?: string;
  readonly error?: string;
  readonly label: string;
  readonly onValueChange?: (value: string) => void;
  readonly options: readonly SelectOption[];
  readonly placeholder?: string;
  readonly value?: string;
}

export function Select({
  analyticsId,
  defaultValue,
  description,
  disabled,
  error,
  label,
  name,
  onValueChange,
  options,
  placeholder = "Select an option",
  required,
  value,
}: SelectProps) {
  const selection =
    value !== undefined
      ? { selectedKey: value }
      : defaultValue !== undefined
        ? { defaultSelectedKey: defaultValue }
        : {};

  return (
    <AriaSelect
      {...selection}
      {...analyticsData(analyticsId)}
      {...(disabled !== undefined ? { isDisabled: disabled } : {})}
      {...(name !== undefined ? { name } : {})}
      {...(required !== undefined ? { isRequired: required } : {})}
      {...(onValueChange
        ? { onSelectionChange: (key: React.Key | null) => onValueChange(String(key)) }
        : {})}
      className="np-select"
      isInvalid={Boolean(error)}
      placeholder={placeholder}
    >
      <AriaLabel>{label}</AriaLabel>
      <AriaButton className="np-select__trigger">
        <SelectValue<SelectOption> className="np-select__value">
          {({ isPlaceholder, selectedItems }) => {
            const selected = selectedItems[0];
            if (isPlaceholder || !selected) return placeholder;
            return selected.description
              ? `${selected.label} - ${selected.description}`
              : selected.label;
          }}
        </SelectValue>
        <Icon icon={ChevronDown} size="small" />
      </AriaButton>
      {error ? <AriaFieldError className="np-field__error">{error}</AriaFieldError> : null}
      {!error && description ? (
        <AriaText className="np-field__description" slot="description">
          {description}
        </AriaText>
      ) : null}
      <AriaPopover className="np-popover np-select__popover">
        <ListBox className="np-listbox" items={options}>
          {(option) => (
            <ListBoxItem className="np-listbox__item" id={option.value} textValue={option.label}>
              <span>
                <strong>{option.label}</strong>
                {option.description ? <small>{option.description}</small> : null}
              </span>
              <span className="np-listbox__check">
                <Icon icon={Check} size="small" />
              </span>
            </ListBoxItem>
          )}
        </ListBox>
      </AriaPopover>
    </AriaSelect>
  );
}

export interface ComboboxProps extends Omit<SelectProps, "defaultValue" | "value"> {
  readonly defaultValue?: string;
  readonly onSelectionChange?: (value: string) => void;
  readonly value?: string;
}

export function Combobox({
  analyticsId,
  defaultValue,
  description,
  disabled,
  error,
  label,
  name,
  onValueChange,
  onSelectionChange,
  options,
  placeholder = "Search options",
  required,
  value,
}: ComboboxProps) {
  const inputSelection =
    value !== undefined
      ? { inputValue: value }
      : defaultValue !== undefined
        ? { defaultInputValue: defaultValue }
        : {};

  return (
    <AriaComboBox
      {...inputSelection}
      {...analyticsData(analyticsId)}
      {...(disabled !== undefined ? { isDisabled: disabled } : {})}
      {...(name !== undefined ? { name } : {})}
      {...(required !== undefined ? { isRequired: required } : {})}
      {...(onValueChange ? { onInputChange: onValueChange } : {})}
      {...(onSelectionChange
        ? {
            onSelectionChange: (key: React.Key | null) => {
              if (key !== null) onSelectionChange(String(key));
            },
          }
        : {})}
      className="np-combobox"
      isInvalid={Boolean(error)}
      allowsEmptyCollection
    >
      <AriaLabel>{label}</AriaLabel>
      <div className="np-combobox__control">
        <Icon icon={Search} size="small" />
        <AriaInput placeholder={placeholder} />
        <AriaButton aria-label="Show options">
          <Icon icon={ChevronDown} size="small" />
        </AriaButton>
      </div>
      {error ? <AriaFieldError className="np-field__error">{error}</AriaFieldError> : null}
      {!error && description ? (
        <AriaText className="np-field__description" slot="description">
          {description}
        </AriaText>
      ) : null}
      <AriaPopover className="np-popover np-select__popover">
        <ListBox className="np-listbox" items={options} renderEmptyState={() => "No results"}>
          {(option) => (
            <ListBoxItem className="np-listbox__item" id={option.value} textValue={option.label}>
              <span>
                <strong>{option.label}</strong>
                {option.description ? <small>{option.description}</small> : null}
              </span>
            </ListBoxItem>
          )}
        </ListBox>
      </AriaPopover>
    </AriaComboBox>
  );
}

export interface CheckboxProps extends AnalyticsProps {
  readonly children: ReactNode;
  readonly defaultSelected?: boolean;
  readonly disabled?: boolean;
  readonly name?: string;
  readonly onChange?: (selected: boolean) => void;
  readonly selected?: boolean;
  readonly value?: string;
}

export function Checkbox({
  analyticsId,
  children,
  defaultSelected,
  disabled,
  name,
  onChange,
  selected,
  value,
}: CheckboxProps) {
  return (
    <AriaCheckbox
      {...analyticsData(analyticsId)}
      {...(defaultSelected !== undefined ? { defaultSelected } : {})}
      {...(disabled !== undefined ? { isDisabled: disabled } : {})}
      {...(selected !== undefined ? { isSelected: selected } : {})}
      {...(name !== undefined ? { name } : {})}
      {...(onChange ? { onChange } : {})}
      {...(value !== undefined ? { value } : {})}
      className="np-checkbox"
    >
      <span aria-hidden="true" className="np-checkbox__box">
        <Icon icon={Check} size="small" />
      </span>
      <span>{children}</span>
    </AriaCheckbox>
  );
}

export interface RadioOption {
  readonly description?: string;
  readonly label: string;
  readonly value: string;
}

export interface RadioGroupProps extends AnalyticsProps {
  readonly defaultValue?: string;
  readonly disabled?: boolean;
  readonly label: string;
  readonly name?: string;
  readonly onChange?: (value: string) => void;
  readonly options: readonly RadioOption[];
  readonly orientation?: "horizontal" | "vertical";
  readonly value?: string;
}

export function RadioGroup({
  analyticsId,
  defaultValue,
  disabled,
  label,
  name,
  onChange,
  options,
  orientation = "vertical",
  value,
}: RadioGroupProps) {
  return (
    <AriaRadioGroup
      {...analyticsData(analyticsId)}
      {...(defaultValue !== undefined ? { defaultValue } : {})}
      {...(disabled !== undefined ? { isDisabled: disabled } : {})}
      {...(name !== undefined ? { name } : {})}
      {...(onChange ? { onChange } : {})}
      {...(value !== undefined ? { value } : {})}
      className={cx("np-radio-group", `np-radio-group--${orientation}`)}
      orientation={orientation}
    >
      <AriaLabel>{label}</AriaLabel>
      {options.map((option) => (
        <AriaRadio className="np-radio" key={option.value} value={option.value}>
          <span aria-hidden="true" className="np-radio__control" />
          <span>
            <strong>{option.label}</strong>
            {option.description ? <small>{option.description}</small> : null}
          </span>
        </AriaRadio>
      ))}
    </AriaRadioGroup>
  );
}

export interface SwitchProps extends AnalyticsProps {
  readonly children: ReactNode;
  readonly defaultSelected?: boolean;
  readonly disabled?: boolean;
  readonly onChange?: (selected: boolean) => void;
  readonly selected?: boolean;
}

export function Switch({
  analyticsId,
  children,
  defaultSelected,
  disabled,
  onChange,
  selected,
}: SwitchProps) {
  return (
    <AriaSwitch
      {...analyticsData(analyticsId)}
      {...(defaultSelected !== undefined ? { defaultSelected } : {})}
      {...(disabled !== undefined ? { isDisabled: disabled } : {})}
      {...(selected !== undefined ? { isSelected: selected } : {})}
      {...(onChange ? { onChange } : {})}
      className="np-switch"
    >
      <span aria-hidden="true" className="np-switch__track">
        <span className="np-switch__thumb" />
      </span>
      <span>{children}</span>
    </AriaSwitch>
  );
}
