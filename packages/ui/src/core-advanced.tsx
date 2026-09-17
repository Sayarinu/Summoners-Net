"use client";

import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  FileUp,
  GripVertical,
  Minus,
  MoreHorizontal,
  UploadCloud,
  X,
} from "lucide-react";
import type {
  ChangeEvent,
  DragEvent,
  HTMLAttributes,
  InputHTMLAttributes,
  KeyboardEvent,
  ReactNode,
} from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Button as AriaButton,
  Checkbox as AriaCheckbox,
  Dialog as AriaDialog,
  DialogTrigger,
  Label as AriaLabel,
  ListBox,
  ListBoxItem,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuTrigger,
  Popover as AriaPopover,
} from "react-aria-components";

import { Select } from "./forms.js";
import { analyticsData, cx, Icon, Spinner, VisuallyHidden } from "./internal.js";
import type { AnalyticsProps } from "./internal.js";
import type { NavigationItem } from "./navigation.js";
import { Button, IconButton } from "./primitives.js";
import type { Intent } from "./primitives.js";

function useControllableState<T>({
  defaultValue,
  onChange,
  value,
}: {
  readonly defaultValue: T;
  readonly onChange?: ((next: T) => void) | undefined;
  readonly value?: T | undefined;
}): readonly [T, (next: T) => void] {
  const [internal, setInternal] = useState(defaultValue);
  const current = value === undefined ? internal : value;
  const setCurrent = (next: T) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  };
  return [current, setCurrent] as const;
}

function messageIds(id: string, description?: ReactNode, error?: ReactNode) {
  return {
    describedBy:
      [description ? `${id}-description` : null, error ? `${id}-error` : null]
        .filter(Boolean)
        .join(" ") || undefined,
    descriptionId: `${id}-description`,
    errorId: `${id}-error`,
  };
}

