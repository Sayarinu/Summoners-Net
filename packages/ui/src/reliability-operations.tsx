"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleDot,
  Code2,
  Download,
  ExternalLink,
  FileDiff,
  Filter,
  Fingerprint,
  KeyRound,
  LogIn,
  RadioTower,
  RefreshCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Wrench,
  XCircle,
} from "lucide-react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useId } from "react";

import { StatePanel } from "./data-display.js";
import { Checkbox, Input, Select, Switch, Textarea } from "./forms.js";
import { analyticsData, cx, Icon, Progress, VisuallyHidden } from "./internal.js";
import type { AnalyticsProps } from "./internal.js";
import { Button, Callout, IconButton, MetaText, StatusIndicator, TextLink } from "./primitives.js";

export type ReliabilityState = "conflicted" | "estimated" | "partial" | "unavailable" | "verified";
export type ReliabilityFreshnessState = "delayed" | "fresh" | "stale" | "unknown";
export type OperationOutcome = "failure" | "running" | "success" | "warning";

function freshnessTone(state: ReliabilityFreshnessState): "neutral" | "success" | "warning" {
  if (state === "fresh") return "success";
  if (state === "unknown") return "neutral";
  return "warning";
}

function operationTone(outcome: OperationOutcome): "danger" | "info" | "success" | "warning" {
  if (outcome === "success") return "success";
  if (outcome === "failure") return "danger";
  if (outcome === "warning") return "warning";
  return "info";
}

function readFormValue(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
}

export interface OfficialSourceLinkProps extends AnalyticsProps {
  readonly children?: ReactNode;
  readonly href: string;
  readonly source: string;
}

export function OfficialSourceLink({
  analyticsId,
  children,
  href,
  source,
}: OfficialSourceLinkProps) {
  return (
    <TextLink
      {...analyticsData(analyticsId)}
      aria-label={`Open official source: ${source}`}
      className="np-official-source-link"
      href={href}
      rel="noreferrer"
      target="_blank"
      variant="muted"
    >
      <Icon icon={ShieldCheck} size="small" />
      <span>{children ?? source}</span>
      <Icon icon={ExternalLink} size="small" />
    </TextLink>
  );
}

export interface SourceAttributionProps extends AnalyticsProps {
  readonly children?: ReactNode;
  readonly href?: string;
  readonly official?: boolean;
  readonly recordId?: string;
  readonly retrievedAt: string;
  readonly retrievedLabel: string;
  readonly source: string;
}

export function SourceAttribution({
  analyticsId,
  children,
  href,
  official = false,
  recordId,
  retrievedAt,
  retrievedLabel,
  source,
}: SourceAttributionProps) {
  return (
    <aside
      {...analyticsData(analyticsId)}
      className="np-source-attribution"
      aria-label="Data source"
    >
      <div className="np-source-attribution__identity">
        <div>
          <span className="np-source-attribution__label">
            {official ? "Official source" : "Source"}
          </span>
          {href ? (
            <TextLink
              aria-label={`Open official source: ${source}`}
              href={href}
              rel="noreferrer"
              target="_blank"
              variant="muted"
            >
              <span>{source}</span>
              <Icon icon={ExternalLink} size="small" />
            </TextLink>
          ) : (
            <strong>{source}</strong>
          )}
        </div>
      </div>
      <div className="np-source-attribution__meta">
        <time dateTime={retrievedAt}>{retrievedLabel}</time>
        {recordId ? <code>{recordId}</code> : null}
      </div>
      {children ? <div className="np-source-attribution__note">{children}</div> : null}
    </aside>
  );
}

export interface FreshnessStampProps extends AnalyticsProps {
  readonly compact?: boolean;
  readonly label: string;
  readonly state: ReliabilityFreshnessState;
  readonly updatedAt: string;
}

export function FreshnessStamp({
  analyticsId,
  compact = false,
  label,
  state,
  updatedAt,
}: FreshnessStampProps) {
  return (
    <span
      {...analyticsData(analyticsId)}
      className={cx("np-freshness-stamp", compact && "np-freshness-stamp--compact")}
    >
      <span className="np-visually-hidden">Data freshness: </span>
      <time dateTime={updatedAt}>{label}</time>
      <StatusIndicator label={state} tone={freshnessTone(state)} />
    </span>
  );
}

export interface DataQualityIssue {
  readonly detail?: ReactNode;
  readonly field?: string;
  readonly id: string;
  readonly label: string;
}

export interface DataQualityNoticeProps extends AnalyticsProps {
  readonly actions?: ReactNode;
  readonly issues?: readonly DataQualityIssue[];
  readonly state: ReliabilityState;
  readonly title?: string;
}

