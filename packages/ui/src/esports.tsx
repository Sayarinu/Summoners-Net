import { ChevronRight, Eye, EyeOff, ExternalLink, Gamepad2, Play, Radio } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { analyticsData, Avatar, cx, Icon } from "./internal.js";
import type { AnalyticsProps } from "./internal.js";
import { Button, LiveIndicator, StatusIndicator, TextLink } from "./primitives.js";
import { Switch } from "./forms.js";
import { RoleIcon } from "./catalog-icons.js";

export interface TeamIdentityProps {
  readonly detail?: string;
  readonly href?: string;
  readonly logo?: string;
  readonly name: string;
  readonly shortName: string;
  /** `display` is the page-heading size used on a team's own profile. */
  readonly size?: "compact" | "display" | "large" | "medium";
  readonly side?: "blue" | "red";
  readonly winner?: boolean;
}

export function TeamIdentity({
  detail,
  href,
  logo,
  name,
  shortName,
  size = "medium",
  side,
  winner = false,
}: TeamIdentityProps) {
  const content = (
    <>
      <Avatar
        alt={`${name} logo`}
        entityKind="team"
        fallback={shortName}
        size={size === "large" || size === "display" ? "large" : "small"}
        src={logo}
      />
      <span className="np-identity__copy">
        <strong>{name}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
      {side ? <span className="np-visually-hidden">{side} side</span> : null}
      {winner ? <span className="np-identity__winner">Winner</span> : null}
    </>
  );

  return href ? (
    <a className={cx("np-identity", `np-identity--${size}`)} data-side={side} href={href}>
      {content}
    </a>
  ) : (
    <div className={cx("np-identity", `np-identity--${size}`)} data-side={side}>
      {content}
    </div>
  );
}

/** Two teams side by side, each edged in its side's color, reading outward from "vs". */
export function TeamVersus({
  teams,
}: {
  readonly teams: readonly [TeamIdentityProps, TeamIdentityProps];
}) {
  return (
    <div className="np-team-versus">
      <TeamIdentity {...teams[0]} />
      <span className="np-team-versus__sep">vs</span>
      <TeamIdentity {...teams[1]} />
    </div>
  );
}

export interface PlayerIdentityProps {
  readonly country?: string;
  readonly fullName?: string;
  readonly handle: string;
  readonly href?: string;
  /** `stacked` puts the portrait above the handle and role, as a roster tile. */
  readonly layout?: "inline" | "stacked";
  readonly portrait?: string;
  readonly role?: string | null | undefined;
}