function FieldMessages({
  description,
  descriptionId,
  error,
  errorId,
}: {
  readonly description?: ReactNode;
  readonly descriptionId: string;
  readonly error?: ReactNode;
  readonly errorId: string;
}) {
  return (
    <>
      {description ? (
        <span className="np-field__description" id={descriptionId}>
          {description}
        </span>
      ) : null}
      {error ? (
        <span className="np-field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}

export interface RadioProps extends AnalyticsProps {
  readonly checked?: boolean;
  readonly children: ReactNode;
  readonly defaultChecked?: boolean;
  readonly description?: ReactNode;
  readonly disabled?: boolean;
  readonly name: string;
  readonly onChange?: (checked: boolean) => void;
  readonly value: string;
}

/** A standalone native radio for composed fieldsets and non-data-driven forms. */
export function Radio({
  analyticsId,
  checked,
  children,
  defaultChecked,
  description,
  disabled,
  name,
  onChange,
  value,
}: RadioProps) {
  return (
    <label className={cx("np-advanced-radio", disabled && "np-advanced-radio--disabled")}>
      <input
        {...analyticsData(analyticsId)}
        {...(checked !== undefined ? { checked } : {})}
        {...(defaultChecked !== undefined ? { defaultChecked } : {})}
        disabled={disabled}
        name={name}
        onChange={(event) => onChange?.(event.currentTarget.checked)}
        type="radio"
        value={value}
      />
      <span aria-hidden="true" className="np-advanced-radio__control" />
      <span className="np-advanced-radio__copy">
        <strong>{children}</strong>
        {description ? <small>{description}</small> : null}
      </span>
    </label>
  );
}

export interface AdvancedCheckboxProps extends AnalyticsProps {
  readonly children: ReactNode;
  readonly defaultSelected?: boolean;
  readonly description?: ReactNode;
  readonly disabled?: boolean;
  readonly indeterminate?: boolean;
  readonly name?: string;
  readonly onChange?: (selected: boolean) => void;
  readonly selected?: boolean;
  readonly value?: string;
}

export function AdvancedCheckbox({
  analyticsId,
  children,
  defaultSelected,
  description,
  disabled,
  indeterminate = false,
  name,
  onChange,
  selected,
  value,
}: AdvancedCheckboxProps) {
  return (
    <AriaCheckbox
      {...analyticsData(analyticsId)}
      {...(defaultSelected !== undefined ? { defaultSelected } : {})}
      {...(disabled !== undefined ? { isDisabled: disabled } : {})}
      {...(name !== undefined ? { name } : {})}
      {...(onChange ? { onChange } : {})}
      {...(selected !== undefined ? { isSelected: selected } : {})}
      {...(value !== undefined ? { value } : {})}
      className="np-advanced-checkbox"
      isIndeterminate={indeterminate}
    >
      <span aria-hidden="true" className="np-advanced-checkbox__box">
        {indeterminate ? <Minus /> : <Check />}
      </span>
      <span className="np-advanced-checkbox__copy">
        <strong>{children}</strong>
        {description ? <small>{description}</small> : null}
      </span>
    </AriaCheckbox>
  );
}

export interface FieldsetProps extends AnalyticsProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly description?: ReactNode;
  readonly disabled?: boolean;
  readonly error?: ReactNode;
  readonly legend: ReactNode;
  readonly required?: boolean;
}

export function Fieldset({
  analyticsId,
  children,
  className,
  description,
  disabled,
  error,
  legend,
  required,
}: FieldsetProps) {
  const id = useId();
  const ids = messageIds(id, description, error);
  return (
    <fieldset
      {...analyticsData(analyticsId)}
      aria-describedby={ids.describedBy}
      className={cx("np-fieldset", Boolean(error) && "np-fieldset--invalid", className)}
      disabled={disabled}
    >
      <legend>
        {legend}
        {required ? <span aria-hidden="true"> *</span> : null}
      </legend>
      <FieldMessages
        description={description}
        descriptionId={ids.descriptionId}
        error={error}
        errorId={ids.errorId}
      />
      <div className="np-fieldset__content">{children}</div>
    </fieldset>
  );
}

export interface FormSectionProps extends AnalyticsProps {
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  readonly description?: ReactNode;
  readonly title: ReactNode;
}

export function FormSection({
  actions,
  analyticsId,
  children,
  className,
  description,
  title,
}: FormSectionProps) {
  const headingId = useId();
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-labelledby={headingId}
      className={cx("np-form-section", className)}
    >
      <header className="np-form-section__header">
        <div>
          <h2 id={headingId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="np-form-section__actions">{actions}</div> : null}
      </header>
      <div className="np-form-section__content">{children}</div>
    </section>
  );
}

export interface FormErrorItem {
  readonly fieldId: string;
  readonly message: string;
}

export interface FormErrorSummaryProps extends AnalyticsProps {
  readonly errors: readonly FormErrorItem[];
  readonly title?: string;
}

export function FormErrorSummary({
  analyticsId,
  errors,
  title = "Review the highlighted fields",
}: FormErrorSummaryProps) {
  if (errors.length === 0) return null;
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-atomic="true"
      className="np-form-errors"
      role="alert"
      tabIndex={-1}
    >
      <div>
        <h2>{title}</h2>
        <ul>
          {errors.map((error) => (
            <li key={error.fieldId}>
              <a href={`#${error.fieldId}`}>{error.message}</a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export interface SecretInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onCopy" | "size" | "type">, AnalyticsProps {
  readonly description?: ReactNode;
  readonly error?: ReactNode;
  readonly label: string;
  readonly onCopy?: (value: string) => void;
}

export function SecretInput({
  analyticsId,
  className,
  description,
  error,
  id: providedId,
  label,
  onCopy,
  value,
  defaultValue,
  ...props
}: SecretInputProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const ids = messageIds(id, description, error);
  const inputRef = useRef<HTMLInputElement>(null);
  const copySecret = () => {
    const current = inputRef.current?.value ?? "";
    onCopy?.(current);
    setCopied(true);
    globalThis.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className={cx("np-field", Boolean(error) && "np-field--invalid", className)}>
      <div className="np-field__label-row">
        <label htmlFor={id}>{label}</label>
        <span>Encrypted</span>
      </div>
      <div className={cx("np-input-shell", Boolean(error) && "np-input-shell--invalid")}>
        <input
          {...props}
          {...analyticsData(analyticsId)}
          {...(defaultValue !== undefined ? { defaultValue } : {})}
          {...(value !== undefined ? { value } : {})}
          aria-describedby={ids.describedBy}
          aria-invalid={error ? true : undefined}
          autoCapitalize="off"
          autoComplete="off"
          id={id}
          ref={inputRef}
          spellCheck={false}
          type={revealed ? "text" : "password"}
        />
        <IconButton
          icon={<Icon icon={revealed ? EyeOff : Eye} size="small" />}
          label={revealed ? "Hide secret" : "Show secret"}
          onPress={() => setRevealed((current) => !current)}
          size="compact"
          variant="ghost"
        />
        {onCopy ? (
          <IconButton
            icon={<Icon icon={copied ? Check : Copy} size="small" />}
            label={copied ? "Copied" : "Copy secret"}
            onPress={copySecret}
            size="compact"
            variant="ghost"
          />
        ) : null}
      </div>
      <FieldMessages
        description={description}
        descriptionId={ids.descriptionId}
        error={error}
        errorId={ids.errorId}
      />
    </div>
  );
}

export interface NumberInputProps
  extends
    Omit<
      InputHTMLAttributes<HTMLInputElement>,
      "defaultValue" | "max" | "min" | "onChange" | "size" | "step" | "type" | "value"
    >,
    AnalyticsProps {
  readonly defaultValue?: number;
  readonly description?: ReactNode;
  readonly error?: ReactNode;
  readonly label: string;
  readonly max?: number;
  readonly min?: number;
  readonly onValueChange?: (value: number | null) => void;
  readonly step?: number;
  readonly value?: number;
}

export function NumberInput({
  analyticsId,
  className,
  defaultValue = 0,
  description,
  disabled,
  error,
  id: providedId,
  label,
  max,
  min,
  onValueChange,
  step = 1,
  value,
  ...props
}: NumberInputProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const ids = messageIds(id, description, error);
  const [current, setCurrent] = useControllableState<number | null>({
    defaultValue,
    onChange: onValueChange,
    ...(value !== undefined ? { value } : {}),
  });
  const clamp = (next: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, next));
  const changeBy = (amount: number) => setCurrent(clamp((current ?? 0) + amount));
  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.currentTarget.valueAsNumber;
    setCurrent(Number.isNaN(next) ? null : clamp(next));
  };
  return (
    <div className={cx("np-field", Boolean(error) && "np-field--invalid", className)}>
      <div className="np-field__label-row">
        <label htmlFor={id}>{label}</label>
      </div>
      <div className={cx("np-number-input", Boolean(error) && "np-input-shell--invalid")}>
        <input
          {...props}
          {...analyticsData(analyticsId)}
          aria-describedby={ids.describedBy}
          aria-invalid={error ? true : undefined}
          disabled={disabled}
          id={id}
          max={max}
          min={min}
          onChange={handleInput}
          step={step}
          type="number"
          value={current ?? ""}
        />
        <div className="np-number-input__steppers">
          <button
            aria-label={`Increase ${label}`}
            disabled={disabled || (max !== undefined && (current ?? 0) >= max)}
            onClick={() => changeBy(step)}
            type="button"
          >
            <Icon icon={ChevronUp} size="small" />
          </button>
          <button
            aria-label={`Decrease ${label}`}
            disabled={disabled || (min !== undefined && (current ?? 0) <= min)}
            onClick={() => changeBy(-step)}
            type="button"
          >
            <Icon icon={ChevronDown} size="small" />
          </button>
        </div>
      </div>
      <FieldMessages
        description={description}
        descriptionId={ids.descriptionId}
        error={error}
        errorId={ids.errorId}
      />
    </div>
  );
}

export interface DateTimeInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type">, AnalyticsProps {
  readonly description?: ReactNode;
  readonly error?: ReactNode;
  readonly label: string;
  readonly timezone?: string;
}

export function DateTimeInput({
  analyticsId,
  className,
  description,
  error,
  id: providedId,
  label,
  timezone,
  ...props
}: DateTimeInputProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const ids = messageIds(id, description, error);
  return (
    <div className={cx("np-field", Boolean(error) && "np-field--invalid", className)}>
      <div className="np-field__label-row">
        <label htmlFor={id}>{label}</label>
        {timezone ? <span>{timezone}</span> : null}
      </div>
      <div className={cx("np-input-shell", Boolean(error) && "np-input-shell--invalid")}>
        <input
          {...props}
          {...analyticsData(analyticsId)}
          aria-describedby={ids.describedBy}
          aria-invalid={error ? true : undefined}
          id={id}
          type="datetime-local"
        />
      </div>
      <FieldMessages
        description={description}
        descriptionId={ids.descriptionId}
        error={error}
        errorId={ids.errorId}
      />
    </div>
  );
}

export interface TimezoneOption {
  readonly label: string;
  readonly value: string;
}

export const commonTimezones: readonly TimezoneOption[] = [
  { label: "UTC", value: "UTC" },
  { label: "Eastern Time · New York", value: "America/New_York" },
  { label: "Pacific Time · Los Angeles", value: "America/Los_Angeles" },
  { label: "Central European Time · Berlin", value: "Europe/Berlin" },
  { label: "Korea Standard Time · Seoul", value: "Asia/Seoul" },
  { label: "China Standard Time · Shanghai", value: "Asia/Shanghai" },
];

export interface TimezoneSelectProps extends AnalyticsProps {
  readonly defaultValue?: string;
  readonly description?: string;
  readonly disabled?: boolean;
  readonly error?: string;
  readonly label?: string;
  readonly onValueChange?: (value: string) => void;
  readonly options?: readonly TimezoneOption[];
  readonly value?: string;
}

export function TimezoneSelect({
  analyticsId,
  defaultValue = "UTC",
  description,
  disabled,
  error,
  label = "Timezone",
  onValueChange,
  options = commonTimezones,
  value,
}: TimezoneSelectProps) {
  return (
    <Select
      {...(analyticsId !== undefined ? { analyticsId } : {})}
      {...(value === undefined ? { defaultValue } : { value })}
      {...(description !== undefined ? { description } : {})}
      {...(disabled !== undefined ? { disabled } : {})}
      {...(error !== undefined ? { error } : {})}
      label={label}
      {...(onValueChange ? { onValueChange } : {})}
      options={options}
    />
  );
}

export interface MultiSelectOption {
  readonly description?: string;
  readonly disabled?: boolean;
  readonly label: string;
  readonly value: string;
}

export interface MultiSelectProps extends AnalyticsProps {
  readonly defaultSelectedValues?: readonly string[];
  readonly description?: string;
  readonly disabled?: boolean;
  readonly error?: string;
  readonly label: string;
  readonly onSelectionChange?: (values: readonly string[]) => void;
  readonly options: readonly MultiSelectOption[];
  readonly placeholder?: string;
  readonly selectedValues?: readonly string[];
}

export function MultiSelect({
  analyticsId,
  defaultSelectedValues = [],
  description,
  disabled,
  error,
  label,
  onSelectionChange,
  options,
  placeholder = "Select options",
  selectedValues,
}: MultiSelectProps) {
  const [selection, setSelection] = useControllableState({
    defaultValue: defaultSelectedValues,
    onChange: onSelectionChange,
    ...(selectedValues !== undefined ? { value: selectedValues } : {}),
  });
  const selectedOptions = options.filter((option) => selection.includes(option.value));
  const updateSelection = (keys: "all" | Set<React.Key>) => {
    const next = keys === "all" ? options.map((option) => option.value) : [...keys].map(String);
    setSelection(next);
  };
  return (
    <div
      {...analyticsData(analyticsId)}
      className={cx("np-multi-select", error && "np-multi-select--invalid")}
    >
      <AriaLabel>{label}</AriaLabel>
      <DialogTrigger>
        <AriaButton
          aria-label={label}
          {...(disabled !== undefined ? { isDisabled: disabled } : {})}
          className="np-multi-select__trigger"
        >
          <span className="np-multi-select__values">
            {selectedOptions.length === 0 ? (
              <span className="np-multi-select__placeholder">{placeholder}</span>
            ) : (
              selectedOptions.slice(0, 2).map((option, index) => (
                <span className="np-multi-select__value" key={option.value}>
                  {index > 0 ? ", " : null}
                  {option.label}
                </span>
              ))
            )}
            {selectedOptions.length > 2 ? (
              <span className="np-multi-select__more">
                {`, +${selectedOptions.length - 2} more`}
              </span>
            ) : null}
          </span>
          <Icon icon={ChevronsUpDown} size="small" />
        </AriaButton>
        <AriaPopover className="np-popover np-multi-select__popover" placement="bottom start">
          <AriaDialog aria-label={label}>
            <ListBox
              aria-label={label}
              className="np-listbox np-multi-select__list"
              items={options}
              onSelectionChange={updateSelection}
              selectedKeys={new Set(selection)}
              selectionMode="multiple"
            >
              {(option) => (
                <ListBoxItem
                  className="np-listbox__item"
                  id={option.value}
                  {...(option.disabled !== undefined ? { isDisabled: option.disabled } : {})}
                  textValue={option.label}
                >
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
          </AriaDialog>
        </AriaPopover>
      </DialogTrigger>
      {error ? <span className="np-field__error">{error}</span> : null}
      {!error && description ? <span className="np-field__description">{description}</span> : null}
    </div>
  );
}

export interface FileUploadProps extends AnalyticsProps {
  readonly accept?: string;
  readonly description?: ReactNode;
  readonly disabled?: boolean;
  readonly error?: ReactNode;
  readonly label: string;
  readonly maxSizeBytes?: number;
  readonly multiple?: boolean;
  readonly onFilesChange?: (files: readonly File[]) => void;
  readonly uploading?: boolean;
  readonly value?: readonly File[];
}

export function FileUpload({
  accept,
  analyticsId,
  description,
  disabled,
  error,
  label,
  maxSizeBytes,
  multiple = false,
  onFilesChange,
  uploading = false,
  value,
}: FileUploadProps) {
  const id = useId();
  const [internalFiles, setInternalFiles] = useState<readonly File[]>([]);
  const files = value ?? internalFiles;
  const [localError, setLocalError] = useState<string | null>(null);
  const ids = messageIds(id, description, error ?? localError);
  const updateFiles = (next: readonly File[]) => {
    if (value === undefined) setInternalFiles(next);
    onFilesChange?.(next);
  };
  const addFiles = (incoming: readonly File[]) => {
    const oversized = maxSizeBytes ? incoming.find((file) => file.size > maxSizeBytes) : undefined;
    if (oversized) {
      setLocalError(`${oversized.name} exceeds the file-size limit.`);
      return;
    }
    setLocalError(null);
    updateFiles(multiple ? [...files, ...incoming] : incoming.slice(0, 1));
  };
  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.currentTarget.files ?? []));
    event.currentTarget.value = "";
  };
  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (!disabled && !uploading) addFiles(Array.from(event.dataTransfer.files));
  };
  const removeFile = (index: number) =>
    updateFiles(files.filter((_, itemIndex) => itemIndex !== index));
  const displayedError = error ?? localError;
  return (
    <div
      {...analyticsData(analyticsId)}
      className={cx("np-file-upload", Boolean(displayedError) && "np-file-upload--invalid")}
    >
      <div className="np-field__label-row">
        <span>{label}</span>
        {maxSizeBytes ? <span>Max {Math.round(maxSizeBytes / 1024 / 1024)} MB</span> : null}
      </div>
      <label
        className="np-file-upload__dropzone"
        htmlFor={id}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        {uploading ? <Spinner label="Uploading files" /> : <Icon icon={UploadCloud} size="large" />}
        <span>
          <strong>{uploading ? "Uploading…" : "Choose files or drop them here"}</strong>
          <small>{accept ? `Accepted: ${accept}` : "Any supported file type"}</small>
        </span>
        <input
          accept={accept}
          aria-describedby={ids.describedBy}
          aria-invalid={displayedError ? true : undefined}
          aria-label={label}
          disabled={disabled || uploading}
          id={id}
          multiple={multiple}
          onChange={handleInput}
          type="file"
        />
      </label>
      <FieldMessages
        description={description}
        descriptionId={ids.descriptionId}
        error={displayedError}
        errorId={ids.errorId}
      />
      {files.length > 0 ? (
        <ul aria-label="Selected files" className="np-file-upload__files">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.lastModified}-${index}`}>
              <Icon icon={FileUp} size="small" />
              <span>
                <strong>{file.name}</strong>
                <small>{Math.max(1, Math.round(file.size / 1024))} KB</small>
              </span>
              <IconButton
                disabled={disabled || uploading}
                icon={<Icon icon={X} size="small" />}
                label={`Remove ${file.name}`}
                onPress={() => removeFile(index)}
                size="compact"
                variant="ghost"
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export type SortDirection = "ascending" | "descending";

export interface DataTableSort {
  readonly columnId: string;
  readonly direction: SortDirection;
}

export interface DataTableColumn<Row> {
  readonly align?: "center" | "end" | "start";
  readonly header: ReactNode;
  readonly id: string;
  readonly render: (row: Row) => ReactNode;
  readonly sortable?: boolean;
  readonly sortValue?: (row: Row) => boolean | Date | number | string | null | undefined;
  readonly width?: string;
}

export interface DataTableRowAction<Row> {
  readonly destructive?: boolean;
  readonly disabled?: boolean;
  readonly icon?: ReactNode;
  readonly id: string;
  readonly label: string;
  readonly onAction: (row: Row) => void;
}

export interface MobileRowActionMenuProps<Row> extends AnalyticsProps {
  readonly actions: readonly DataTableRowAction<Row>[];
  readonly label: string;
  readonly row: Row;
}

export function MobileRowActionMenu<Row>({
  actions,
  analyticsId,
  label,
  row,
}: MobileRowActionMenuProps<Row>) {
  return (
    <MenuTrigger>
      <AriaButton
        {...analyticsData(analyticsId)}
        aria-label={label}
        className="np-button np-button--ghost np-icon-button np-control--compact"
      >
        <Icon icon={MoreHorizontal} size="small" />
      </AriaButton>
      <AriaPopover className="np-popover np-mobile-actions__popover" placement="bottom end">
        <AriaMenu
          aria-label={label}
          className="np-menu"
          items={actions}
          onAction={(key) => actions.find((action) => action.id === String(key))?.onAction(row)}
        >
          {(action) => (
            <AriaMenuItem
              className={cx("np-menu__item", action.destructive && "np-menu__item--danger")}
              id={action.id}
              {...(action.disabled !== undefined ? { isDisabled: action.disabled } : {})}
              textValue={action.label}
            >
              {action.icon}
              <strong>{action.label}</strong>
            </AriaMenuItem>
          )}
        </AriaMenu>
      </AriaPopover>
    </MenuTrigger>
  );
}

export interface DataTableProps<Row> extends AnalyticsProps {
  readonly actions?: readonly DataTableRowAction<Row>[];
  readonly caption: string;
  readonly columns: readonly DataTableColumn<Row>[];
  readonly compact?: boolean;
  readonly defaultSelectedKeys?: readonly string[];
  readonly defaultSort?: DataTableSort;
  readonly emptyMessage?: string;
  readonly getRowKey: (row: Row) => string;
  readonly getRowLabel?: (row: Row) => string;
  readonly loading?: boolean;
  readonly onSelectionChange?: (keys: readonly string[]) => void;
  readonly onSortChange?: (sort: DataTableSort) => void;
  readonly rows: readonly Row[];
  readonly selectable?: boolean;
  readonly selectedKeys?: readonly string[];
  readonly sort?: DataTableSort;
  readonly stickyHeader?: boolean;
}

function compareSortValues(
  left: boolean | Date | number | string | null | undefined,
  right: boolean | Date | number | string | null | undefined,
): number {
  if (left === right) return 0;
  if (left === null || left === undefined) return 1;
  if (right === null || right === undefined) return -1;
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime();
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right);
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function DataTable<Row>({
  actions = [],
  analyticsId,
  caption,
  columns,
  compact = false,
  defaultSelectedKeys = [],
  defaultSort,
  emptyMessage = "No rows to display",
  getRowKey,
  getRowLabel,
  loading = false,
  onSelectionChange,
  onSortChange,
  rows,
  selectable = false,
  selectedKeys,
  sort,
  stickyHeader = false,
}: DataTableProps<Row>) {
  const [internalSort, setInternalSort] = useState<DataTableSort | undefined>(defaultSort);
  const currentSort = sort ?? internalSort;
  const [selection, setSelection] = useControllableState({
    defaultValue: defaultSelectedKeys,
    onChange: onSelectionChange,
    ...(selectedKeys !== undefined ? { value: selectedKeys } : {}),
  });
  const rowKeys = rows.map(getRowKey);
  const allSelected = rowKeys.length > 0 && rowKeys.every((key) => selection.includes(key));
  const someSelected = !allSelected && rowKeys.some((key) => selection.includes(key));

  const visibleRows = useMemo(() => {
    if (!currentSort) return rows;
    const column = columns.find((item) => item.id === currentSort.columnId);
    if (!column?.sortable || !column.sortValue) return rows;
    const multiplier = currentSort.direction === "ascending" ? 1 : -1;
    return rows
      .map((row, index) => ({ index, row }))
      .sort((left, right) => {
        const result = compareSortValues(
          column.sortValue?.(left.row),
          column.sortValue?.(right.row),
        );
        return result === 0 ? left.index - right.index : result * multiplier;
      })
      .map(({ row }) => row);
  }, [columns, currentSort, rows]);

  const updateSort = (column: DataTableColumn<Row>) => {
    if (!column.sortable) return;
    const next: DataTableSort = {
      columnId: column.id,
      direction:
        currentSort?.columnId === column.id && currentSort.direction === "ascending"
          ? "descending"
          : "ascending",
    };
    if (sort === undefined) setInternalSort(next);
    onSortChange?.(next);
  };
  const toggleAll = (checked: boolean) => {
    const offPage = selection.filter((key) => !rowKeys.includes(key));
    setSelection(checked ? [...offPage, ...rowKeys] : offPage);
  };
  const toggleRow = (key: string, checked: boolean) => {
    setSelection(
      checked
        ? selection.includes(key)
          ? selection
          : [...selection, key]
        : selection.filter((item) => item !== key),
    );
  };

  return (
    <div
      {...analyticsData(analyticsId)}
      className={cx(
        "np-data-table-wrap",
        compact && "np-data-table-wrap--compact",
        stickyHeader && "np-data-table-wrap--sticky",
      )}
    >
      <table className="np-data-table">
        <caption className="np-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {selectable ? (
              <th className="np-data-table__selection" scope="col">
                <AdvancedCheckbox
                  indeterminate={someSelected}
                  onChange={toggleAll}
                  selected={allSelected}
                >
                  <VisuallyHidden>Select all rows</VisuallyHidden>
                </AdvancedCheckbox>
              </th>
            ) : null}
            {columns.map((column) => {
              const active = currentSort?.columnId === column.id;
              const ariaSort = active
                ? currentSort.direction
                : column.sortable
                  ? "none"
                  : undefined;
              return (
                <th
                  aria-sort={ariaSort}
                  className={cx(column.align && `np-align--${column.align}`)}
                  key={column.id}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.sortable ? (
                    <button
                      className="np-data-table__sort"
                      onClick={() => updateSort(column)}
                      type="button"
                    >
                      <span>{column.header}</span>
                      <Icon
                        icon={
                          active
                            ? currentSort.direction === "ascending"
                              ? ChevronUp
                              : ChevronDown
                            : ChevronsUpDown
                        }
                        size="small"
                      />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
            {actions.length > 0 ? (
              <th className="np-data-table__actions-header" scope="col">
                <span className="np-visually-hidden">Row actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody aria-busy={loading}>
          {loading
            ? Array.from({ length: 4 }, (_, rowIndex) => (
                <tr key={`loading-${rowIndex}`}>
                  {selectable ? <td className="np-data-table__selection" /> : null}
                  {columns.map((column) => (
                    <td key={column.id}>
                      <span className="np-data-table__skeleton" />
                    </td>
                  ))}
                  {actions.length > 0 ? <td /> : null}
                </tr>
              ))
            : visibleRows.map((row) => {
                const key = getRowKey(row);
                const selected = selection.includes(key);
                const label = getRowLabel?.(row) ?? key;
                return (
                  <tr data-selected={selected || undefined} key={key}>
                    {selectable ? (
                      <td className="np-data-table__selection">
                        <AdvancedCheckbox
                          onChange={(checked) => toggleRow(key, checked)}
                          selected={selected}
                        >
                          <VisuallyHidden>{`Select ${label}`}</VisuallyHidden>
                        </AdvancedCheckbox>
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td
                        className={cx(column.align && `np-align--${column.align}`)}
                        key={column.id}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                    {actions.length > 0 ? (
                      <td className="np-data-table__actions">
                        <div className="np-data-table__desktop-actions">
                          {actions.map((action) => (
                            <Button
                              {...(action.disabled !== undefined
                                ? { disabled: action.disabled }
                                : {})}
                              key={action.id}
                              onPress={() => action.onAction(row)}
                              size="compact"
                              startIcon={action.icon}
                              variant={action.destructive ? "danger" : "ghost"}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                        <div className="np-data-table__mobile-actions">
                          <MobileRowActionMenu
                            actions={actions}
                            label={`Actions for ${label}`}
                            row={row}
                          />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
          {!loading && visibleRows.length === 0 ? (
            <tr>
              <td
                className="np-data-table__empty"
                colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export interface CursorPaginationProps extends AnalyticsProps {
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
  readonly label?: string;
  readonly loading?: boolean;
  readonly onNextPage: () => void;
  readonly onPreviousPage: () => void;
  readonly rangeLabel?: ReactNode;
}

export function CursorPagination({
  analyticsId,
  hasNextPage,
  hasPreviousPage,
  label = "Results pagination",
  loading = false,
  onNextPage,
  onPreviousPage,
  rangeLabel,
}: CursorPaginationProps) {
  return (
    <nav {...analyticsData(analyticsId)} aria-label={label} className="np-cursor-pagination">
      <Button
        disabled={!hasPreviousPage || loading}
        onPress={onPreviousPage}
        size="small"
        startIcon={<Icon icon={ChevronLeft} size="small" />}
        variant="ghost"
      >
        Previous
      </Button>
      {rangeLabel ? <span aria-live="polite">{rangeLabel}</span> : null}
      <Button
        disabled={!hasNextPage || loading}
        endIcon={loading ? <Spinner decorative /> : <Icon icon={ChevronRight} size="small" />}
        onPress={onNextPage}
        size="small"
        variant="ghost"
      >
        {loading ? "Loading" : "Next"}
      </Button>
    </nav>
  );
}

export interface LoadMoreProps extends AnalyticsProps {
  readonly disabled?: boolean;
  readonly label?: string;
  readonly loading?: boolean;
  readonly onLoadMore: () => void;
  readonly remainingLabel?: ReactNode;
}

export function LoadMore({
  analyticsId,
  disabled,
  label = "Load more",
  loading = false,
  onLoadMore,
  remainingLabel,
}: LoadMoreProps) {
  return (
    <div {...analyticsData(analyticsId)} className="np-load-more">
      {remainingLabel ? <span>{remainingLabel}</span> : null}
      <Button
        {...(disabled !== undefined ? { disabled } : {})}
        loading={loading}
        onPress={onLoadMore}
        size="small"
        variant="secondary"
      >
        {label}
      </Button>
    </div>
  );
}

interface DismissibleSurfaceProps extends AnalyticsProps {
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly defaultVisible?: boolean;
  readonly onDismiss?: () => void;
  readonly title: string;
  readonly tone?: Intent;
  readonly visible?: boolean;
}

export type DismissibleAlertProps = DismissibleSurfaceProps;

export function DismissibleAlert({
  action,
  analyticsId,
  children,
  defaultVisible = true,
  onDismiss,
  title,
  tone = "neutral",
  visible,
}: DismissibleAlertProps) {
  const [isVisible, setVisible] = useControllableState({
    defaultValue: defaultVisible,
    onChange: (next) => {
      if (!next) onDismiss?.();
    },
    ...(visible !== undefined ? { value: visible } : {}),
  });
  if (!isVisible) return null;
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-atomic="true"
      className={cx("np-dismissible", "np-dismissible--alert", `np-dismissible--${tone}`)}
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
    >
      <span aria-hidden="true" className="np-dismissible__marker" />
      <div className="np-dismissible__body">
        <strong>{title}</strong>
        <div>{children}</div>
      </div>
      {action ? <div className="np-dismissible__action">{action}</div> : null}
      <IconButton
        icon={<Icon icon={X} size="small" />}
        label={`Dismiss ${title}`}
        onPress={() => setVisible(false)}
        size="compact"
        variant="ghost"
      />
    </section>
  );
}

export interface DismissibleToastProps extends DismissibleSurfaceProps {
  readonly duration?: number;
}

export function DismissibleToast({
  action,
  analyticsId,
  children,
  defaultVisible = true,
  duration,
  onDismiss,
  title,
  tone = "neutral",
  visible,
}: DismissibleToastProps) {
  const [isVisible, setVisible] = useControllableState({
    defaultValue: defaultVisible,
    onChange: (next) => {
      if (!next) onDismiss?.();
    },
    ...(visible !== undefined ? { value: visible } : {}),
  });
  useEffect(() => {
    if (!isVisible || duration === undefined || duration <= 0) return;
    const timeout = globalThis.setTimeout(() => setVisible(false), duration);
    return () => globalThis.clearTimeout(timeout);
  }, [duration, isVisible, setVisible]);
  if (!isVisible) return null;
  return (
    <div
      {...analyticsData(analyticsId)}
      aria-atomic="true"
      className={cx("np-dismissible", "np-dismissible--toast", `np-dismissible--${tone}`)}
      role={tone === "danger" ? "alert" : "status"}
    >
      <span aria-hidden="true" className="np-dismissible__marker" />
      <div className="np-dismissible__body">
        <strong>{title}</strong>
        <div>{children}</div>
      </div>
      {action ? <div className="np-dismissible__action">{action}</div> : null}
      <IconButton
        icon={<Icon icon={X} size="small" />}
        label={`Dismiss ${title}`}
        onPress={() => setVisible(false)}
        size="compact"
        variant="ghost"
      />
    </div>
  );
}

export interface PageHeaderProps extends AnalyticsProps {
  readonly actions?: ReactNode;
  readonly breadcrumb?: ReactNode;
  readonly description?: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly meta?: ReactNode;
  readonly title: ReactNode;
}

export function PageHeader({
  actions,
  analyticsId,
  breadcrumb,
  description,
  eyebrow,
  meta,
  title,
}: PageHeaderProps) {
  const titleId = useId();
  return (
    <header {...analyticsData(analyticsId)} aria-labelledby={titleId} className="np-page-header">
      {breadcrumb ? <div className="np-page-header__breadcrumb">{breadcrumb}</div> : null}
      <div className="np-page-header__main">
        <div className="np-page-header__copy">
          {eyebrow ? <span className="np-eyebrow">{eyebrow}</span> : null}
          <h1 id={titleId}>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="np-page-header__actions">{actions}</div> : null}
      </div>
      {meta ? <div className="np-page-header__meta">{meta}</div> : null}
    </header>
  );
}

export interface SectionHeaderProps extends AnalyticsProps {
  readonly actions?: ReactNode;
  readonly description?: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly level?: 2 | 3 | 4;
  readonly meta?: ReactNode;
  readonly title: ReactNode;
}

export function SectionHeader({
  actions,
  analyticsId,
  description,
  eyebrow,
  level = 2,
  meta,
  title,
}: SectionHeaderProps) {
  const HeadingTag = `h${level}` as const;
  return (
    <header {...analyticsData(analyticsId)} className="np-section-header">
      <div className="np-section-header__copy">
        {eyebrow ? <span className="np-eyebrow">{eyebrow}</span> : null}
        <HeadingTag>{title}</HeadingTag>
        {description ? <p>{description}</p> : null}
      </div>
      {meta ? <div className="np-section-header__meta">{meta}</div> : null}
      {actions ? <div className="np-section-header__actions">{actions}</div> : null}
    </header>
  );
}

export interface ToolbarProps extends AnalyticsProps, HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
  readonly label: string;
  readonly orientation?: "horizontal" | "vertical";
  readonly secondary?: ReactNode;
  readonly sticky?: boolean;
}

export function Toolbar({
  analyticsId,
  children,
  className,
  label,
  orientation = "horizontal",
  secondary,
  sticky = false,
  ...props
}: ToolbarProps) {
  return (
    <div
      {...props}
      {...analyticsData(analyticsId)}
      aria-label={label}
      aria-orientation={orientation}
      className={cx(
        "np-toolbar",
        `np-toolbar--${orientation}`,
        sticky && "np-toolbar--sticky",
        className,
      )}
      role="toolbar"
    >
      <div className="np-toolbar__primary">{children}</div>
      {secondary ? <div className="np-toolbar__secondary">{secondary}</div> : null}
    </div>
  );
}

export interface SplitPanelProps extends AnalyticsProps {
  readonly aside: ReactNode;
  readonly asideLabel: string;
  readonly asidePosition?: "left" | "right";
  readonly asideSize?: number;
  readonly children: ReactNode;
  readonly collapsed?: boolean;
  readonly collapsible?: boolean;
  readonly defaultAsideSize?: number;
  readonly defaultCollapsed?: boolean;
  readonly mainLabel: string;
  readonly maxAsideSize?: number;
  readonly minAsideSize?: number;
  readonly onAsideSizeChange?: (size: number) => void;
  readonly onCollapsedChange?: (collapsed: boolean) => void;
  readonly resizable?: boolean;
}

export function SplitPanel({
  analyticsId,
  aside,
  asideLabel,
  asidePosition = "right",
  asideSize,
  children,
  collapsed,
  collapsible = true,
  defaultAsideSize = 320,
  defaultCollapsed = false,
  mainLabel,
  maxAsideSize = 520,
  minAsideSize = 240,
  onAsideSizeChange,
  onCollapsedChange,
  resizable = true,
}: SplitPanelProps) {
  const [currentCollapsed, setCollapsed] = useControllableState({
    defaultValue: defaultCollapsed,
    onChange: onCollapsedChange,
    ...(collapsed !== undefined ? { value: collapsed } : {}),
  });
  const [internalSize, setInternalSize] = useState(defaultAsideSize);
  const currentSize = asideSize ?? internalSize;
  const [dragging, setDragging] = useState(false);
  const clamp = (next: number) => Math.min(maxAsideSize, Math.max(minAsideSize, next));
  const updateSize = (next: number) => {
    const safe = clamp(next);
    if (asideSize === undefined) setInternalSize(safe);
    onAsideSizeChange?.(safe);
  };
  const handleResizeKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      updateSize(currentSize + (asidePosition === "right" ? 16 : -16));
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      updateSize(currentSize + (asidePosition === "right" ? -16 : 16));
    }
    if (event.key === "Home") {
      event.preventDefault();
      updateSize(minAsideSize);
    }
    if (event.key === "End") {
      event.preventDefault();
      updateSize(maxAsideSize);
    }
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const delta = event.movementX * (asidePosition === "right" ? -1 : 1);
    updateSize(currentSize + delta);
  };
  const style = { "--np-split-size": `${currentSize}px` } as React.CSSProperties;
  const asidePanel = (
    <aside aria-label={asideLabel} className="np-split-panel__aside">
      {collapsible ? (
        <IconButton
          icon={
            <Icon
              icon={
                currentCollapsed
                  ? asidePosition === "right"
                    ? ChevronsLeft
                    : ChevronsRight
                  : asidePosition === "right"
                    ? ChevronsRight
                    : ChevronsLeft
              }
              size="small"
            />
          }
          label={currentCollapsed ? `Open ${asideLabel}` : `Collapse ${asideLabel}`}
          onPress={() => setCollapsed(!currentCollapsed)}
          size="compact"
          variant="ghost"
        />
      ) : null}
      {!currentCollapsed ? <div className="np-split-panel__aside-content">{aside}</div> : null}
    </aside>
  );
  const separator =
    resizable && !currentCollapsed ? (
      <div
        aria-label={`Resize ${asideLabel}`}
        aria-orientation="vertical"
        aria-valuemax={maxAsideSize}
        aria-valuemin={minAsideSize}
        aria-valuenow={currentSize}
        className="np-split-panel__separator"
        onKeyDown={handleResizeKey}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture?.(event.pointerId);
          setDragging(false);
        }}
        role="separator"
        tabIndex={0}
      >
        <Icon icon={GripVertical} size="small" />
      </div>
    ) : null;
  return (
    <div
      {...analyticsData(analyticsId)}
      className={cx(
        "np-split-panel",
        `np-split-panel--${asidePosition}`,
        currentCollapsed && "np-split-panel--collapsed",
      )}
      style={style}
    >
      {asidePosition === "left" ? asidePanel : null}
      {asidePosition === "left" ? separator : null}
      <section aria-label={mainLabel} className="np-split-panel__main">
        {children}
      </section>
      {asidePosition === "right" ? separator : null}
      {asidePosition === "right" ? asidePanel : null}
    </div>
  );
}

export interface CollapsedNavigationProps extends AnalyticsProps {
  readonly currentHref: string;
  readonly items: readonly NavigationItem[];
  readonly label?: string;
  readonly onExpand?: () => void;
}

export function CollapsedNavigation({
  analyticsId,
  currentHref,
  items,
  label = "Primary",
  onExpand,
}: CollapsedNavigationProps) {
  return (
    <nav {...analyticsData(analyticsId)} aria-label={label} className="np-collapsed-navigation">
      {onExpand ? (
        <IconButton
          icon={<Icon icon={ChevronsRight} size="small" />}
          label="Expand navigation"
          onPress={onExpand}
          size="compact"
          variant="ghost"
        />
      ) : null}
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <a
              aria-current={item.href === currentHref ? "page" : undefined}
              aria-label={item.label}
              href={item.href}
              title={item.label}
            >
              {item.icon ?? <span aria-hidden="true">{item.label.slice(0, 1)}</span>}
              {item.meta ? (
                <span className="np-collapsed-navigation__meta">{item.meta}</span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export interface MobileNavigationProps extends AnalyticsProps {
  readonly currentHref: string;
  readonly items: readonly NavigationItem[];
  readonly label?: string;
  readonly maxVisible?: number;
  readonly onNavigate?: (href: string) => void;
}

export function MobileNavigation({
  analyticsId,
  currentHref,
  items,
  label = "Mobile primary",
  maxVisible = 4,
  onNavigate,
}: MobileNavigationProps) {
  const visible = items.slice(0, Math.max(1, maxVisible));
  const overflow = items.slice(Math.max(1, maxVisible));
  const overflowActive = overflow.some((item) => item.href === currentHref);
  return (
    <nav {...analyticsData(analyticsId)} aria-label={label} className="np-mobile-navigation">
      <ul>
        {visible.map((item) => (
          <li key={item.href}>
            <a
              aria-current={item.href === currentHref ? "page" : undefined}
              href={item.href}
              onClick={() => onNavigate?.(item.href)}
            >
              <span className="np-mobile-navigation__visual">
                <span className="np-mobile-navigation__icon">{item.icon}</span>
                {item.meta ? <span className="np-mobile-navigation__meta">{item.meta}</span> : null}
              </span>
              <span>{item.label}</span>
            </a>
          </li>
        ))}
        {overflow.length > 0 ? (
          <li>
            <MenuTrigger>
              <AriaButton
                aria-label="More navigation"
                className="np-mobile-navigation__more"
                data-current={overflowActive || undefined}
              >
                <Icon icon={MoreHorizontal} size="small" />
                <span>More</span>
              </AriaButton>
              <AriaPopover className="np-popover" placement="top end">
                <AriaMenu
                  aria-label="More navigation"
                  className="np-menu"
                  items={overflow}
                  {...(onNavigate ? { onAction: (key: React.Key) => onNavigate(String(key)) } : {})}
                >
                  {(item) => (
                    <AriaMenuItem
                      {...(!onNavigate ? { href: item.href } : {})}
                      className="np-menu__item"
                      id={item.href}
                      textValue={item.label}
                    >
                      {item.icon}
                      <strong>{item.label}</strong>
                    </AriaMenuItem>
                  )}
                </AriaMenu>
              </AriaPopover>
            </MenuTrigger>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

export interface MobileAdminNavigationProps extends AnalyticsProps {
  readonly currentHref: string;
  readonly items: readonly NavigationItem[];
  readonly label?: string;
  readonly onNavigate?: (href: string) => void;
}

export function MobileAdminNavigation({
  analyticsId,
  currentHref,
  items,
  label = "Administration",
  onNavigate,
}: MobileAdminNavigationProps) {
  const current = items.find((item) => item.href === currentHref);
  return (
    <div {...analyticsData(analyticsId)} className="np-mobile-admin-navigation">
      <span className="np-mobile-admin-navigation__context">{label}</span>
      <MenuTrigger>
        <AriaButton className="np-mobile-admin-navigation__trigger">
          <span>
            {current?.icon}
            <strong>{current?.label ?? "Choose section"}</strong>
          </span>
          <Icon icon={ChevronDown} size="small" />
        </AriaButton>
        <AriaPopover className="np-popover np-mobile-admin-navigation__popover">
          <AriaMenu
            aria-label={label}
            className="np-menu"
            items={items}
            {...(onNavigate ? { onAction: (key: React.Key) => onNavigate(String(key)) } : {})}
            selectionMode="single"
            selectedKeys={current ? new Set([current.href]) : new Set()}
          >
            {(item) => (
              <AriaMenuItem
                {...(!onNavigate ? { href: item.href } : {})}
                className="np-menu__item"
                id={item.href}
                textValue={item.label}
              >
                {item.icon}
                <strong>{item.label}</strong>
                {item.meta}
                <span className="np-menu__check">
                  <Icon icon={Check} size="small" />
                </span>
              </AriaMenuItem>
            )}
          </AriaMenu>
        </AriaPopover>
      </MenuTrigger>
    </div>
  );
}

export interface OverflowTabItem {
  readonly meta?: ReactNode;
  readonly disabled?: boolean;
  readonly id: string;
  readonly label: string;
  readonly panelId?: string;
}

export interface OverflowTabsProps extends AnalyticsProps {
  readonly defaultSelectedId?: string;
  readonly items: readonly OverflowTabItem[];
  readonly label: string;
  readonly onSelectionChange?: (id: string) => void;
  readonly selectedId?: string;
  readonly visibleCount?: number;
}

export function OverflowTabs({
  analyticsId,
  defaultSelectedId,
  items,
  label,
  onSelectionChange,
  selectedId,
  visibleCount = 5,
}: OverflowTabsProps) {
  const fallback = defaultSelectedId ?? items.find((item) => !item.disabled)?.id ?? "";
  const [selection, setSelection] = useControllableState({
    defaultValue: fallback,
    onChange: onSelectionChange,
    ...(selectedId !== undefined ? { value: selectedId } : {}),
  });
  const directLimit = Math.max(1, visibleCount);
  const selectedItem = items.find((item) => item.id === selection);
  const initiallyVisible = items.slice(0, directLimit);
  const directItems =
    selectedItem && !initiallyVisible.some((item) => item.id === selectedItem.id)
      ? [...initiallyVisible.slice(0, Math.max(0, directLimit - 1)), selectedItem]
      : initiallyVisible;
  const directIds = new Set(directItems.map((item) => item.id));
  const overflowItems = items.filter((item) => !directIds.has(item.id));
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const select = (item: OverflowTabItem) => {
    if (!item.disabled) setSelection(item.id);
  };
  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const enabled = directItems
      .map((item, itemIndex) => ({ item, itemIndex }))
      .filter(({ item }) => !item.disabled);
    const currentIndex = enabled.findIndex((entry) => entry.itemIndex === index);
    let targetIndex: number | undefined;
    if (event.key === "ArrowRight")
      targetIndex = enabled[(currentIndex + 1) % enabled.length]?.itemIndex;
    if (event.key === "ArrowLeft")
      targetIndex = enabled[(currentIndex - 1 + enabled.length) % enabled.length]?.itemIndex;
    if (event.key === "Home") targetIndex = enabled[0]?.itemIndex;
    if (event.key === "End") targetIndex = enabled.at(-1)?.itemIndex;
    if (targetIndex !== undefined) {
      event.preventDefault();
      const target = directItems[targetIndex];
      if (target) select(target);
      tabRefs.current[targetIndex]?.focus();
    }
  };
  return (
    <div {...analyticsData(analyticsId)} className="np-overflow-tabs">
      <div aria-label={label} className="np-overflow-tabs__list" role="tablist">
        {directItems.map((item, index) => (
          <button
            aria-controls={item.panelId}
            aria-selected={item.id === selection}
            className="np-overflow-tabs__tab"
            disabled={item.disabled}
            id={`tab-${item.id}`}
            key={item.id}
            onClick={() => select(item)}
            onKeyDown={(event) => handleKey(event, index)}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            role="tab"
            tabIndex={item.id === selection ? 0 : -1}
            type="button"
          >
            <span>{item.label}</span>
            {item.meta}
          </button>
        ))}
      </div>
      {overflowItems.length > 0 ? (
        <MenuTrigger>
          <AriaButton aria-label="More tabs" className="np-overflow-tabs__more">
            <span>More</span>
            <Icon icon={ChevronDown} size="small" />
          </AriaButton>
          <AriaPopover className="np-popover" placement="bottom end">
            <AriaMenu
              aria-label="More tabs"
              className="np-menu"
              items={overflowItems}
              onAction={(key) => {
                const item = overflowItems.find((candidate) => candidate.id === String(key));
                if (item) select(item);
              }}
              selectionMode="single"
              selectedKeys={new Set([selection])}
            >
              {(item) => (
                <AriaMenuItem
                  className="np-menu__item"
                  id={item.id}
                  {...(item.disabled !== undefined ? { isDisabled: item.disabled } : {})}
                  textValue={item.label}
                >
                  <strong>{item.label}</strong>
                  {item.meta}
                  <span className="np-menu__check">
                    <Icon icon={Check} size="small" />
                  </span>
                </AriaMenuItem>
              )}
            </AriaMenu>
          </AriaPopover>
        </MenuTrigger>
      ) : null}
    </div>
  );
}
