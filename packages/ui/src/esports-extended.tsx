"use client";

import {
  CalendarRange,
  ChevronRight,
  Clock3,
  ExternalLink,
  EyeOff,
  Globe2,
  History,
  Pause,
  Play,
  Radio,
  RefreshCw,
  ShieldAlert,
  Users,
  WifiOff,
} from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";

import { EmptyState, Skeleton, StatePanel, Table } from "./data-display.js";
import type { TableColumn } from "./data-display.js";
import type {
  MatchLifecycle,
  MatchTeam,
  PlayerIdentityProps,
  SearchEntityType,
  TeamIdentityProps,
} from "./esports.js";
import { PlayerIdentity, SearchResult, TeamIdentity } from "./esports.js";
import { SearchInput, Select } from "./forms.js";
import { analyticsData, Avatar, cx, Icon } from "./internal.js";
import type { AnalyticsProps } from "./internal.js";
import {
  Button,
  Callout,
  LiveIndicator,
  MetaText,
  StatusIndicator,
  TextLink,
} from "./primitives.js";

export interface ScheduleToolbarProps extends AnalyticsProps {
  readonly filters?: ReactNode;
  readonly onQueryChange?: (value: string) => void;
  readonly onTimezoneChange?: (value: string) => void;
  readonly onViewChange?: (view: "calendar" | "list") => void;
  readonly query?: string;
  readonly timezones: readonly { readonly label: string; readonly value: string }[];
  readonly timezone: string;
  readonly view: "calendar" | "list";
}

export function ScheduleToolbar({
  analyticsId,
  filters,
  onQueryChange,
  onTimezoneChange,
  onViewChange,
  query = "",
  timezones,
  timezone,
  view,
}: ScheduleToolbarProps) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-label="Schedule controls"
      className="np-schedule-toolbar"
    >
      <SearchInput
        aria-label="Search scheduled matches"
        label="Search schedule"
        onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange?.(event.target.value)}
        placeholder="Team, competition, or event"
        value={query}
      />
      <Select
        label="Timezone"
        {...(onTimezoneChange ? { onValueChange: onTimezoneChange } : {})}
        options={timezones}
        value={timezone}
      />
      <div aria-label="Schedule view" className="np-view-switch" role="group">
        {(["list", "calendar"] as const).map((option) => (
          <button
            aria-pressed={view === option}
            className="np-view-switch__item"
            disabled={!onViewChange}
            key={option}
            onClick={() => onViewChange?.(option)}
            type="button"
          >
            {option === "list" ? "List" : "Calendar"}
          </button>
        ))}
      </div>
      {filters ? <div className="np-schedule-toolbar__filters">{filters}</div> : null}
    </section>
  );
}

export interface ScheduleCalendarDay {
  readonly date: string;
  readonly disabled?: boolean;
  readonly label: string;
  readonly liveCount?: number;
  readonly matchCount?: number;
  readonly outsideRange?: boolean;
  readonly today?: boolean;
}

export interface ScheduleCalendarProps extends AnalyticsProps {
  readonly days: readonly ScheduleCalendarDay[];
  readonly label: string;
  readonly onSelect?: (date: string) => void;
  readonly selectedDate?: string;
}