export function PlayerIdentity({
  country,
  fullName,
  handle,
  href,
  layout = "inline",
  portrait,
  role,
}: PlayerIdentityProps) {
  const detail = [fullName, country].filter(Boolean).join(" · ");
  const content = (
    <>
      <Avatar
        alt={`${handle} portrait`}
        entityKind="player"
        fallback={handle}
        size="medium"
        src={portrait}
      />
      <span className="np-identity__copy">
        <strong>{handle}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
      {role ? <RoleIcon role={role} /> : null}
    </>
  );

  const className = cx(
    "np-identity",
    "np-identity--player",
    layout === "stacked" && "np-identity--stacked",
  );
  return href ? (
    <a className={className} href={href}>
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

export type MatchLifecycle =
  | "abandoned"
  | "cancelled"
  | "delayed"
  | "final"
  | "forfeit"
  | "live"
  | "postponed"
  | "scheduled"
  | "unknown";

export interface MatchTeam {
  readonly logo?: string;
  readonly name: string;
  readonly score?: number;
  readonly shortName: string;
  readonly winner?: boolean;
}

export interface MatchDisplay {
  readonly bestOf: 1 | 2 | 3 | 5;
  readonly classification?: "official" | "showmatch";
  readonly competition: string;
  readonly href: string;
  readonly id: string;
  readonly lifecycle: MatchLifecycle;
  readonly region?: string;
  readonly scheduledLabel: string;
  readonly sourceFreshness?: "delayed" | "fresh" | "stale" | "unknown";
  readonly stage?: string;
  readonly streamAvailable?: boolean;
  readonly streamHref?: string;
  readonly teams: readonly [MatchTeam, MatchTeam];
  readonly tier?: 1 | 2 | 3;
  readonly timeConfirmed?: boolean;
}

export function MatchLifecycleLabel({ lifecycle }: { readonly lifecycle: MatchLifecycle }) {
  if (lifecycle === "live") return <LiveIndicator />;
  const label =
    lifecycle === "final"
      ? "Final"
      : lifecycle === "forfeit"
        ? "Forfeit"
        : lifecycle === "delayed"
          ? "Delayed"
          : lifecycle === "abandoned"
            ? "Abandoned"
            : lifecycle === "unknown"
              ? "Status unknown"
              : lifecycle === "postponed"
                ? "Postponed"
                : lifecycle === "cancelled"
                  ? "Cancelled"
                  : "Scheduled";
  const tone =
    lifecycle === "final" || lifecycle === "forfeit"
      ? "neutral"
      : lifecycle === "scheduled"
        ? "info"
        : "warning";
  return <StatusIndicator label={label} tone={tone} />;
}

function MatchTeams({
  compact = false,
  hideScores = false,
  match,
}: {
  readonly compact?: boolean;
  readonly hideScores?: boolean;
  readonly match: MatchDisplay;
}) {
  return (
    <div className={cx("np-match-teams", compact && "np-match-teams--compact")}>
      {match.teams.map((team, teamIndex) => {
        const tbd = team.name === "TBD";
        const opponent = match.teams[1 - teamIndex];
        const result =
          match.lifecycle === "final" && team.score !== undefined && opponent?.score !== undefined
            ? team.score > opponent.score
              ? "win"
              : team.score < opponent.score
                ? "loss"
                : undefined
            : undefined;
        return (
          <Fragment key={`${match.id}-team-${teamIndex}`}>
            <div
              className={cx(
                "np-match-team",
                tbd && "np-match-team--tbd",
                team.winner && "np-match-team--winner",
              )}
            >
              {tbd ? (
                <span aria-hidden="true" className="np-match-team__icon-placeholder" />
              ) : (
                <Avatar
                  alt={`${team.name} logo`}
                  entityKind="team"
                  fallback={team.shortName}
                  size="small"
                  src={team.logo}
                />
              )}
              <span className="np-match-team__name">{compact ? team.shortName : team.name}</span>
              {!hideScores && team.score !== undefined ? (
                <strong className="np-score" data-result={result}>
                  {team.score}
                </strong>
              ) : null}
            </div>
            {teamIndex === 0 ? (
              <span aria-hidden="true" className="np-match-vs">
                {!hideScores && match.teams.every((entry) => entry.score !== undefined)
                  ? " – "
                  : "vs"}
              </span>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}

export interface MatchRowProps extends AnalyticsProps {
  readonly statusLabel?: ReactNode;
  readonly actions?: ReactNode;
  readonly expandedContent?: ReactNode;
  readonly match: MatchDisplay;
  readonly onSpoilerReveal?: () => void;
  readonly spoilerHidden?: boolean;
  readonly streamAction?: ReactNode;
}

export function MatchRow({
  statusLabel,
  analyticsId,
  actions,
  expandedContent,
  match,
  onSpoilerReveal,
  spoilerHidden = false,
  streamAction,
}: MatchRowProps) {
  const hasActions = Boolean(match.streamAvailable || actions || streamAction);
  const [first, second] = match.teams;
  const score =
    first.score === undefined || second.score === undefined
      ? ""
      : `, ${first.score} to ${second.score}`;
  return (
    <article
      {...analyticsData(analyticsId)}
      className={cx(
        "np-match-row",
        `np-match-row--${match.lifecycle}`,
        !hasActions && "np-match-row--no-actions",
      )}
    >
      <div className="np-match-row__time">
        {statusLabel ?? <MatchLifecycleLabel lifecycle={match.lifecycle} />}
        <span>{match.scheduledLabel}</span>
      </div>
      {spoilerHidden && (match.lifecycle === "final" || match.lifecycle === "forfeit") ? (
        <button
          aria-label={`Reveal score for ${match.teams[0].name} versus ${match.teams[1].name}`}
          className="np-match-row__primary np-match-row__spoiler"
          onClick={onSpoilerReveal}
          type="button"
        >
          <Icon icon={EyeOff} size="small" />
          <span>Result Hidden</span>
        </button>
      ) : (
        <a
          aria-label={`${match.teams[0].name} versus ${match.teams[1].name}, ${match.scheduledLabel}${score}`}
          className="np-match-row__primary"
          href={match.href}
        >
          <MatchTeams match={match} />
        </a>
      )}
      <div className="np-match-row__meta">
        <span>{match.region ?? match.competition}</span>
        <span>BO{match.bestOf}</span>
      </div>
      {hasActions ? (
        <div className="np-row-actions">
          {streamAction ??
            (match.streamAvailable ? (
              <a
                aria-label={`Watch live: ${match.teams[0].name} versus ${match.teams[1].name}`}
                className="np-button np-button--ghost np-control--compact"
                href={match.streamHref ?? match.href}
                rel="noreferrer"
                target="_blank"
              >
                <Icon icon={Play} size="small" />
                <span>Watch Live</span>
              </a>
            ) : null)}
          {actions}
        </div>
      ) : null}
      {expandedContent ? <div className="np-match-row__expanded">{expandedContent}</div> : null}
    </article>
  );
}

export type SearchEntityType = "champion" | "event" | "match" | "player" | "summoner" | "team";

export interface SearchResultProps {
  readonly description?: string;
  readonly href: string;
  readonly image?: string;
  readonly meta?: ReactNode;
  readonly name: string;
  readonly shortName: string;
  readonly type: SearchEntityType;
  readonly showType?: boolean;
}

export function SearchResult({
  description,
  href,
  image,
  meta,
  name,
  shortName,
  showType = true,
  type,
}: SearchResultProps) {
  return (
    <article className="np-search-result">
      <a href={href}>
        <Avatar
          alt={`${name} image`}
          entityKind={type === "team" || type === "player" ? type : undefined}
          fallback={shortName}
          size="medium"
          src={image}
        />
        <span className="np-search-result__copy">
          {showType ? <span className="np-eyebrow">{type}</span> : null}
          <strong>{name}</strong>
          {description ? <small>{description}</small> : null}
        </span>
        {meta ? <span className="np-search-result__meta">{meta}</span> : null}
        <Icon icon={ChevronRight} size="small" />
      </a>
    </article>
  );
}

export interface StreamConsentProps {
  readonly media?: "stream" | "VOD";
  readonly onAccept: () => void;
  readonly onDecline?: () => void;
  readonly privacyHref?: string;
  readonly provider: string;
}

export function StreamConsent({
  media = "stream",
  onAccept,
  onDecline,
  privacyHref,
  provider,
}: StreamConsentProps) {
  return (
    <section className="np-stream-consent">
      <Icon icon={Play} size="large" />
      <div>
        <span className="np-eyebrow">Third-party {media}</span>
        <h3>
          Load {provider} {media === "VOD" ? "VOD" : "stream"}?
        </h3>
        <p>
          Loading this {media} may allow {provider} to set cookies and receive your IP address.
          Nothing is requested until you consent.
        </p>
        {privacyHref ? (
          <TextLink href={privacyHref} target="_blank" variant="accent">
            Privacy details <Icon icon={ExternalLink} size="small" />
          </TextLink>
        ) : null}
      </div>
      <div className="np-stream-consent__actions">
        <Button onPress={onAccept} startIcon={<Icon icon={Play} size="small" />} variant="primary">
          Load {media === "VOD" ? "VOD" : "Stream"}
        </Button>
        {onDecline ? (
          <Button onPress={onDecline} variant="ghost">
            Not Now
          </Button>
        ) : null}
      </div>
    </section>
  );
}

export interface StreamEmbedShellProps {
  readonly children?: ReactNode;
  /** A tighter header for a player beside other content; a ready player shows no status. */
  readonly compact?: boolean;
  readonly fallbackHref?: string;
  readonly mode?: "live" | "replay";
  readonly onRetry?: () => void;
  readonly provider: string;
  readonly state?: "blocked" | "failed" | "loading" | "offline" | "ready";
  readonly title: string;
}

export function StreamEmbedShell({
  children,
  compact = false,
  fallbackHref,
  mode = "live",
  onRetry,
  provider,
  state = "ready",
  title,
}: StreamEmbedShellProps) {
  return (
    <section
      aria-busy={state === "loading"}
      aria-label={title}
      className={cx(
        "np-stream-shell",
        `np-stream-shell--${state}`,
        compact && "np-stream-shell--compact",
      )}
    >
      <header>
        <div>
          <span>{provider}</span>
        </div>
        <div>
          {state === "ready" ? (
            compact ? null : mode === "live" ? (
              <LiveIndicator />
            ) : (
              <StatusIndicator label="Replay" tone="info" />
            )
          ) : (
            <StatusIndicator label={state} tone={state === "failed" ? "danger" : "neutral"} />
          )}
          {fallbackHref && state === "ready" ? (
            <TextLink href={fallbackHref} rel="noreferrer" target="_blank" variant="muted">
              Open on {provider} <Icon icon={ExternalLink} size="small" />
            </TextLink>
          ) : null}
        </div>
      </header>
      <div className="np-stream-shell__viewport">
        {children}
        {state === "ready" ? null : (
          <div className="np-stream-shell__state">
            <Icon icon={state === "offline" ? Radio : Gamepad2} size="large" />
            <h3>
              {state === "loading"
                ? "Loading stream"
                : state === "offline"
                  ? "Stream is offline"
                  : "Stream unavailable"}
            </h3>
            <p>
              {state === "blocked"
                ? "Your browser or network blocked the embedded player."
                : "Use the fallback link or try again."}
            </p>
            <div>
              {onRetry ? <Button onPress={onRetry}>Retry</Button> : null}
              {fallbackHref ? (
                <TextLink href={fallbackHref} target="_blank" variant="accent">
                  Open on {provider} <Icon icon={ExternalLink} size="small" />
                </TextLink>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export interface SpoilerControlProps {
  readonly hidden: boolean;
  readonly onHiddenChange: (hidden: boolean) => void;
  readonly onReveal?: () => void;
}

export function SpoilerControl({ hidden, onHiddenChange, onReveal }: SpoilerControlProps) {
  return (
    <div className="np-spoiler-control">
      <Switch onChange={onHiddenChange} selected={hidden}>
        Hide Results
      </Switch>
      {hidden && onReveal ? (
        <Button
          onPress={onReveal}
          size="compact"
          startIcon={<Icon icon={Eye} size="small" />}
          variant="ghost"
        >
          Show Once
        </Button>
      ) : null}
    </div>
  );
}