export function DataQualityNotice({
  actions,
  analyticsId,
  issues = [],
  state,
  title,
}: DataQualityNoticeProps) {
  const resolvedTitle =
    title ??
    (state === "verified"
      ? "Data verified"
      : state === "conflicted"
        ? "Sources disagree"
        : state === "unavailable"
          ? "Data unavailable"
          : state === "estimated"
            ? "Estimated values"
            : "Partial coverage");

  return (
    <section
      {...analyticsData(analyticsId)}
      aria-label={resolvedTitle}
      className={cx("np-data-quality", `np-data-quality--${state}`)}
    >
      <div className="np-data-quality__body">
        <div className="np-data-quality__heading">
          <h3>{resolvedTitle}</h3>
        </div>
        {issues.length > 0 ? (
          <ul>
            {issues.map((issue) => (
              <li key={issue.id}>
                <span>
                  {issue.field ? <code>{issue.field}</code> : null}
                  <strong>{issue.label}</strong>
                </span>
                {issue.detail ? <div>{issue.detail}</div> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {actions ? <div className="np-data-quality__actions">{actions}</div> : null}
    </section>
  );
}

export interface FieldProvenanceProps extends AnalyticsProps {
  readonly confidence?: number;
  readonly field: string;
  readonly official?: boolean;
  readonly overriddenBy?: string;
  readonly source: string;
  readonly sourceHref?: string;
  readonly updatedAt: string;
  readonly updatedLabel: string;
  readonly value: ReactNode;
}

export function FieldProvenance({
  analyticsId,
  confidence,
  field,
  official = false,
  overriddenBy,
  source,
  sourceHref,
  updatedAt,
  updatedLabel,
  value,
}: FieldProvenanceProps) {
  const safeConfidence =
    confidence === undefined ? undefined : Math.min(100, Math.max(0, confidence));
  return (
    <article {...analyticsData(analyticsId)} className="np-field-provenance">
      <header>
        <div>
          <span className="np-field-provenance__field">{field}</span>
          <strong>{value}</strong>
        </div>
        {overriddenBy ? <MetaText tone="warning">Overridden</MetaText> : null}
      </header>
      <dl>
        <div>
          <dt>Source</dt>
          <dd>
            {sourceHref ? (
              <OfficialSourceLink href={sourceHref} source={source}>
                {source}
              </OfficialSourceLink>
            ) : (
              <span>
                {official ? <Icon icon={ShieldCheck} size="small" /> : null}
                {source}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Observed</dt>
          <dd>
            <time dateTime={updatedAt}>{updatedLabel}</time>
          </dd>
        </div>
        {safeConfidence !== undefined ? (
          <div>
            <dt>Confidence</dt>
            <dd>{safeConfidence}%</dd>
          </div>
        ) : null}
        {overriddenBy ? (
          <div>
            <dt>Override</dt>
            <dd>{overriddenBy}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

export interface ProviderUnavailableProps extends AnalyticsProps {
  readonly fallbackLabel?: string;
  readonly onRetry?: () => void;
  readonly provider: string;
  readonly retrying?: boolean;
  readonly scope: string;
}

export function ProviderUnavailable({
  analyticsId,
  fallbackLabel,
  onRetry,
  provider,
  retrying = false,
  scope,
}: ProviderUnavailableProps) {
  return (
    <div {...analyticsData(analyticsId)} role="alert">
      <StatePanel
        action={
          onRetry ? (
            <Button
              loading={retrying}
              onPress={onRetry}
              startIcon={<Icon icon={RefreshCcw} size="small" />}
            >
              Retry Provider
            </Button>
          ) : null
        }
        title={`${provider} is unavailable`}
        tone="danger"
      >
        <p>{scope}</p>
        {fallbackLabel ? <p className="np-muted">Showing fallback: {fallbackLabel}</p> : null}
      </StatePanel>
    </div>
  );
}

export interface ConflictingCandidate {
  readonly observedAt: string;
  readonly source: string;
  readonly value: ReactNode;
}

export interface ConflictingSourceProps extends AnalyticsProps {
  readonly candidates: readonly ConflictingCandidate[];
  readonly field: string;
  readonly onReview?: () => void;
}

export function ConflictingSource({
  analyticsId,
  candidates,
  field,
  onReview,
}: ConflictingSourceProps) {
  return (
    <section {...analyticsData(analyticsId)} className="np-conflicting-source" role="alert">
      <header>
        <span>
          <Icon icon={FileDiff} size="medium" />
          <strong>Conflicting value for {field}</strong>
        </span>
        <StatusIndicator label="Review required" tone="danger" />
      </header>
      <ul>
        {candidates.map((candidate) => (
          <li key={`${candidate.source}-${candidate.observedAt}`}>
            <div>
              <span>{candidate.source}</span>
              <strong>{candidate.value}</strong>
            </div>
            <time dateTime={candidate.observedAt}>{candidate.observedAt}</time>
          </li>
        ))}
      </ul>
      {onReview ? (
        <Button onPress={onReview} size="small" variant="secondary">
          Review Conflict
        </Button>
      ) : null}
    </section>
  );
}

export interface AdminAuthCredentials {
  readonly email: string;
  readonly password: string;
}

export interface AdminAuthProps extends AnalyticsProps {
  readonly error?: string;
  readonly loading?: boolean;
  readonly onAuthenticate: (credentials: AdminAuthCredentials) => void;
  readonly onSso?: () => void;
}

export function AdminAuth({
  analyticsId,
  error,
  loading = false,
  onAuthenticate,
  onSso,
}: AdminAuthProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onAuthenticate({
      email: readFormValue(data, "email"),
      password: readFormValue(data, "password"),
    });
  };
  return (
    <main {...analyticsData(analyticsId)} className="np-auth-surface" id="main-content">
      <section aria-labelledby="np-admin-auth-title" className="np-auth-panel">
        <div className="np-auth-panel__mark">
          <Icon icon={ShieldCheck} size="large" />
        </div>
        <span className="np-eyebrow">Nexus Pulse operations</span>
        <h1 id="np-admin-auth-title">Authorized access</h1>
        <p>Sign in with your Nouvelle Lune Atelier operator account.</p>
        {error ? (
          <Callout title="Sign-in failed" tone="danger">
            {error}
          </Callout>
        ) : null}
        <form className="np-auth-form" onSubmit={handleSubmit}>
          <Input autoComplete="username" label="Email" name="email" required type="email" />
          <Input
            autoComplete="current-password"
            label="Password"
            name="password"
            required
            type="password"
          />
          <Button
            analyticsId="admin-auth-submit"
            loading={loading}
            startIcon={<Icon icon={LogIn} size="small" />}
            type="submit"
            variant="primary"
          >
            Sign In
          </Button>
        </form>
        {onSso ? (
          <Button onPress={onSso} variant="ghost">
            Continue With Company SSO
          </Button>
        ) : null}
      </section>
    </main>
  );
}

export interface AccessDeniedProps extends AnalyticsProps {
  readonly onRequestAccess?: () => void;
  readonly requiredRole?: string;
  readonly resource: string;
}

export function AccessDenied({
  analyticsId,
  onRequestAccess,
  requiredRole,
  resource,
}: AccessDeniedProps) {
  return (
    <div {...analyticsData(analyticsId)} className="np-access-state">
      <StatePanel
        action={
          onRequestAccess ? (
            <Button onPress={onRequestAccess} variant="secondary">
              Request Access
            </Button>
          ) : null
        }
        title="Access denied"
        tone="danger"
      >
        <p>You do not have permission to view {resource}.</p>
        {requiredRole ? <p className="np-muted">Required role: {requiredRole}</p> : null}
      </StatePanel>
    </div>
  );
}

export interface ReauthenticationProps extends AnalyticsProps {
  readonly error?: string;
  readonly loading?: boolean;
  readonly onCancel?: () => void;
  readonly onConfirm: (password: string) => void;
  readonly reason: string;
}

export function Reauthentication({
  analyticsId,
  error,
  loading = false,
  onCancel,
  onConfirm,
  reason,
}: ReauthenticationProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onConfirm(readFormValue(new FormData(event.currentTarget), "password"));
  };
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-labelledby="np-reauth-title"
      className="np-reauthentication"
    >
      <header>
        <Icon icon={KeyRound} size="large" />
        <div>
          <span className="np-eyebrow">Security check</span>
          <h2 id="np-reauth-title">Confirm your identity</h2>
          <p>{reason}</p>
        </div>
      </header>
      <form onSubmit={handleSubmit}>
        <Input
          autoComplete="current-password"
          {...(error ? { error } : {})}
          label="Password"
          name="password"
          required
          type="password"
        />
        <div className="np-form-actions">
          {onCancel ? (
            <Button onPress={onCancel} type="button" variant="ghost">
              Cancel
            </Button>
          ) : null}
          <Button loading={loading} type="submit" variant="primary">
            Confirm Identity
          </Button>
        </div>
      </form>
    </section>
  );
}

export interface SessionExpiredProps extends AnalyticsProps {
  readonly onSignIn: () => void;
  readonly returnPath?: string;
}

export function SessionExpired({ analyticsId, onSignIn, returnPath }: SessionExpiredProps) {
  return (
    <div {...analyticsData(analyticsId)} className="np-access-state" role="alert">
      <StatePanel
        action={
          <Button
            onPress={onSignIn}
            startIcon={<Icon icon={LogIn} size="small" />}
            variant="primary"
          >
            Sign In Again
          </Button>
        }
        title="Session expired"
        tone="warning"
      >
        <p>Your work is preserved locally. Sign in to continue.</p>
        {returnPath ? <p className="np-muted">Return to {returnPath}</p> : null}
      </StatePanel>
    </div>
  );
}

export interface ProviderPriorityItem {
  readonly id: string;
  readonly name: string;
  readonly state?: "disabled" | "healthy" | "unavailable";
}

export interface ProviderPriorityListProps extends AnalyticsProps {
  readonly items: readonly ProviderPriorityItem[];
  readonly onMove?: (id: string, direction: "down" | "up") => void;
}

export function ProviderPriorityList({ analyticsId, items, onMove }: ProviderPriorityListProps) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-labelledby="np-provider-priority-title"
      className="np-priority-list"
    >
      <header>
        <div>
          <h3 id="np-provider-priority-title">Provider priority</h3>
          <p>Higher sources win when records are equally fresh.</p>
        </div>
        <MetaText>{items.length} sources</MetaText>
      </header>
      <ol>
        {items.map((item, index) => (
          <li key={item.id}>
            <span className="np-priority-list__position">{index + 1}</span>
            <div>
              <strong>{item.name}</strong>
              {item.state ? (
                <StatusIndicator
                  label={item.state}
                  tone={
                    item.state === "healthy"
                      ? "success"
                      : item.state === "unavailable"
                        ? "danger"
                        : "neutral"
                  }
                />
              ) : null}
            </div>
            {onMove ? (
              <span className="np-priority-list__actions">
                <IconButton
                  disabled={index === 0}
                  icon={<Icon icon={ArrowUp} size="small" />}
                  label={`Move ${item.name} up`}
                  onPress={() => onMove(item.id, "up")}
                  size="compact"
                  variant="ghost"
                />
                <IconButton
                  disabled={index === items.length - 1}
                  icon={<Icon icon={ArrowDown} size="small" />}
                  label={`Move ${item.name} down`}
                  onPress={() => onMove(item.id, "down")}
                  size="compact"
                  variant="ghost"
                />
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export interface ProviderFormValues {
  readonly baseUrl: string;
  readonly name: string;
  readonly providerType: string;
  readonly secret: string;
}

export interface ProviderFormProps extends AnalyticsProps {
  readonly initialValues?: Partial<ProviderFormValues>;
  readonly onCancel?: () => void;
  readonly onPriorityMove?: (id: string, direction: "down" | "up") => void;
  readonly onSubmit: (values: ProviderFormValues) => void;
  readonly priorities?: readonly ProviderPriorityItem[];
  readonly saving?: boolean;
  readonly secretConfigured?: boolean;
}

export function ProviderForm({
  analyticsId,
  initialValues = {},
  onCancel,
  onPriorityMove,
  onSubmit,
  priorities = [],
  saving = false,
  secretConfigured = false,
}: ProviderFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({
      baseUrl: readFormValue(data, "baseUrl"),
      name: readFormValue(data, "name"),
      providerType: readFormValue(data, "providerType"),
      secret: readFormValue(data, "secret"),
    });
  };
  return (
    <form {...analyticsData(analyticsId)} className="np-provider-form" onSubmit={handleSubmit}>
      <header className="np-form-heading">
        <div>
          <span className="np-eyebrow">Data integration</span>
          <h2>Provider configuration</h2>
        </div>
        <StatusIndicator
          label={secretConfigured ? "Configured" : "Setup required"}
          tone={secretConfigured ? "success" : "warning"}
        />
      </header>
      <div className="np-form-grid">
        <Input defaultValue={initialValues.name} label="Provider name" name="name" required />
        <Select
          defaultValue={initialValues.providerType ?? "schedule"}
          label="Provider type"
          name="providerType"
          options={[
            { label: "Schedule and results", value: "schedule" },
            { label: "Live telemetry", value: "live" },
            { label: "Teams and rosters", value: "roster" },
            { label: "Statistics", value: "statistics" },
          ]}
        />
        <Input
          autoComplete="url"
          defaultValue={initialValues.baseUrl}
          label="Base URL"
          name="baseUrl"
          placeholder="https://api.provider.example/v1"
          required
          type="url"
        />
        <Input
          autoComplete="new-password"
          defaultValue={initialValues.secret}
          description={
            secretConfigured
              ? "Leave blank to retain the encrypted secret. A replacement cannot be viewed after save."
              : "Stored encrypted and redacted from logs, exports, and audit details."
          }
          label="API secret"
          name="secret"
          placeholder={secretConfigured ? "••••••••••••" : "Enter secret"}
          required={!secretConfigured}
          type="password"
        />
      </div>
      <fieldset className="np-provider-form__options">
        <legend>Collection policy</legend>
        <Checkbox defaultSelected name="verifyTls" value="true">
          Require TLS certificate validation
        </Checkbox>
        <Switch defaultSelected>Enable scheduled ingestion</Switch>
      </fieldset>
      {priorities.length > 0 ? (
        <ProviderPriorityList
          items={priorities}
          {...(onPriorityMove ? { onMove: onPriorityMove } : {})}
        />
      ) : null}
      <div className="np-form-actions">
        {onCancel ? (
          <Button onPress={onCancel} type="button" variant="ghost">
            Cancel
          </Button>
        ) : null}
        <Button
          loading={saving}
          startIcon={<Icon icon={Save} size="small" />}
          type="submit"
          variant="primary"
        >
          Save Provider
        </Button>
      </div>
    </form>
  );
}

export type ConflictSeverity = "high" | "low" | "medium";

export interface ConflictQueueItem {
  readonly entity: string;
  readonly fieldCount: number;
  readonly id: string;
  readonly receivedAt: string;
  readonly severity: ConflictSeverity;
  readonly sources: readonly string[];
}

export interface ConflictQueueProps extends AnalyticsProps {
  readonly items: readonly ConflictQueueItem[];
  readonly onSelect?: (id: string) => void;
  readonly selectedId?: string;
}

export function ConflictQueue({ analyticsId, items, onSelect, selectedId }: ConflictQueueProps) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-labelledby="np-conflict-queue-title"
      className="np-conflict-queue"
    >
      <header>
        <div>
          <span className="np-eyebrow">Reconciliation</span>
          <h2 id="np-conflict-queue-title">Conflict queue</h2>
        </div>
        <StatusIndicator
          label={`${items.length} open`}
          tone={items.length > 0 ? "warning" : "success"}
        />
      </header>
      {items.length === 0 ? (
        <div className="np-conflict-queue__empty">
          <Icon icon={CheckCircle2} size="medium" />
          <span>No conflicts require review.</span>
        </div>
      ) : (
        <ul>
          {items.map((item) => {
            const content = (
              <>
                <span
                  className={cx("np-conflict-severity", `np-conflict-severity--${item.severity}`)}
                >
                  <VisuallyHidden>{item.severity} severity</VisuallyHidden>
                </span>
                <span className="np-conflict-queue__identity">
                  <strong>{item.entity}</strong>
                  <small>{item.sources.join(" · ")}</small>
                </span>
                <span>{item.fieldCount} fields</span>
                <time dateTime={item.receivedAt}>{item.receivedAt}</time>
              </>
            );
            return (
              <li key={item.id}>
                {onSelect ? (
                  <button
                    aria-current={selectedId === item.id ? "true" : undefined}
                    className="np-conflict-queue__row"
                    onClick={() => onSelect(item.id)}
                    type="button"
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    aria-current={selectedId === item.id ? "true" : undefined}
                    className="np-conflict-queue__row"
                  >
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export type FieldResolution = "candidate" | "canonical" | "custom";

export interface FieldDiffRow {
  readonly candidate: ReactNode;
  readonly canonical: ReactNode;
  readonly field: string;
  readonly id: string;
  readonly resolution?: FieldResolution;
  readonly source: string;
}

export interface FieldDiffProps extends AnalyticsProps {
  readonly onResolutionChange?: (id: string, resolution: FieldResolution) => void;
  readonly rows: readonly FieldDiffRow[];
}

export function FieldDiff({ analyticsId, onResolutionChange, rows }: FieldDiffProps) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-labelledby="np-field-diff-title"
      className="np-field-diff"
    >
      <header>
        <Icon icon={FileDiff} size="medium" />
        <div>
          <h3 id="np-field-diff-title">Field comparison</h3>
          <p>Choose the value that should become canonical.</p>
        </div>
      </header>
      <div className="np-field-diff__table" role="table" aria-label="Conflicting field values">
        <div className="np-field-diff__head" role="row">
          <span role="columnheader">Field</span>
          <span role="columnheader">Canonical</span>
          <span role="columnheader">Candidate</span>
          <span role="columnheader">Resolution</span>
        </div>
        {rows.map((row) => (
          <fieldset className="np-field-diff__row" key={row.id} role="row">
            <legend className="np-visually-hidden">Resolve {row.field}</legend>
            <span className="np-field-diff__field" role="rowheader">
              {row.field}
            </span>
            <label role="cell">
              <input
                checked={row.resolution === "canonical"}
                name={`resolution-${row.id}`}
                onChange={() => onResolutionChange?.(row.id, "canonical")}
                type="radio"
              />
              <span>{row.canonical}</span>
            </label>
            <label role="cell">
              <input
                checked={row.resolution === "candidate"}
                name={`resolution-${row.id}`}
                onChange={() => onResolutionChange?.(row.id, "candidate")}
                type="radio"
              />
              <span>
                {row.candidate}
                <small>{row.source}</small>
              </span>
            </label>
            <label className="np-field-diff__custom" role="cell">
              <input
                checked={row.resolution === "custom"}
                name={`resolution-${row.id}`}
                onChange={() => onResolutionChange?.(row.id, "custom")}
                type="radio"
              />
              <span>Custom value</span>
            </label>
          </fieldset>
        ))}
      </div>
    </section>
  );
}

export interface OverrideValues {
  readonly expiresAt: string;
  readonly reason: string;
  readonly value: string;
}

export interface OverrideEditorProps extends AnalyticsProps {
  readonly currentValue: ReactNode;
  readonly entity: string;
  readonly field: string;
  readonly onCancel?: () => void;
  readonly onSubmit: (values: OverrideValues) => void;
  readonly saving?: boolean;
}

export function OverrideEditor({
  analyticsId,
  currentValue,
  entity,
  field,
  onCancel,
  onSubmit,
  saving = false,
}: OverrideEditorProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({
      expiresAt: readFormValue(data, "expiresAt"),
      reason: readFormValue(data, "reason"),
      value: readFormValue(data, "value"),
    });
  };
  return (
    <form {...analyticsData(analyticsId)} className="np-override-editor" onSubmit={handleSubmit}>
      <header className="np-form-heading">
        <div>
          <span className="np-eyebrow">Manual correction</span>
          <h2>Override {field}</h2>
          <p>{entity}</p>
        </div>
        <MetaText tone="warning">Audited</MetaText>
      </header>
      <dl className="np-current-value">
        <dt>Current canonical value</dt>
        <dd>{currentValue}</dd>
      </dl>
      <Input label="Replacement value" name="value" required />
      <Textarea
        description="Explain the source and reason. This note is written to the audit log."
        label="Reason"
        minLength={12}
        name="reason"
        required
        rows={4}
      />
      <Input
        description="Optional. Leave blank for an override that remains until manually removed."
        label="Expires at"
        name="expiresAt"
        type="datetime-local"
      />
      <Callout title="Approval required" tone="warning">
        Overrides affect every public view that uses this field and must be published separately.
      </Callout>
      <div className="np-form-actions">
        {onCancel ? (
          <Button onPress={onCancel} type="button" variant="ghost">
            Cancel
          </Button>
        ) : null}
        <Button loading={saving} type="submit" variant="primary">
          Save Draft Override
        </Button>
      </div>
    </form>
  );
}

export type PublishStep = "draft" | "preview" | "published";

export interface PublishWorkflowProps extends AnalyticsProps {
  readonly current: PublishStep;
  readonly description?: ReactNode;
  readonly onBackToDraft?: () => void;
  readonly onPreview?: () => void;
  readonly onPublish?: () => void;
  readonly publishing?: boolean;
  readonly title: string;
}

const publishSteps: readonly { id: PublishStep; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "preview", label: "Preview" },
  { id: "published", label: "Published" },
];

export function PublishWorkflow({
  analyticsId,
  current,
  description,
  onBackToDraft,
  onPreview,
  onPublish,
  publishing = false,
  title,
}: PublishWorkflowProps) {
  const currentIndex = publishSteps.findIndex((step) => step.id === current);
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-labelledby="np-publish-workflow-title"
      className="np-publish-workflow"
    >
      <header>
        <div>
          <span className="np-eyebrow">Controlled publication</span>
          <h2 id="np-publish-workflow-title">{title}</h2>
        </div>
        <StatusIndicator label={current} tone={current === "published" ? "success" : "warning"} />
      </header>
      <ol aria-label="Publication progress" className="np-publish-workflow__steps">
        {publishSteps.map((step, index) => (
          <li
            aria-current={step.id === current ? "step" : undefined}
            className={cx(index <= currentIndex && "np-publish-workflow__step--complete")}
            key={step.id}
          >
            <span>
              {index < currentIndex ? <Icon icon={CheckCircle2} size="small" /> : index + 1}
            </span>
            <strong>{step.label}</strong>
          </li>
        ))}
      </ol>
      {description ? <div className="np-publish-workflow__preview">{description}</div> : null}
      <div className="np-form-actions">
        {current === "preview" && onBackToDraft ? (
          <Button onPress={onBackToDraft} variant="ghost">
            Back To Draft
          </Button>
        ) : null}
        {current === "draft" && onPreview ? (
          <Button onPress={onPreview} variant="primary">
            Review Preview
          </Button>
        ) : null}
        {current === "preview" && onPublish ? (
          <Button loading={publishing} onPress={onPublish} variant="primary">
            Publish Changes
          </Button>
        ) : null}
      </div>
    </section>
  );
}

export interface RunDetailEvent {
  readonly detail?: ReactNode;
  readonly id: string;
  readonly label: string;
  readonly outcome: OperationOutcome;
  readonly timestamp: string;
}

export interface RunDetailProps extends AnalyticsProps {
  readonly duration?: string;
  readonly events: readonly RunDetailEvent[];
  readonly id: string;
  readonly onCancel?: () => void;
  readonly onRetry?: () => void;
  readonly progress?: number;
  readonly provider: string;
  readonly startedAt: string;
  readonly state: "cancelled" | "failed" | "queued" | "running" | "succeeded";
}

export function RunDetail({
  analyticsId,
  duration,
  events,
  id,
  onCancel,
  onRetry,
  progress,
  provider,
  startedAt,
  state,
}: RunDetailProps) {
  const outcome: OperationOutcome =
    state === "succeeded" ? "success" : state === "failed" ? "failure" : "running";
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-labelledby="np-run-detail-title"
      className="np-run-detail"
    >
      <header>
        <div>
          <span className="np-eyebrow">Ingestion run</span>
          <h2 id="np-run-detail-title">{provider}</h2>
          <code>{id}</code>
        </div>
        <StatusIndicator label={state} tone={operationTone(outcome)} />
      </header>
      <dl className="np-run-detail__meta">
        <div>
          <dt>Started</dt>
          <dd>
            <time dateTime={startedAt}>{startedAt}</time>
          </dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{duration ?? "In progress"}</dd>
        </div>
        <div>
          <dt>Events</dt>
          <dd>{events.length}</dd>
        </div>
      </dl>
      {state === "running" && progress !== undefined ? (
        <Progress label="Run progress" value={progress} />
      ) : null}
      <ol className="np-run-detail__events">
        {events.map((event) => (
          <li className={`np-operation-${event.outcome}`} key={event.id}>
            <span aria-hidden="true" className="np-run-detail__marker" />
            <div>
              <strong>{event.label}</strong>
              {event.detail ? <div>{event.detail}</div> : null}
            </div>
            <time dateTime={event.timestamp}>{event.timestamp}</time>
          </li>
        ))}
      </ol>
      <div className="np-form-actions">
        {state === "running" && onCancel ? (
          <Button onPress={onCancel} variant="ghost">
            Cancel Run
          </Button>
        ) : null}
        {state === "failed" && onRetry ? (
          <Button onPress={onRetry} variant="primary">
            Retry Run
          </Button>
        ) : null}
      </div>
    </section>
  );
}

export type LogLevel = "debug" | "error" | "info" | "warn";

export interface LogEntry {
  readonly correlationId?: string;
  readonly id: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly service: string;
  readonly timestamp: string;
}

export interface LogViewerProps extends AnalyticsProps {
  readonly entries: readonly LogEntry[];
  readonly level?: "all" | LogLevel;
  readonly onLevelChange?: (level: "all" | LogLevel) => void;
  readonly onQueryChange?: (query: string) => void;
  readonly onSelect?: (id: string) => void;
  readonly query?: string;
}

export function LogViewer({
  analyticsId,
  entries,
  level = "all",
  onLevelChange,
  onQueryChange,
  onSelect,
  query = "",
}: LogViewerProps) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-labelledby="np-log-viewer-title"
      className="np-log-viewer"
    >
      <header>
        <div>
          <span className="np-eyebrow">Diagnostics</span>
          <h2 id="np-log-viewer-title">Run logs</h2>
        </div>
        <MetaText>{entries.length} entries</MetaText>
      </header>
      <div className="np-log-viewer__toolbar">
        <label className="np-log-search">
          <span className="np-visually-hidden">Search logs</span>
          <Icon icon={Search} size="small" />
          <input
            onChange={(event) => onQueryChange?.(event.currentTarget.value)}
            placeholder="Search messages or correlation ID"
            type="search"
            value={query}
          />
        </label>
        <label className="np-log-level">
          <span>Level</span>
          <select
            onChange={(event) => onLevelChange?.(event.currentTarget.value as "all" | LogLevel)}
            value={level}
          >
            <option value="all">All levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </label>
      </div>
      <div className="np-log-viewer__viewport" role="log" aria-live="off" tabIndex={0}>
        {entries.length === 0 ? <p>No log entries match these filters.</p> : null}
        {entries.map((entry) => {
          const content = (
            <>
              <time dateTime={entry.timestamp}>{entry.timestamp}</time>
              <MetaText
                tone={
                  entry.level === "error"
                    ? "danger"
                    : entry.level === "warn"
                      ? "warning"
                      : entry.level === "info"
                        ? "info"
                        : "neutral"
                }
              >
                {entry.level}
              </MetaText>
              <span>{entry.service}</span>
              <code>{entry.message}</code>
              {entry.correlationId ? <small>{entry.correlationId}</small> : null}
            </>
          );
          return onSelect ? (
            <button
              className="np-log-entry"
              key={entry.id}
              onClick={() => onSelect(entry.id)}
              type="button"
            >
              {content}
            </button>
          ) : (
            <div className="np-log-entry" key={entry.id}>
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export interface TraceSpan {
  readonly duration: string;
  readonly id: string;
  readonly name: string;
  readonly service: string;
  readonly state: "error" | "ok";
}

export interface TraceCorrelationDetailProps extends AnalyticsProps {
  readonly correlationId: string;
  readonly duration: string;
  readonly onCopy?: () => void;
  readonly spans: readonly TraceSpan[];
  readonly startedAt: string;
  readonly traceId: string;
}

export function TraceCorrelationDetail({
  analyticsId,
  correlationId,
  duration,
  onCopy,
  spans,
  startedAt,
  traceId,
}: TraceCorrelationDetailProps) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-labelledby="np-trace-title"
      className="np-trace-detail"
    >
      <header>
        <div>
          <span className="np-eyebrow">Distributed trace</span>
          <h2 id="np-trace-title">Request correlation</h2>
        </div>
        <Icon icon={Fingerprint} size="large" />
      </header>
      <dl className="np-trace-detail__meta">
        <div>
          <dt>Trace ID</dt>
          <dd>
            <code>{traceId}</code>
          </dd>
        </div>
        <div>
          <dt>Correlation ID</dt>
          <dd>
            <code>{correlationId}</code>
          </dd>
        </div>
        <div>
          <dt>Started</dt>
          <dd>
            <time dateTime={startedAt}>{startedAt}</time>
          </dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{duration}</dd>
        </div>
      </dl>
      {onCopy ? (
        <Button onPress={onCopy} size="compact" variant="ghost">
          Copy Correlation IDs
        </Button>
      ) : null}
      <ol className="np-trace-detail__spans">
        {spans.map((span, index) => (
          <li key={span.id} style={{ "--np-span-depth": index } as CSSProperties}>
            <span className={`np-trace-span--${span.state}`} aria-hidden="true" />
            <div>
              <strong>{span.name}</strong>
              <small>{span.service}</small>
            </div>
            <code>{span.id}</code>
            <span>{span.duration}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export interface AuditFilterValues {
  readonly action: string;
  readonly actor: string;
  readonly from: string;
  readonly outcome: string;
  readonly to: string;
}

export interface AuditFiltersProps extends AnalyticsProps {
  readonly onApply: (values: AuditFilterValues) => void;
  readonly onReset?: () => void;
}

export function AuditFilters({ analyticsId, onApply, onReset }: AuditFiltersProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onApply({
      action: readFormValue(data, "action"),
      actor: readFormValue(data, "actor"),
      from: readFormValue(data, "from"),
      outcome: readFormValue(data, "outcome"),
      to: readFormValue(data, "to"),
    });
  };
  return (
    <form {...analyticsData(analyticsId)} className="np-audit-filters" onSubmit={handleSubmit}>
      <div className="np-audit-filters__heading">
        <Icon icon={Filter} size="medium" />
        <h3>Audit filters</h3>
      </div>
      <div className="np-audit-filters__fields">
        <Input label="Actor" name="actor" placeholder="Name or service" />
        <Input label="Action" name="action" placeholder="Updated, published…" />
        <Select
          label="Outcome"
          name="outcome"
          options={[
            { label: "Any outcome", value: "" },
            { label: "Success", value: "success" },
            { label: "Failure", value: "failure" },
          ]}
        />
        <Input label="From" name="from" type="datetime-local" />
        <Input label="To" name="to" type="datetime-local" />
      </div>
      <div className="np-form-actions">
        {onReset ? (
          <Button onPress={onReset} type="reset" variant="ghost">
            Reset
          </Button>
        ) : null}
        <Button startIcon={<Icon icon={SlidersHorizontal} size="small" />} type="submit">
          Apply Filters
        </Button>
      </div>
    </form>
  );
}

export interface AuditEventDetailProps extends AnalyticsProps {
  readonly action: string;
  readonly actor: string;
  readonly changes?: readonly {
    readonly after: ReactNode;
    readonly before: ReactNode;
    readonly field: string;
  }[];
  readonly correlationId?: string;
  readonly eventId: string;
  readonly ipAddress?: string;
  readonly outcome: "failure" | "success";
  readonly target: string;
  readonly timestamp: string;
}

export function AuditEventDetail({
  action,
  actor,
  analyticsId,
  changes = [],
  correlationId,
  eventId,
  ipAddress,
  outcome,
  target,
  timestamp,
}: AuditEventDetailProps) {
  return (
    <article {...analyticsData(analyticsId)} className="np-audit-detail">
      <header>
        <div>
          <span className="np-eyebrow">Audit event</span>
          <h2>{action}</h2>
          <code>{eventId}</code>
        </div>
        <StatusIndicator label={outcome} tone={outcome === "success" ? "success" : "danger"} />
      </header>
      <dl className="np-audit-detail__meta">
        <div>
          <dt>Actor</dt>
          <dd>{actor}</dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>{target}</dd>
        </div>
        <div>
          <dt>Occurred</dt>
          <dd>
            <time dateTime={timestamp}>{timestamp}</time>
          </dd>
        </div>
        {ipAddress ? (
          <div>
            <dt>IP address</dt>
            <dd>
              <code>{ipAddress}</code>
            </dd>
          </div>
        ) : null}
        {correlationId ? (
          <div>
            <dt>Correlation</dt>
            <dd>
              <code>{correlationId}</code>
            </dd>
          </div>
        ) : null}
      </dl>
      {changes.length > 0 ? (
        <section className="np-audit-detail__changes" aria-labelledby="np-audit-changes-title">
          <h3 id="np-audit-changes-title">Field changes</h3>
          <div role="table" aria-label="Audit field changes">
            {changes.map((change) => (
              <div key={change.field} role="row">
                <strong role="rowheader">{change.field}</strong>
                <span role="cell">
                  <small>Before</small>
                  {change.before}
                </span>
                <span role="cell">
                  <small>After</small>
                  {change.after}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

export interface AuditExportProps extends AnalyticsProps {
  readonly count: number;
  readonly onExport: (format: "csv" | "json") => void;
  readonly rangeLabel: string;
}

export function AuditExport({ analyticsId, count, onExport, rangeLabel }: AuditExportProps) {
  return (
    <section {...analyticsData(analyticsId)} className="np-audit-export">
      <div>
        <Icon icon={Download} size="medium" />
        <span>
          <strong>Export audit evidence</strong>
          <small>
            {count} events · {rangeLabel}
          </small>
        </span>
      </div>
      <div>
        <Button onPress={() => onExport("csv")} size="small" variant="ghost">
          CSV
        </Button>
        <Button onPress={() => onExport("json")} size="small" variant="secondary">
          JSON
        </Button>
      </div>
    </section>
  );
}

export interface IncidentEditorValues {
  readonly affected: string;
  readonly severity: string;
  readonly status: string;
  readonly summary: string;
  readonly title: string;
}

export interface IncidentEditorProps extends AnalyticsProps {
  readonly initialValues?: Partial<IncidentEditorValues>;
  readonly onCancel?: () => void;
  readonly onSave: (values: IncidentEditorValues) => void;
  readonly saving?: boolean;
}

export function IncidentEditor({
  analyticsId,
  initialValues = {},
  onCancel,
  onSave,
  saving = false,
}: IncidentEditorProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSave({
      affected: readFormValue(data, "affected"),
      severity: readFormValue(data, "severity"),
      status: readFormValue(data, "status"),
      summary: readFormValue(data, "summary"),
      title: readFormValue(data, "title"),
    });
  };
  return (
    <form {...analyticsData(analyticsId)} className="np-incident-editor" onSubmit={handleSubmit}>
      <header className="np-form-heading">
        <div>
          <span className="np-eyebrow">Incident management</span>
          <h2>Incident details</h2>
        </div>
        <Icon icon={Siren} size="large" />
      </header>
      <Input defaultValue={initialValues.title} label="Incident title" name="title" required />
      <div className="np-form-grid">
        <Select
          defaultValue={initialValues.severity ?? "major"}
          label="Severity"
          name="severity"
          options={[
            { label: "Minor", value: "minor" },
            { label: "Major", value: "major" },
            { label: "Critical", value: "critical" },
          ]}
        />
        <Select
          defaultValue={initialValues.status ?? "investigating"}
          label="Status"
          name="status"
          options={[
            { label: "Investigating", value: "investigating" },
            { label: "Identified", value: "identified" },
            { label: "Monitoring", value: "monitoring" },
            { label: "Resolved", value: "resolved" },
          ]}
        />
      </div>
      <Input
        defaultValue={initialValues.affected}
        description="Comma-separated public service names."
        label="Affected services"
        name="affected"
        required
      />
      <Textarea
        defaultValue={initialValues.summary}
        label="Operator summary"
        name="summary"
        required
        rows={5}
      />
      <div className="np-form-actions">
        {onCancel ? (
          <Button onPress={onCancel} type="button" variant="ghost">
            Cancel
          </Button>
        ) : null}
        <Button
          loading={saving}
          startIcon={<Icon icon={Save} size="small" />}
          type="submit"
          variant="primary"
        >
          Save Incident
        </Button>
      </div>
    </form>
  );
}

export interface IncidentUpdateValues {
  readonly message: string;
  readonly status: string;
}

export interface IncidentUpdateComposerProps extends AnalyticsProps {
  readonly onPublish: (values: IncidentUpdateValues) => void;
  readonly publishing?: boolean;
}

export function IncidentUpdateComposer({
  analyticsId,
  onPublish,
  publishing = false,
}: IncidentUpdateComposerProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onPublish({ message: readFormValue(data, "message"), status: readFormValue(data, "status") });
  };
  return (
    <form {...analyticsData(analyticsId)} className="np-incident-composer" onSubmit={handleSubmit}>
      <header>
        <Icon icon={RadioTower} size="medium" />
        <div>
          <h3>Post an update</h3>
          <p>Published immediately to the status page and subscribers.</p>
        </div>
      </header>
      <Select
        defaultValue="investigating"
        label="Incident status"
        name="status"
        options={[
          { label: "Investigating", value: "investigating" },
          { label: "Identified", value: "identified" },
          { label: "Monitoring", value: "monitoring" },
          { label: "Resolved", value: "resolved" },
        ]}
      />
      <Textarea label="Public update" minLength={16} name="message" required rows={5} />
      <div className="np-incident-composer__notice">
        <Icon icon={ExternalLink} size="small" />
        This message is public and cannot be silently edited.
      </div>
      <div className="np-form-actions">
        <Button
          loading={publishing}
          startIcon={<Icon icon={Send} size="small" />}
          type="submit"
          variant="primary"
        >
          Publish Update
        </Button>
      </div>
    </form>
  );
}

export type SystemHealth =
  "degraded" | "major-outage" | "maintenance" | "operational" | "partial-outage";

function systemTone(health: SystemHealth): "danger" | "info" | "success" | "warning" {
  if (health === "operational") return "success";
  if (health === "major-outage") return "danger";
  if (health === "maintenance") return "info";
  return "warning";
}

export interface SystemStatusHeaderProps extends AnalyticsProps {
  readonly checkedAt: string;
  readonly checkedLabel: string;
  readonly health: SystemHealth;
  readonly message?: string;
  readonly title?: string;
}

export function SystemStatusHeader({
  analyticsId,
  checkedAt,
  checkedLabel,
  health,
  message,
  title,
}: SystemStatusHeaderProps) {
  const resolvedTitle =
    title ??
    (health === "operational"
      ? "All systems operational"
      : health === "maintenance"
        ? "Scheduled maintenance"
        : "Some systems are affected");
  return (
    <header
      {...analyticsData(analyticsId)}
      className={cx("np-system-status-header", `np-system-status-header--${health}`)}
    >
      <div className="np-system-status-header__signal">
        <Icon
          icon={
            health === "operational"
              ? CheckCircle2
              : health === "major-outage"
                ? XCircle
                : health === "maintenance"
                  ? Wrench
                  : AlertTriangle
          }
          size="large"
        />
      </div>
      <div>
        <span className="np-eyebrow">Nexus Pulse status</span>
        <h1>{resolvedTitle}</h1>
        {message ? <p>{message}</p> : null}
      </div>
      <div className="np-system-status-header__meta">
        <StatusIndicator label={health.replaceAll("-", " ")} tone={systemTone(health)} />
        <time dateTime={checkedAt}>{checkedLabel}</time>
      </div>
    </header>
  );
}

export interface ServiceStatusRowProps extends AnalyticsProps {
  readonly description?: string;
  readonly latency?: string;
  readonly name: string;
  readonly status: SystemHealth;
  readonly uptime?: string;
}

export function ServiceStatusRow({
  analyticsId,
  description,
  latency,
  name,
  status,
  uptime,
}: ServiceStatusRowProps) {
  return (
    <article {...analyticsData(analyticsId)} className="np-service-status-row">
      <div>
        <span
          className={`np-service-status-row__signal np-service-status-row__signal--${status}`}
          aria-hidden="true"
        />
        <span>
          <strong>{name}</strong>
          {description ? <small>{description}</small> : null}
        </span>
      </div>
      {latency ? (
        <span>
          <small>Latency</small>
          {latency}
        </span>
      ) : null}
      {uptime ? (
        <span>
          <small>90-day uptime</small>
          {uptime}
        </span>
      ) : null}
      <StatusIndicator label={status.replaceAll("-", " ")} tone={systemTone(status)} />
    </article>
  );
}

export type UptimeDayStatus = "degraded" | "maintenance" | "operational" | "outage" | "unknown";

export interface UptimeDay {
  readonly date: string;
  readonly label: string;
  readonly status: UptimeDayStatus;
}

export interface UptimeHistoryProps extends AnalyticsProps {
  readonly days: readonly UptimeDay[];
  readonly service: string;
  readonly uptime: string;
}

export function UptimeHistory({ analyticsId, days, service, uptime }: UptimeHistoryProps) {
  const id = useId();
  return (
    <figure {...analyticsData(analyticsId)} aria-labelledby={id} className="np-uptime-history">
      <figcaption id={id}>
        <span>
          <strong>{service}</strong>
          <small>Last {days.length} days</small>
        </span>
        <strong>{uptime} uptime</strong>
      </figcaption>
      <div aria-hidden="true" className="np-uptime-history__bars">
        {days.map((day) => (
          <span
            className={`np-uptime-day--${day.status}`}
            key={day.date}
            title={`${day.label}: ${day.status}`}
          />
        ))}
      </div>
      <p className="np-visually-hidden">
        {days.map((day) => `${day.label}: ${day.status}`).join("; ")}
      </p>
      <div className="np-uptime-history__legend" aria-hidden="true">
        <span>Past</span>
        <span>No incidents</span>
        <span>Today</span>
      </div>
    </figure>
  );
}

export interface MaintenanceNoticeProps extends AnalyticsProps {
  readonly affected: readonly string[];
  readonly description: ReactNode;
  readonly endsAt: string;
  readonly endsLabel: string;
  readonly startsAt: string;
  readonly startsLabel: string;
  readonly title: string;
}

export function MaintenanceNotice({
  affected,
  analyticsId,
  description,
  endsAt,
  endsLabel,
  startsAt,
  startsLabel,
  title,
}: MaintenanceNoticeProps) {
  return (
    <article {...analyticsData(analyticsId)} className="np-maintenance-notice">
      <div className="np-maintenance-notice__icon">
        <Icon icon={Wrench} size="large" />
      </div>
      <div>
        <span className="np-eyebrow">Scheduled maintenance</span>
        <h2>{title}</h2>
        <div>{description}</div>
        <dl>
          <div>
            <dt>Starts</dt>
            <dd>
              <time dateTime={startsAt}>{startsLabel}</time>
            </dd>
          </div>
          <div>
            <dt>Expected end</dt>
            <dd>
              <time dateTime={endsAt}>{endsLabel}</time>
            </dd>
          </div>
          <div>
            <dt>Affected</dt>
            <dd>{affected.join(", ")}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

export interface IncidentUpdateProps extends AnalyticsProps {
  readonly author?: string;
  readonly children: ReactNode;
  readonly status: "identified" | "investigating" | "monitoring" | "resolved";
  readonly timestamp: string;
  readonly timestampLabel: string;
}

export function IncidentUpdate({
  analyticsId,
  author,
  children,
  status,
  timestamp,
  timestampLabel,
}: IncidentUpdateProps) {
  return (
    <article
      {...analyticsData(analyticsId)}
      className={cx("np-incident-update", `np-incident-update--${status}`)}
    >
      <span aria-hidden="true" className="np-incident-update__marker">
        <Icon
          icon={
            status === "resolved"
              ? CheckCircle2
              : status === "monitoring"
                ? CircleDot
                : AlertTriangle
          }
          size="small"
        />
      </span>
      <div>
        <header>
          <strong>{status}</strong>
          <time dateTime={timestamp}>{timestampLabel}</time>
        </header>
        <div>{children}</div>
        {author ? <footer>Posted by {author}</footer> : null}
      </div>
    </article>
  );
}

export interface IncidentHistoryProps extends AnalyticsProps {
  readonly affected?: readonly string[];
  readonly id: string;
  readonly status: "identified" | "investigating" | "monitoring" | "resolved";
  readonly title: string;
  readonly updates: readonly Omit<IncidentUpdateProps, "analyticsId">[];
}

export function IncidentHistory({
  affected = [],
  analyticsId,
  id,
  status,
  title,
  updates,
}: IncidentHistoryProps) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-labelledby={`incident-${id}`}
      className="np-incident-history"
    >
      <header>
        <div>
          <span className="np-eyebrow">Incident {id}</span>
          <h2 id={`incident-${id}`}>{title}</h2>
          {affected.length > 0 ? <p>Affected: {affected.join(", ")}</p> : null}
        </div>
        <StatusIndicator label={status} tone={status === "resolved" ? "success" : "warning"} />
      </header>
      <div className="np-incident-history__timeline">
        {updates.map((update) => (
          <IncidentUpdate key={`${update.status}-${update.timestamp}`} {...update} />
        ))}
      </div>
    </section>
  );
}

export interface OperationsEmptyStateProps extends AnalyticsProps {
  readonly description: ReactNode;
  readonly title: string;
}

export function OperationsEmptyState({
  analyticsId,
  description,
  title,
}: OperationsEmptyStateProps) {
  return (
    <div {...analyticsData(analyticsId)}>
      <StatePanel title={title}>{description}</StatePanel>
    </div>
  );
}

export function ReliabilityCodeSample({
  children,
  label,
}: {
  readonly children: string;
  readonly label: string;
}) {
  return (
    <pre aria-label={label} className="np-reliability-code">
      <Icon icon={Code2} size="small" />
      <code>{children}</code>
    </pre>
  );
}