export function ScheduleCalendar({
  analyticsId,
  days,
  label,
  onSelect,
  selectedDate,
}: ScheduleCalendarProps) {
  return (
    <section {...analyticsData(analyticsId)} aria-label={label} className="np-schedule-calendar">
      <div aria-hidden="true" className="np-schedule-calendar__weekdays">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <ol className="np-schedule-calendar__grid">
        {days.map((day) => {
          const content = (
            <>
              <time dateTime={day.date}>{day.label}</time>
              <span className="np-schedule-calendar__signals">
                {day.liveCount ? <MetaText tone="live">{day.liveCount} live</MetaText> : null}
                {day.matchCount !== undefined ? <small>{day.matchCount} matches</small> : null}
              </span>
              {day.today ? <span className="np-visually-hidden">Today</span> : null}
            </>
          );

          return (
            <li key={day.date}>
              {onSelect ? (
                <button
                  aria-current={day.today ? "date" : undefined}
                  aria-pressed={selectedDate === day.date}
                  className={cx("np-schedule-calendar__day", day.outsideRange && "is-outside")}
                  disabled={day.disabled}
                  onClick={() => onSelect(day.date)}
                  type="button"
                >
                  {content}
                </button>
              ) : (
                <article
                  aria-current={day.today ? "date" : undefined}
                  className={cx("np-schedule-calendar__day", day.outsideRange && "is-outside")}
                >
                  {content}
                </article>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export interface MatchHeaderProps extends AnalyticsProps {
  readonly actions?: ReactNode;
  readonly classification?: "official" | "showmatch";
  readonly gameLabel?: string;
  readonly lifecycle: MatchLifecycle;
  readonly onSpoilerReveal?: () => void;
  readonly spoilerHidden?: boolean;
  readonly teams: readonly [MatchTeam, MatchTeam];
  readonly title: string;
}

function ExtendedLifecycle({ lifecycle }: { readonly lifecycle: MatchLifecycle }) {
  if (lifecycle === "live") return <LiveIndicator />;
  const labels: Record<Exclude<MatchLifecycle, "live">, string> = {
    abandoned: "Abandoned",
    cancelled: "Cancelled",
    delayed: "Delayed",
    final: "Final",
    forfeit: "Forfeit",
    postponed: "Postponed",
    scheduled: "Scheduled",
    unknown: "Status unknown",
  };
  return (
    <StatusIndicator
      label={labels[lifecycle]}
      tone={lifecycle === "scheduled" ? "info" : lifecycle === "final" ? "neutral" : "warning"}
    />
  );
}

export function MatchHeader({
  actions,
  analyticsId,
  classification = "official",
  gameLabel,
  lifecycle,
  onSpoilerReveal,
  spoilerHidden = false,
  teams,
  title,
}: MatchHeaderProps) {
  return (
    <header {...analyticsData(analyticsId)} className="np-match-header">
      <div className="np-match-header__context">
        <span className="np-eyebrow">
          {classification === "showmatch" ? "Showmatch" : "Official match"}
        </span>
        <h1>{title}</h1>
        <span className="np-match-header__state">
          <ExtendedLifecycle lifecycle={lifecycle} />
          {gameLabel ? <span className="np-meta">{gameLabel}</span> : null}
        </span>
      </div>
      <div className="np-match-header__teams">
        {teams.map((team, teamIndex) => (
          <div
            className={cx("np-match-header__team", team.winner && "is-winner")}
            key={`match-header-team-${teamIndex}`}
          >
            <Avatar
              alt={`${team.name} logo`}
              entityKind="team"
              fallback={team.shortName}
              size="large"
              src={team.logo}
            />
            <strong>{team.name}</strong>
            {spoilerHidden && (lifecycle === "final" || lifecycle === "forfeit") ? (
              <button
                aria-label={`Reveal score for ${title}`}
                className="np-match-header__score np-match-header__score--hidden"
                onClick={onSpoilerReveal}
                type="button"
              >
                <Icon icon={EyeOff} size="small" /> Hidden
              </button>
            ) : (
              <span className="np-match-header__score">{team.score ?? "—"}</span>
            )}
          </div>
        ))}
      </div>
      {actions ? <div className="np-match-header__actions">{actions}</div> : null}
    </header>
  );
}

export interface MatchMetadataItem {
  readonly label: string;
  readonly source?: string;
  readonly value: ReactNode;
}

export function MatchMetadata({
  analyticsId,
  items,
  label = "Match details",
}: AnalyticsProps & { readonly items: readonly MatchMetadataItem[]; readonly label?: string }) {
  return (
    <section {...analyticsData(analyticsId)} aria-label={label} className="np-match-metadata">
      <dl>
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
            {item.source ? <small>Source: {item.source}</small> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

export interface SeriesGame {
  readonly id: string;
  readonly label: string;
  readonly score?: string;
  readonly state: "available" | "live" | "scheduled" | "unavailable";
  readonly winner?: string;
}

export interface GameSelectorProps extends AnalyticsProps {
  readonly games: readonly SeriesGame[];
  readonly label?: string;
  readonly onSelect?: (id: string) => void;
  readonly selectedId?: string;
}

export function GameSelector({
  analyticsId,
  games,
  label = "Series games",
  onSelect,
  selectedId,
}: GameSelectorProps) {
  return (
    <div
      {...analyticsData(analyticsId)}
      aria-label={label}
      className="np-game-selector"
      role="group"
    >
      {games.map((game) => (
        <button
          aria-pressed={game.id === selectedId}
          className="np-game-selector__item"
          disabled={!onSelect || game.state === "unavailable"}
          key={game.id}
          onClick={() => onSelect?.(game.id)}
          type="button"
        >
          <span>{game.label}</span>
          {game.state === "live" ? <LiveIndicator label="Live" /> : null}
          {game.score ? <strong>{game.score}</strong> : null}
          {game.winner ? <small>{game.winner}</small> : null}
        </button>
      ))}
    </div>
  );
}

export function SeriesScore(props: GameSelectorProps) {
  return <GameSelector {...props} label={props.label ?? "Series score"} />;
}

export interface MatchFact {
  readonly detail?: string;
  readonly label: string;
  readonly value: ReactNode;
}

export function MatchFacts({
  analyticsId,
  facts,
}: AnalyticsProps & { readonly facts: readonly MatchFact[] }) {
  return (
    <dl {...analyticsData(analyticsId)} className="np-match-facts">
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
          {fact.detail ? <small>{fact.detail}</small> : null}
        </div>
      ))}
    </dl>
  );
}

export interface MatchSourceStatusProps extends AnalyticsProps {
  readonly href?: string;
  readonly lastUpdated?: string;
  readonly onRefresh?: () => void;
  readonly provider?: string;
  readonly state: "conflict" | "delayed" | "fresh" | "stale" | "unavailable" | "unknown";
}

export function MatchSourceStatus({
  analyticsId,
  href,
  lastUpdated,
  onRefresh,
  provider,
  state,
}: MatchSourceStatusProps) {
  const copy = {
    conflict: ["Sources conflict", "This match is held until an authoritative value is confirmed."],
    delayed: [
      "Update delayed",
      "The source is responding, but this match is behind the freshness target.",
    ],
    fresh: ["Source current", "The match record is within its freshness target."],
    stale: ["Data may be stale", "The latest successful update is outside the freshness target."],
    unavailable: ["Source unavailable", "The provider cannot currently supply this match record."],
    unknown: ["Freshness unknown", "No successful source update has been recorded yet."],
  } as const;
  const [title, description] = copy[state];
  const tone =
    state === "fresh"
      ? "success"
      : state === "unavailable" || state === "conflict"
        ? "danger"
        : "warning";

  return (
    <div {...analyticsData(analyticsId)}>
      <Callout
        actions={
          <span className="np-inline-actions">
            {onRefresh ? (
              <Button
                onPress={onRefresh}
                size="compact"
                startIcon={<Icon icon={RefreshCw} size="small" />}
              >
                Refresh
              </Button>
            ) : null}
            {href ? (
              <TextLink href={href}>
                Official source <Icon icon={ExternalLink} size="small" />
              </TextLink>
            ) : null}
          </span>
        }
        title={title}
        tone={tone}
      >
        <p>{description}</p>
        {provider || lastUpdated ? (
          <small>{[provider, lastUpdated].filter(Boolean).join(" · ")}</small>
        ) : null}
      </Callout>
    </div>
  );
}

interface ProfileHeaderBaseProps extends AnalyticsProps {
  readonly actions?: ReactNode;
  readonly affiliations?: ReactNode;
  readonly image?: string;
  readonly meta?: readonly string[];
  readonly name: string;
  readonly shortName: string;
  readonly status?: ReactNode;
}

function ProfileHeader({
  actions,
  affiliations,
  analyticsId,
  image,
  entityKind,
  meta = [],
  name,
  shortName,
  status,
}: ProfileHeaderBaseProps & { readonly entityKind: "team" | "player" }) {
  return (
    <header {...analyticsData(analyticsId)} className="np-profile-header">
      <Avatar
        alt={`${name} image`}
        entityKind={entityKind}
        fallback={shortName}
        size="large"
        src={image}
      />
      <div className="np-profile-header__copy">
        <h1>{name}</h1>
        {meta.length ? <p>{meta.join(" · ")}</p> : null}
        {affiliations ? (
          <div className="np-profile-header__affiliations">{affiliations}</div>
        ) : null}
      </div>
      {status ? <div className="np-profile-header__status">{status}</div> : null}
      {actions ? <div className="np-profile-header__actions">{actions}</div> : null}
    </header>
  );
}

export type TeamProfileHeaderProps = ProfileHeaderBaseProps;
export function TeamProfileHeader(props: TeamProfileHeaderProps) {
  return <ProfileHeader {...props} entityKind="team" />;
}

export type PlayerProfileHeaderProps = ProfileHeaderBaseProps;
export function PlayerProfileHeader(props: PlayerProfileHeaderProps) {
  return <ProfileHeader {...props} entityKind="player" />;
}

export interface TeamCardProps extends AnalyticsProps {
  readonly actions?: ReactNode;
  readonly detail?: string;
  readonly href: string;
  readonly statistics?: readonly { readonly label: string; readonly value: string }[];
  readonly team: Omit<TeamIdentityProps, "href">;
}

export function TeamCard({
  actions,
  analyticsId,
  detail,
  href,
  statistics = [],
  team,
}: TeamCardProps) {
  return (
    <article {...analyticsData(analyticsId)} className="np-entity-card">
      <a aria-label={`Open ${team.name}`} className="np-entity-card__primary" href={href}>
        <TeamIdentity {...team} />
        <Icon icon={ChevronRight} size="small" />
      </a>
      {detail ? <p>{detail}</p> : null}
      {statistics.length ? (
        <dl>
          {statistics.map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {actions ? <div className="np-row-actions">{actions}</div> : null}
    </article>
  );
}

export interface PlayerCardProps extends AnalyticsProps {
  readonly actions?: ReactNode;
  readonly href: string;
  readonly player: Omit<PlayerIdentityProps, "href">;
  readonly statistics?: readonly { readonly label: string; readonly value: string }[];
  readonly team?: string;
}

export function PlayerCard({
  actions,
  analyticsId,
  href,
  player,
  statistics = [],
  team,
}: PlayerCardProps) {
  return (
    <article {...analyticsData(analyticsId)} className="np-entity-card">
      <a aria-label={`Open ${player.handle}`} className="np-entity-card__primary" href={href}>
        <PlayerIdentity {...player} />
        <Icon icon={ChevronRight} size="small" />
      </a>
      {team ? <p>Current team: {team}</p> : null}
      {statistics.length ? (
        <dl>
          {statistics.map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {actions ? <div className="np-row-actions">{actions}</div> : null}
    </article>
  );
}

export interface DirectoryListProps extends AnalyticsProps {
  readonly children?: ReactNode;
  readonly count?: number;
  readonly emptyAction?: ReactNode;
  readonly label: string;
  readonly state?: "empty" | "loading" | "partial" | "ready";
}

export function DirectoryList({
  analyticsId,
  children,
  count,
  emptyAction,
  label,
  state = "ready",
}: DirectoryListProps) {
  return (
    <section {...analyticsData(analyticsId)} aria-label={label} className="np-directory-list">
      <header>
        <h2>{label}</h2>
        {count !== undefined ? <span className="np-mono">{count} results</span> : null}
      </header>
      {state === "loading" ? (
        <div aria-label="Loading directory">
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </div>
      ) : null}
      {state === "empty" ? (
        <EmptyState
          action={emptyAction}
          description="Try removing filters or searching for another team or player."
          title="No results"
        />
      ) : null}
      {state !== "loading" && state !== "empty" ? (
        <div className="np-directory-list__items">{children}</div>
      ) : null}
    </section>
  );
}

export interface SearchResultItem {
  readonly description?: string;
  readonly href: string;
  readonly image?: string;
  readonly meta?: string;
  readonly name: string;
  readonly shortName: string;
  readonly type: SearchEntityType;
}

export interface SearchResultGroup {
  readonly id: string;
  readonly label: string;
  readonly results: readonly SearchResultItem[];
}

export function GroupedSearchResults({
  analyticsId,
  groups,
}: AnalyticsProps & { readonly groups: readonly SearchResultGroup[] }) {
  return (
    <div {...analyticsData(analyticsId)} className="np-search-groups">
      {groups.map((group) => (
        <section aria-labelledby={`search-group-${group.id}`} key={group.id}>
          <h2 id={`search-group-${group.id}`}>{group.label}</h2>
          <div className="np-review__frame">
            {group.results.map((result) => (
              <SearchResult {...result} key={`${result.type}-${result.name}`} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export interface SearchAutocompleteProps extends AnalyticsProps {
  readonly children?: ReactNode;
  readonly onQueryChange?: (value: string) => void;
  readonly query: string;
  readonly recent?: readonly string[];
  readonly state?: "idle" | "loading" | "no-results" | "partial" | "results";
}

export function SearchAutocomplete({
  analyticsId,
  children,
  onQueryChange,
  query,
  recent = [],
  state = "idle",
}: SearchAutocompleteProps) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-label="Search directory"
      className="np-search-autocomplete"
    >
      <SearchInput
        label="Search teams, players, events, and matches"
        onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange?.(event.target.value)}
        placeholder="Search Nexus Pulse"
        value={query}
      />
      <div aria-live="polite" className="np-search-autocomplete__results">
        {state === "loading" ? (
          <>
            <Skeleton height={48} />
            <Skeleton height={48} />
          </>
        ) : null}
        {state === "no-results" ? (
          <EmptyState
            description="Check the spelling or search for another entity."
            title="No results"
          />
        ) : null}
        {state === "idle" && recent.length ? (
          <div>
            <span className="np-eyebrow">Recent searches</span>
            <ul>
              {recent.map((item) => (
                <li key={item}>
                  <Icon icon={History} size="small" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {state === "results" || state === "partial" ? children : null}
      </div>
    </section>
  );
}

export interface Affiliation {
  readonly current?: boolean;
  readonly dates?: ReactNode;
  readonly end?: string;
  readonly href?: string;
  readonly name: string;
  readonly shortName: string;
  readonly start: string;
}

export function AffiliationTimeline({
  affiliations,
  analyticsId,
  label = "Team history",
}: AnalyticsProps & { readonly affiliations: readonly Affiliation[]; readonly label?: string }) {
  return (
    <section {...analyticsData(analyticsId)} aria-label={label} className="np-affiliation-timeline">
      <h2>{label}</h2>
      <ol>
        {affiliations.map((affiliation) => {
          const content = (
            <>
              <Avatar
                alt={`${affiliation.name} logo`}
                entityKind="team"
                fallback={affiliation.shortName}
                size="small"
              />
              <div>
                <strong>{affiliation.name}</strong>
                <span>
                  {affiliation.dates ?? (
                    <>
                      {affiliation.start} —{" "}
                      {affiliation.current ? "Present" : (affiliation.end ?? "Unknown")}
                    </>
                  )}
                </span>
              </div>
              {affiliation.current ? <StatusIndicator label="Current" tone="success" /> : null}
              {affiliation.href ? <Icon icon={ChevronRight} size="small" /> : null}
            </>
          );
          return (
            <li key={`${affiliation.name}-${affiliation.start}`}>
              {affiliation.href ? (
                <a
                  aria-label={`Open ${affiliation.name}`}
                  className="np-history-row np-history-row--link"
                  href={affiliation.href}
                >
                  {content}
                </a>
              ) : (
                <div className="np-history-row">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export interface HandleHistoryItem {
  readonly current?: boolean;
  readonly dates: ReactNode;
  readonly handle: string;
  readonly href?: string;
  readonly shortName: string;
}

export function HandleTimeline({
  analyticsId,
  handles,
  label = "Handle History",
}: AnalyticsProps & {
  readonly handles: readonly HandleHistoryItem[];
  readonly label?: string;
}) {
  return (
    <section {...analyticsData(analyticsId)} aria-label={label} className="np-handle-timeline">
      <h2>{label}</h2>
      <ol>
        {handles.map((item) => {
          const content = (
            <>
              <Avatar
                alt={`${item.handle} identity`}
                entityKind="player"
                fallback={item.shortName}
                size="small"
              />
              <div>
                <strong>{item.handle}</strong>
                <span>{item.dates}</span>
              </div>
              {item.current ? <StatusIndicator label="Current" tone="success" /> : null}
              {item.href ? <Icon icon={ChevronRight} size="small" /> : null}
            </>
          );
          return (
            <li key={item.handle}>
              {item.href ? (
                <a
                  aria-label={`Open ${item.handle}`}
                  className="np-history-row np-history-row--link"
                  href={item.href}
                >
                  {content}
                </a>
              ) : (
                <div className="np-history-row">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export interface PlayerStat {
  readonly detail?: string;
  readonly label: string;
  readonly rank?: string;
  readonly value: string;
}

export function PlayerStatSummary({
  analyticsId,
  stats,
}: AnalyticsProps & { readonly stats: readonly PlayerStat[] }) {
  return (
    <dl {...analyticsData(analyticsId)} className="np-player-stat-summary">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt>{stat.label}</dt>
          <dd>{stat.value}</dd>
          {stat.rank ? <MetaText tone="accent">{stat.rank}</MetaText> : null}
          {stat.detail ? <small>{stat.detail}</small> : null}
        </div>
      ))}
    </dl>
  );
}

export interface PlayerRankingRow {
  readonly id: string;
  readonly player: PlayerIdentityProps;
  readonly rank: number;
  readonly team?: string;
  readonly value: string;
}

export function PlayerRankingTable({
  analyticsId,
  caption,
  rows,
}: AnalyticsProps & { readonly caption: string; readonly rows: readonly PlayerRankingRow[] }) {
  const columns: readonly TableColumn<PlayerRankingRow>[] = [
    { header: "Rank", id: "rank", render: (row) => row.rank, width: "72px" },
    { header: "Player", id: "player", render: (row) => <PlayerIdentity {...row.player} /> },
    { header: "Team", id: "team", render: (row) => row.team ?? "Free agent" },
    { align: "end", header: "Value", id: "value", render: (row) => row.value, width: "120px" },
  ];
  return (
    <div {...analyticsData(analyticsId)}>
      <Table caption={caption} columns={columns} getRowKey={(row) => row.id} rows={rows} />
    </div>
  );
}

export interface LiveScoreboardTeam extends MatchTeam {
  readonly gold?: string;
  readonly kills?: number;
  readonly objectives?: number;
  readonly side?: "blue" | "red";
  readonly towers?: number;
}

export function LiveScoreboard({
  analyticsId,
  gameTime,
  status = "live",
  teams,
}: AnalyticsProps & {
  readonly gameTime: string;
  readonly status?: "complete" | "live" | "paused" | "stale";
  readonly teams: readonly [LiveScoreboardTeam, LiveScoreboardTeam];
}) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-label="Live scoreboard"
      className="np-live-scoreboard"
    >
      <header>
        {status === "live" ? (
          <LiveIndicator />
        ) : (
          <StatusIndicator
            label={status === "complete" ? "Complete" : status === "paused" ? "Paused" : "Stale"}
            tone={status === "complete" ? "neutral" : "warning"}
          />
        )}
        <time>{gameTime}</time>
      </header>
      {teams.map((team, teamIndex) => (
        <article
          className={cx("np-live-scoreboard__team", team.side && `is-${team.side}`)}
          key={`live-scoreboard-team-${teamIndex}`}
        >
          <TeamIdentity
            {...(team.logo ? { logo: team.logo } : {})}
            name={team.name}
            shortName={team.shortName}
            size="compact"
          />
          <strong className="np-live-scoreboard__score">{team.score ?? 0}</strong>
          <dl>
            <div>
              <dt>Gold</dt>
              <dd>{team.gold ?? "—"}</dd>
            </div>
            <div>
              <dt>Kills</dt>
              <dd>{team.kills ?? "—"}</dd>
            </div>
            <div>
              <dt>Towers</dt>
              <dd>{team.towers ?? "—"}</dd>
            </div>
            <div>
              <dt>Objectives</dt>
              <dd>{team.objectives ?? "—"}</dd>
            </div>
          </dl>
        </article>
      ))}
    </section>
  );
}

export interface PlayerLiveStatRow {
  readonly champion?: string;
  readonly cs?: number;
  readonly damage?: string;
  readonly gold?: string;
  readonly id: string;
  readonly kda?: string;
  readonly player: PlayerIdentityProps;
}

export function PlayerLiveStatTable({
  analyticsId,
  caption,
  rows,
}: AnalyticsProps & { readonly caption: string; readonly rows: readonly PlayerLiveStatRow[] }) {
  const columns: readonly TableColumn<PlayerLiveStatRow>[] = [
    { header: "Player", id: "player", render: (row) => <PlayerIdentity {...row.player} /> },
    { header: "Champion", id: "champion", render: (row) => row.champion ?? "Unknown" },
    { align: "end", header: "KDA", id: "kda", render: (row) => row.kda ?? "—" },
    { align: "end", header: "CS", id: "cs", render: (row) => row.cs ?? "—" },
    { align: "end", header: "Gold", id: "gold", render: (row) => row.gold ?? "—" },
    { align: "end", header: "Damage", id: "damage", render: (row) => row.damage ?? "—" },
  ];
  return (
    <div {...analyticsData(analyticsId)}>
      <Table caption={caption} columns={columns} getRowKey={(row) => row.id} rows={rows} />
    </div>
  );
}

export interface ObjectiveEvent {
  readonly id: string;
  readonly label: string;
  readonly team?: string;
  readonly time: string;
  readonly tone?: "danger" | "info" | "neutral" | "success" | "warning";
}

export function ObjectiveStrip({
  analyticsId,
  events,
}: AnalyticsProps & { readonly events: readonly ObjectiveEvent[] }) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-label="Objective timeline"
      className="np-objective-strip"
      tabIndex={0}
    >
      <ol>
        {events.map((event) => (
          <li key={event.id}>
            <time>{event.time}</time>
            <StatusIndicator label={event.label} tone={event.tone ?? "neutral"} />
            {event.team ? <span>{event.team}</span> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export interface SeriesTimelineGame {
  readonly duration?: string;
  readonly id: string;
  readonly label: string;
  readonly state: "final" | "live" | "scheduled" | "unavailable";
  readonly winner?: string;
}

export function SeriesTimeline({
  analyticsId,
  games,
}: AnalyticsProps & { readonly games: readonly SeriesTimelineGame[] }) {
  return (
    <ol
      {...analyticsData(analyticsId)}
      aria-label="Series timeline"
      className="np-series-timeline"
      tabIndex={0}
    >
      {games.map((game) => (
        <li className={`is-${game.state}`} key={game.id}>
          <span>{game.label}</span>
          {game.state === "live" ? (
            <LiveIndicator />
          ) : (
            <StatusIndicator
              label={game.state}
              tone={game.state === "scheduled" ? "info" : "neutral"}
            />
          )}
          {game.winner ? <strong>{game.winner}</strong> : null}
          {game.duration ? <time>{game.duration}</time> : null}
        </li>
      ))}
    </ol>
  );
}

export interface LiveDataGateProps extends AnalyticsProps {
  readonly children?: ReactNode;
  readonly onRetry?: () => void;
  readonly state: "delayed" | "disconnected" | "paused" | "ready" | "stale" | "unavailable";
}

export function LiveDataGate({ analyticsId, children, onRetry, state }: LiveDataGateProps) {
  if (state === "ready") return <div {...analyticsData(analyticsId)}>{children}</div>;
  const copy = {
    delayed: [
      Clock3,
      "Live data delayed",
      "The licensed feed is behind its expected freshness target.",
    ],
    disconnected: [
      WifiOff,
      "Live feed disconnected",
      "The provider connection was interrupted. Last confirmed values remain visible.",
    ],
    paused: [Pause, "Live feed paused", "The provider paused updates for this game."],
    stale: [
      ShieldAlert,
      "Live data may be stale",
      "The last update is outside the configured freshness target.",
    ],
    unavailable: [
      Radio,
      "Live data unavailable",
      "A licensed, fresh telemetry feed is not active for this match.",
    ],
  } as const;
  const [, title, description] = copy[state];
  return (
    <div {...analyticsData(analyticsId)}>
      <StatePanel
        action={
          onRetry ? (
            <Button onPress={onRetry} startIcon={<Icon icon={RefreshCw} size="small" />}>
              Retry
            </Button>
          ) : undefined
        }
        title={title}
        tone={state === "disconnected" || state === "unavailable" ? "danger" : "warning"}
      >
        {description}
      </StatePanel>
    </div>
  );
}

export interface EventStage {
  readonly count?: number;
  readonly disabled?: boolean;
  readonly id: string;
  readonly label: string;
  readonly status?: "complete" | "live" | "upcoming";
}

export function EventStageNavigation({
  activeId,
  analyticsId,
  onSelect,
  stages,
}: AnalyticsProps & {
  readonly activeId: string;
  readonly onSelect?: (id: string) => void;
  readonly stages: readonly EventStage[];
}) {
  return (
    <nav {...analyticsData(analyticsId)} aria-label="Event stages" className="np-event-stage-nav">
      <ol>
        {stages.map((stage) => (
          <li key={stage.id}>
            <button
              aria-current={stage.id === activeId ? "step" : undefined}
              disabled={stage.disabled || !onSelect}
              onClick={() => onSelect?.(stage.id)}
              type="button"
            >
              <span>{stage.label}</span>
              {stage.status === "live" ? (
                <LiveIndicator />
              ) : stage.status ? (
                <StatusIndicator
                  label={stage.status}
                  tone={stage.status === "upcoming" ? "info" : "neutral"}
                />
              ) : null}
              {stage.count !== undefined ? <MetaText>{stage.count}</MetaText> : null}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export interface GroupStandingRow {
  readonly differential?: number;
  readonly form?: readonly ("L" | "W")[];
  readonly id: string;
  readonly losses: number;
  readonly points?: number;
  readonly rank: number;
  readonly seed?: string;
  readonly team: TeamIdentityProps;
  readonly tiebreaker?: string;
  readonly wins: number;
}

export function GroupStandingsTable({
  analyticsId,
  caption,
  rows,
}: AnalyticsProps & { readonly caption: string; readonly rows: readonly GroupStandingRow[] }) {
  const columns: readonly TableColumn<GroupStandingRow>[] = [
    { header: "#", id: "rank", render: (row) => row.rank, width: "52px" },
    { header: "Team", id: "team", render: (row) => <TeamIdentity {...row.team} size="compact" /> },
    { align: "end", header: "W", id: "wins", render: (row) => row.wins, width: "52px" },
    { align: "end", header: "L", id: "losses", render: (row) => row.losses, width: "52px" },
    {
      align: "end",
      header: "+/−",
      id: "differential",
      render: (row) => row.differential ?? "—",
      width: "64px",
    },
    {
      header: "Form",
      id: "form",
      render: (row) =>
        row.form ? (
          <span className="np-form-sequence">
            {row.form.map((result, index) => (
              <MetaText key={`${result}-${index}`} tone={result === "W" ? "success" : "danger"}>
                {result}
              </MetaText>
            ))}
          </span>
        ) : (
          "—"
        ),
    },
    { header: "Tiebreak", id: "tiebreaker", render: (row) => row.tiebreaker ?? row.seed ?? "—" },
    {
      align: "end",
      header: "PTS",
      id: "points",
      render: (row) => row.points ?? "—",
      width: "64px",
    },
  ];
  return (
    <div {...analyticsData(analyticsId)}>
      <Table caption={caption} columns={columns} getRowKey={(row) => row.id} rows={rows} />
    </div>
  );
}

export interface TournamentBracketMatch {
  readonly bestOf?: 1 | 2 | 3 | 5;
  readonly date?: string;
  readonly id: string;
  readonly lifecycle: MatchLifecycle;
  readonly seed?: string;
  readonly teams: readonly [MatchTeam, MatchTeam];
}

export interface TournamentBracketLane {
  readonly id: string;
  readonly label: string;
  readonly rounds: readonly {
    readonly id: string;
    readonly label: string;
    readonly matches: readonly TournamentBracketMatch[];
  }[];
}

export function TournamentBracket({
  analyticsId,
  lanes,
  onMatchSelect,
  spoilerHidden = false,
  state = "ready",
  title,
}: AnalyticsProps & {
  readonly lanes: readonly TournamentBracketLane[];
  readonly onMatchSelect?: (id: string) => void;
  readonly spoilerHidden?: boolean;
  readonly state?: "empty" | "loading" | "ready" | "stale" | "unavailable";
  readonly title: string;
}) {
  if (state === "loading")
    return (
      <section {...analyticsData(analyticsId)} className="np-tournament-bracket">
        <Skeleton height={360} />
      </section>
    );
  if (state === "empty" || state === "unavailable")
    return (
      <StatePanel title={state === "empty" ? "Bracket pending" : "Bracket unavailable"}>
        {state === "empty"
          ? "The bracket has not been published yet."
          : "The provider does not expose a bracket for this event."}
      </StatePanel>
    );

  return (
    <section {...analyticsData(analyticsId)} aria-label={title} className="np-tournament-bracket">
      <header>
        <h2>{title}</h2>
        {state === "stale" ? <StatusIndicator label="Stale" tone="warning" /> : null}
      </header>
      <div className="np-tournament-bracket__lanes">
        {lanes.map((lane) => (
          <section
            aria-labelledby={`lane-${lane.id}`}
            className="np-tournament-bracket__lane"
            key={lane.id}
          >
            <h3 id={`lane-${lane.id}`}>{lane.label}</h3>
            <div className="np-tournament-bracket__rounds">
              {lane.rounds.map((round) => (
                <section key={round.id}>
                  <h4>{round.label}</h4>
                  <ol>
                    {round.matches.map((match) => (
                      <li key={match.id}>
                        {onMatchSelect ? (
                          <button
                            aria-label={`Open ${match.teams[0].name} versus ${match.teams[1].name}`}
                            className="np-tournament-bracket__match"
                            onClick={() => onMatchSelect(match.id)}
                            type="button"
                          >
                            <BracketMatchContent match={match} spoilerHidden={spoilerHidden} />
                          </button>
                        ) : (
                          <article className="np-tournament-bracket__match">
                            <BracketMatchContent match={match} spoilerHidden={spoilerHidden} />
                          </article>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function BracketMatchContent({
  match,
  spoilerHidden,
}: {
  readonly match: TournamentBracketMatch;
  readonly spoilerHidden: boolean;
}) {
  return (
    <>
      <span className="np-tournament-bracket__meta">
        <ExtendedLifecycle lifecycle={match.lifecycle} />
        {match.date ? <time>{match.date}</time> : null}
        {match.bestOf ? <span>BO{match.bestOf}</span> : null}
        {match.seed ? <span>Seed {match.seed}</span> : null}
      </span>
      {match.teams.map((team, teamIndex) => (
        <span
          className={cx("np-tournament-bracket__team", team.winner && "is-winner")}
          key={`${match.id}-team-${teamIndex}`}
        >
          <Avatar
            alt={`${team.name} logo`}
            entityKind="team"
            fallback={team.shortName}
            size="small"
            src={team.logo}
          />
          <span>{team.shortName}</span>
          <strong>
            {spoilerHidden && match.lifecycle === "final" ? "—" : (team.score ?? "—")}
          </strong>
        </span>
      ))}
    </>
  );
}

export interface BroadcastOption {
  readonly id: string;
  readonly language: string;
  readonly label: string;
  readonly provider: string;
  readonly state?: "ended" | "live" | "replay" | "scheduled";
}

export function BroadcastSelector({
  analyticsId,
  broadcasts,
  onSelect,
  selectedId,
}: AnalyticsProps & {
  readonly broadcasts: readonly BroadcastOption[];
  readonly onSelect?: (id: string) => void;
  readonly selectedId?: string;
}) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-label="Official broadcasts"
      className="np-broadcast-selector"
    >
      <header>
        <span className="np-eyebrow">Official broadcasts</span>
        <Icon icon={Globe2} size="small" />
      </header>
      <div role="group">
        {broadcasts.map((broadcast) => (
          <button
            aria-pressed={broadcast.id === selectedId}
            disabled={!onSelect}
            key={broadcast.id}
            onClick={() => onSelect?.(broadcast.id)}
            type="button"
          >
            <span>
              <strong>{broadcast.label}</strong>
              <small>
                {broadcast.provider} · {broadcast.language}
              </small>
            </span>
            {broadcast.state === "live" ? (
              <LiveIndicator />
            ) : (
              <StatusIndicator
                label={broadcast.state ?? "scheduled"}
                tone={broadcast.state === "scheduled" ? "info" : "neutral"}
              />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

export interface StreamStatePanelProps extends AnalyticsProps {
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
  readonly provider: string;
  readonly rememberedConsent?: boolean;
  readonly state:
    "consent" | "ended" | "geo-blocked" | "live" | "offline" | "ready" | "replay" | "restricted";
}

export function StreamStatePanel({
  actions,
  analyticsId,
  children,
  provider,
  rememberedConsent = false,
  state,
}: StreamStatePanelProps) {
  if (state === "live" || state === "ready" || state === "replay") {
    return (
      <section
        {...analyticsData(analyticsId)}
        aria-label={`${provider} stream`}
        className="np-stream-state"
      >
        <header>
          <span>{provider}</span>
          {state === "live" ? (
            <LiveIndicator />
          ) : (
            <StatusIndicator label={state === "replay" ? "Replay" : "Ready"} tone="info" />
          )}
        </header>
        <div className="np-stream-state__viewport">{children}</div>
        {actions ? <footer>{actions}</footer> : null}
      </section>
    );
  }
  const copy = {
    consent: [
      Play,
      `Load ${provider}?`,
      rememberedConsent
        ? "Consent was previously remembered. Confirm before loading this third-party player."
        : "Loading this stream may allow third-party cookies and share your IP address.",
    ],
    ended: [
      Clock3,
      "Broadcast ended",
      "The official live broadcast has ended. A replay may become available later.",
    ],
    "geo-blocked": [
      Globe2,
      "Broadcast unavailable in your region",
      "The provider restricts this broadcast based on location.",
    ],
    offline: [
      WifiOff,
      "Broadcast offline",
      "The provider is not currently broadcasting this match.",
    ],
    restricted: [
      ShieldAlert,
      "Broadcast restricted",
      "Open the official provider to confirm eligibility and viewing requirements.",
    ],
  } as const;
  const [, title, description] = copy[state];
  return (
    <div {...analyticsData(analyticsId)}>
      <StatePanel
        action={actions}
        title={title}
        tone={state === "offline" || state === "restricted" ? "danger" : "neutral"}
      >
        {description}
      </StatePanel>
    </div>
  );
}

export function EsportsFeatureGate({
  analyticsId,
  children,
  enabled,
  feature,
}: AnalyticsProps & {
  readonly children?: ReactNode;
  readonly enabled: boolean;
  readonly feature: string;
}) {
  if (enabled) return <div {...analyticsData(analyticsId)}>{children}</div>;
  return (
    <StatePanel
      action={<TextLink href="/methodology">Read data methodology</TextLink>}
      title={`${feature} not active`}
    >
      {feature} appears only when a licensed source with sufficient freshness and coverage is
      active.
    </StatePanel>
  );
}

export function DirectoryIntroActions({ children }: { readonly children?: ReactNode }) {
  return (
    <div className="np-directory-intro-actions">
      <Icon icon={Users} />
      {children}
    </div>
  );
}

export function StreamPlayAction({
  href,
  label = "Open official stream",
}: {
  readonly href: string;
  readonly label?: string;
}) {
  return (
    <TextLink href={href} rel="noreferrer" target="_blank">
      <Icon icon={Play} size="small" />
      {label}
    </TextLink>
  );
}

export function ScheduleCalendarLegend() {
  return (
    <div aria-label="Schedule calendar legend" className="np-schedule-calendar__legend">
      <span>
        <span className="np-dot is-live" />
        Live
      </span>
      <span>
        <span className="np-dot is-scheduled" />
        Scheduled
      </span>
      <span>
        <CalendarRange aria-hidden="true" />
        Today
      </span>
    </div>
  );
}
