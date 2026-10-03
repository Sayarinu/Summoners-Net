import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ExternalLink,
  Filter,
  Gamepad2,
  Play,
  Radio,
  ShieldQuestion,
  Trophy,
} from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { Table } from "./data-display.js";
import type { TableColumn } from "./data-display.js";
import { analyticsData, Avatar, cx, Icon } from "./internal.js";
import type { AnalyticsProps } from "./internal.js";
import { Button, LiveIndicator, StatusIndicator, TextLink } from "./primitives.js";
import { Switch } from "./forms.js";

export interface CompetitionIdentityProps {
  readonly href?: string;
  readonly logo?: string;
  readonly name: string;
  readonly region?: string;
  readonly shortName: string;
  readonly tier?: string;
}

export function CompetitionIdentity({
  href,
  logo,
  name,
  region,
  shortName,
  tier,
}: CompetitionIdentityProps) {
  const content = (
    <>
      <Avatar alt={`${name} logo`} fallback={shortName} size="medium" src={logo} />
      <span className="np-identity__copy">
        <strong>{name}</strong>
        {region || tier ? <small>{[region, tier].filter(Boolean).join(" · ")}</small> : null}
      </span>
    </>
  );

  return href ? (
    <a className="np-identity np-identity--competition" href={href}>
      {content}
    </a>
  ) : (
    <div className="np-identity np-identity--competition">{content}</div>
  );
}

export interface TeamIdentityProps {
  readonly detail?: string;
  readonly href?: string;
  readonly logo?: string;
  readonly name: string;
  readonly shortName: string;
  readonly size?: "compact" | "large" | "medium";
  readonly winner?: boolean;
}

export function TeamIdentity({
  detail,
  href,
  logo,
  name,
  shortName,
  size = "medium",
  winner = false,
}: TeamIdentityProps) {
  const content = (
    <>
      <Avatar
        alt={`${name} logo`}
        entityKind="team"
        fallback={shortName}
        size={size === "large" ? "large" : "small"}
        src={logo}
      />
      <span className="np-identity__copy">
        <strong>{name}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
      {winner ? <span className="np-identity__winner">Winner</span> : null}
    </>
  );

  return href ? (
    <a className={cx("np-identity", `np-identity--${size}`)} href={href}>
      {content}
    </a>
  ) : (
    <div className={cx("np-identity", `np-identity--${size}`)}>{content}</div>
  );
}

export interface PlayerIdentityProps {
  readonly country?: string;
  readonly fullName?: string;
  readonly handle: string;
  readonly href?: string;
  readonly portrait?: string;
  readonly role?: string;
}

export function PlayerIdentity({
  country,
  fullName,
  handle,
  href,
  portrait,
  role,
}: PlayerIdentityProps) {
  const detail = [fullName, role, country].filter(Boolean).join(" · ");
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
    </>
  );

  return href ? (
    <a className="np-identity np-identity--player" href={href}>
      {content}
    </a>
  ) : (
    <div className="np-identity np-identity--player">{content}</div>
  );
}

export interface RosterRowProps {
  readonly actions?: ReactNode;
  readonly detail?: ReactNode;
  readonly player: PlayerIdentityProps;
  readonly status?: "active" | "coach" | "inactive" | "starter" | "substitute";
}

export function RosterRow({ actions, detail, player, status = "starter" }: RosterRowProps) {
  return (
    <article className="np-roster-row">
      <PlayerIdentity {...player} />
      <StatusIndicator
        label={status}
        tone={
          status === "inactive"
            ? "neutral"
            : status === "active" || status === "starter"
              ? "success"
              : "info"
        }
      />
      {detail ? <div className="np-roster-row__detail">{detail}</div> : null}
      {actions ? <div className="np-row-actions">{actions}</div> : null}
    </article>
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

function MatchLifecycleLabel({ lifecycle }: { readonly lifecycle: MatchLifecycle }) {
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
                <strong className="np-score">{team.score}</strong>
              ) : null}
            </div>
            {teamIndex === 0 ? (
              <span aria-hidden="true" className="np-match-vs">
                vs
              </span>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}

export interface MatchRowProps extends AnalyticsProps {
  readonly actions?: ReactNode;
  readonly expandedContent?: ReactNode;
  readonly match: MatchDisplay;
  readonly onSpoilerReveal?: () => void;
  readonly spoilerHidden?: boolean;
  readonly streamAction?: ReactNode;
}

export function MatchRow({
  analyticsId,
  actions,
  expandedContent,
  match,
  onSpoilerReveal,
  spoilerHidden = false,
  streamAction,
}: MatchRowProps) {
  const hasActions = Boolean(match.streamAvailable || actions || streamAction);
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
        <MatchLifecycleLabel lifecycle={match.lifecycle} />
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
          <span>Result hidden</span>
        </button>
      ) : (
        <a
          aria-label={`${match.teams[0].name} versus ${match.teams[1].name}, ${match.scheduledLabel}`}
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

export interface MatchCardProps extends MatchRowProps {
  readonly showStreamAction?: boolean;
}

export function MatchCard({
  analyticsId,
  actions,
  match,
  showStreamAction = true,
  spoilerHidden = false,
}: MatchCardProps) {
  return (
    <article
      {...analyticsData(analyticsId)}
      className={cx("np-match-card", `np-match-card--${match.lifecycle}`)}
    >
      <header>
        <MatchLifecycleLabel lifecycle={match.lifecycle} />
        <span>{match.scheduledLabel}</span>
      </header>
      <a href={match.href}>
        <MatchTeams
          compact={false}
          hideScores={spoilerHidden && match.lifecycle === "final"}
          match={match}
        />
      </a>
      {spoilerHidden && match.lifecycle === "final" ? (
        <div className="np-match-card__cover">
          <Icon icon={EyeOff} size="medium" />
          <span>Result hidden</span>
        </div>
      ) : null}
      <footer>
        <span className="np-match-card__meta">
          <span>{match.competition}</span>
          <span>Best of {match.bestOf}</span>
        </span>
        <span className="np-match-card__actions">
          {showStreamAction && match.streamAvailable ? (
            <a
              className="np-match-card__watch"
              href={match.streamHref ?? match.href}
              rel="noreferrer"
              target="_blank"
            >
              <Icon icon={Play} size="small" />
              <span>Watch Live</span>
              <Icon icon={ExternalLink} size="small" />
            </a>
          ) : null}
          {actions ? <span className="np-row-actions">{actions}</span> : null}
        </span>
      </footer>
    </article>
  );
}

export interface ScheduleGroupProps {
  readonly children: ReactNode;
  readonly count?: number;
  readonly dateLabel: string;
  readonly description?: string;
  readonly stale?: boolean;
}

export function ScheduleGroup({
  children,
  count,
  dateLabel,
  description,
  stale = false,
}: ScheduleGroupProps) {
  return (
    <section className="np-schedule-group">
      <header className="np-schedule-group__header">
        <div>
          <h2>{dateLabel}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <div>
          {count !== undefined ? <span className="np-mono">{count} matches</span> : null}
          {stale ? <StatusIndicator label="Stale" tone="warning" /> : null}
        </div>
      </header>
      <div className="np-schedule-group__list">{children}</div>
    </section>
  );
}

export interface DateRailItem {
  readonly count?: number;
  readonly day: string;
  readonly disabled?: boolean;
  readonly id: string;
  readonly label: string;
  readonly today?: boolean;
}

export interface DateRailProps extends AnalyticsProps {
  readonly items: readonly DateRailItem[];
  readonly onChange: (id: string) => void;
  readonly onNext?: () => void;
  readonly onPrevious?: () => void;
  readonly selectedId: string;
}

export function DateRail({
  analyticsId,
  items,
  onChange,
  onNext,
  onPrevious,
  selectedId,
}: DateRailProps) {
  return (
    <div
      {...analyticsData(analyticsId)}
      className={cx(
        "np-date-rail",
        !onPrevious && "np-date-rail--no-previous",
        !onNext && "np-date-rail--no-next",
      )}
    >
      {onPrevious ? (
        <Button aria-label="Previous dates" onPress={onPrevious} size="compact" variant="ghost">
          <Icon icon={ChevronLeft} size="small" />
        </Button>
      ) : null}
      <div aria-label="Schedule date" className="np-date-rail__list" role="group">
        {items.map((item) => (
          <button
            aria-pressed={item.id === selectedId}
            className="np-date-rail__item"
            disabled={item.disabled}
            key={item.id}
            onClick={() => onChange(item.id)}
            type="button"
          >
            <span>{item.day}</span>
            <strong>{item.label}</strong>
            {item.today ? (
              <small>Today</small>
            ) : item.count !== undefined ? (
              <small>{item.count}</small>
            ) : null}
          </button>
        ))}
      </div>
      {onNext ? (
        <Button aria-label="Next dates" onPress={onNext} size="compact" variant="ghost">
          <Icon icon={ChevronRight} size="small" />
        </Button>
      ) : null}
    </div>
  );
}

export interface EventHeaderProps extends CompetitionIdentityProps {
  readonly actions?: ReactNode;
  readonly dates: string;
  readonly format?: string;
  readonly status?: "completed" | "live" | "upcoming";
}

export function EventHeader({
  actions,
  dates,
  format,
  status = "upcoming",
  ...identity
}: EventHeaderProps) {
  const eventMark = (
    <Avatar
      alt={`${identity.name} logo`}
      fallback={identity.shortName}
      size="large"
      src={identity.logo}
    />
  );

  return (
    <header className="np-event-header">
      <div className="np-event-header__identity">
        {identity.href ? (
          <a
            aria-label={`Open ${identity.name}`}
            className="np-event-header__mark"
            href={identity.href}
          >
            {eventMark}
          </a>
        ) : (
          eventMark
        )}
        <div className="np-event-header__copy">
          <div className="np-event-header__context">
            {status === "live" ? (
              <LiveIndicator />
            ) : (
              <StatusIndicator
                label={status === "completed" ? "Completed" : "Upcoming"}
                tone="neutral"
              />
            )}
            {identity.region || identity.tier ? (
              <span>{[identity.region, identity.tier].filter(Boolean).join(" · ")}</span>
            ) : null}
          </div>
          <h1>{identity.name}</h1>
        </div>
      </div>
      <dl>
        <div>
          <dt>Dates</dt>
          <dd>{dates}</dd>
        </div>
        {format ? (
          <div>
            <dt>Format</dt>
            <dd>{format}</dd>
          </div>
        ) : null}
      </dl>
      {actions ? <div className="np-event-header__actions">{actions}</div> : null}
    </header>
  );
}

export interface StandingRow {
  readonly form?: string;
  readonly id: string;
  readonly losses: number;
  readonly points?: number;
  readonly position: number;
  readonly qualified?: boolean;
  readonly team: TeamIdentityProps;
  readonly wins: number;
}

export function StandingsTable({
  caption,
  rows,
}: {
  readonly caption: string;
  readonly rows: readonly StandingRow[];
}) {
  const columns: TableColumn<StandingRow>[] = [
    { align: "center", header: "#", id: "position", render: (row) => row.position, width: "48px" },
    { header: "Team", id: "team", render: (row) => <TeamIdentity {...row.team} /> },
    { align: "center", header: "W", id: "wins", render: (row) => row.wins, width: "56px" },
    { align: "center", header: "L", id: "losses", render: (row) => row.losses, width: "56px" },
    {
      align: "center",
      header: "Status",
      id: "status",
      render: (row) =>
        row.qualified ? (
          <StatusIndicator label="Qualified" tone="success" />
        ) : (
          <span>{row.form ?? "—"}</span>
        ),
      width: "128px",
    },
  ];

  if (rows.some((row) => row.points !== undefined)) {
    columns.splice(4, 0, {
      align: "center",
      header: "PTS",
      id: "points",
      render: (row) => row.points ?? "—",
      width: "72px",
    });
  }

  return <Table caption={caption} columns={columns} getRowKey={(row) => row.id} rows={rows} />;
}

export interface BracketMatch {
  readonly id: string;
  readonly lifecycle: MatchLifecycle;
  readonly teams: readonly [MatchTeam, MatchTeam];
}

export interface BracketRound {
  readonly id: string;
  readonly label: string;
  readonly matches: readonly BracketMatch[];
}

export interface BracketShellProps extends AnalyticsProps {
  readonly activeRound?: string;
  readonly emptyMessage?: string;
  readonly onMatchSelect?: (id: string) => void;
  readonly onRoundSelect?: (id: string) => void;
  readonly rounds: readonly BracketRound[];
  readonly title: string;
}

export function BracketShell({
  activeRound,
  analyticsId,
  emptyMessage = "Bracket is not available yet",
  onMatchSelect,
  onRoundSelect,
  rounds,
  title,
}: BracketShellProps) {
  if (rounds.length === 0) {
    return (
      <section className="np-bracket np-bracket--empty">
        <Icon icon={Trophy} size="large" />
        <h2>{title}</h2>
        <p>{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section {...analyticsData(analyticsId)} aria-label={title} className="np-bracket">
      <header>
        <h2>{title}</h2>
        <div aria-label="Bracket rounds" className="np-bracket__round-nav" role="group">
          {rounds.map((round) =>
            onRoundSelect ? (
              <button
                aria-pressed={round.id === activeRound}
                key={round.id}
                onClick={() => onRoundSelect(round.id)}
                type="button"
              >
                {round.label}
              </button>
            ) : (
              <span aria-current={round.id === activeRound ? "step" : undefined} key={round.id}>
                {round.label}
              </span>
            ),
          )}
        </div>
      </header>
      <div className="np-bracket__scroll">
        {rounds.map((round) => (
          <section className="np-bracket__round" key={round.id}>
            <h3>{round.label}</h3>
            <ol>
              {round.matches.map((match) => {
                const matchContent = (
                  <>
                    <MatchLifecycleLabel lifecycle={match.lifecycle} />
                    {match.teams.map((team, teamIndex) => (
                      <span
                        className={cx(team.winner && "np-bracket-match__winner")}
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
                        <strong>{team.score ?? "—"}</strong>
                      </span>
                    ))}
                  </>
                );

                return (
                  <li key={match.id}>
                    {onMatchSelect ? (
                      <button
                        className="np-bracket-match"
                        onClick={() => onMatchSelect(match.id)}
                        type="button"
                      >
                        {matchContent}
                      </button>
                    ) : (
                      <article className="np-bracket-match">{matchContent}</article>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </section>
  );
}

export interface ChampionPickProps {
  readonly action?: "ban" | "pick" | "placeholder";
  readonly champion: string;
  readonly image?: string;
  readonly order?: number;
  readonly player?: string;
  readonly side?: "blue" | "red";
}

export function ChampionPick({
  action = "pick",
  champion,
  image,
  order,
  player,
  side = "blue",
}: ChampionPickProps) {
  const phrase = `${action === "ban" ? "Ban" : action === "placeholder" ? "Pending" : "Pick"}${order ? ` ${order}` : ""}: ${champion}${player ? ` by ${player}` : ""}`;
  return (
    <div
      aria-label={phrase}
      className={cx("np-champion-pick", `np-champion-pick--${action}`, `np-side--${side}`)}
    >
      <Avatar alt={`${champion} portrait`} fallback={champion} size="large" src={image} />
      <span>
        <small>{action === "placeholder" ? "Pending" : `${action} ${order ?? ""}`}</small>
        <strong>{champion}</strong>
        {player ? <span>{player}</span> : null}
      </span>
    </div>
  );
}

export interface PickBanSide {
  readonly bans: readonly ChampionPickProps[];
  readonly name: string;
  readonly picks: readonly ChampionPickProps[];
}

export interface PickBanProps {
  readonly gameLabel: string;
  readonly sides: readonly [PickBanSide, PickBanSide];
  readonly spoilerHidden?: boolean;
  readonly status?: "complete" | "live" | "pregame" | "stale" | "unavailable";
}

export function PickBan({
  gameLabel,
  sides,
  spoilerHidden = false,
  status = "pregame",
}: PickBanProps) {
  if (status === "unavailable") {
    return (
      <section className="np-pickban np-pickban--unavailable">
        <Icon icon={ShieldQuestion} size="large" />
        <h3>Pick and ban unavailable</h3>
        <p>The current provider does not expose draft data for this game.</p>
      </section>
    );
  }

  if (spoilerHidden) {
    return (
      <section className="np-pickban np-pickban--hidden">
        <Icon icon={EyeOff} size="large" />
        <h3>{gameLabel} draft hidden</h3>
        <p>Reveal spoilers to view champion picks and bans.</p>
      </section>
    );
  }

  return (
    <section className={cx("np-pickban", `np-pickban--${status}`)}>
      <header>
        <div>
          <span className="np-eyebrow">Draft</span>
          <h3>{gameLabel}</h3>
        </div>
        {status === "live" ? (
          <LiveIndicator label="Draft live" />
        ) : status === "stale" ? (
          <StatusIndicator label="Stale" tone="warning" />
        ) : (
          <StatusIndicator label={status} tone="neutral" />
        )}
      </header>
      <div className="np-pickban__sides">
        {sides.map((side, sideIndex) => (
          <section
            className={cx("np-pickban__side", `np-side--${sideIndex === 0 ? "blue" : "red"}`)}
            key={side.name}
          >
            <h4>{side.name}</h4>
            <div className="np-pickban__picks">
              {side.picks.map((pick, index) => (
                <ChampionPick
                  {...pick}
                  key={`${pick.champion}-${index}`}
                  side={sideIndex === 0 ? "blue" : "red"}
                />
              ))}
            </div>
            <div className="np-pickban__bans">
              <span>Bans</span>
              {side.bans.map((ban, index) => (
                <ChampionPick
                  {...ban}
                  action="ban"
                  key={`${ban.champion}-${index}`}
                  side={sideIndex === 0 ? "blue" : "red"}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

export type SearchEntityType = "event" | "match" | "player" | "team";

export interface SearchResultProps {
  readonly description?: string;
  readonly href: string;
  readonly image?: string;
  readonly meta?: ReactNode;
  readonly name: string;
  readonly shortName: string;
  readonly type: SearchEntityType;
}

export function SearchResult({
  description,
  href,
  image,
  meta,
  name,
  shortName,
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
          <span className="np-eyebrow">{type}</span>
          <strong>{name}</strong>
          {description ? <small>{description}</small> : null}
        </span>
        {meta ? <span className="np-search-result__meta">{meta}</span> : null}
        <Icon icon={ChevronRight} size="small" />
      </a>
    </article>
  );
}

export interface FilterChip {
  readonly id: string;
  readonly label: string;
}

export interface FilterBarProps extends AnalyticsProps {
  readonly applied: readonly FilterChip[];
  readonly children?: ReactNode;
  readonly onClearAll?: () => void;
  readonly onOpenFilters?: () => void;
  readonly onRemove?: (id: string) => void;
  readonly resultCount?: number;
}

export function FilterBar({
  applied,
  analyticsId,
  children,
  onClearAll,
  onOpenFilters,
  onRemove,
  resultCount,
}: FilterBarProps) {
  return (
    <section {...analyticsData(analyticsId)} aria-label="Filters" className="np-filter-bar">
      <div className="np-filter-bar__primary">
        <Button
          {...(onOpenFilters ? { onPress: onOpenFilters } : {})}
          disabled={!onOpenFilters}
          size="small"
          startIcon={<Icon icon={Filter} size="small" />}
        >
          Filters
          {applied.length > 0 ? <span className="np-count">{applied.length}</span> : null}
        </Button>
        {children ? <div className="np-filter-bar__context">{children}</div> : null}
      </div>
      <div className="np-filter-bar__chips">
        {applied.map((chip) =>
          onRemove ? (
            <button
              aria-label={`Remove ${chip.label} filter`}
              className="np-chip"
              key={chip.id}
              onClick={() => onRemove(chip.id)}
              type="button"
            >
              {chip.label}
              <span aria-hidden="true">×</span>
            </button>
          ) : (
            <span className="np-chip" key={chip.id}>
              {chip.label}
            </span>
          ),
        )}
        {applied.length > 1 && onClearAll ? (
          <Button onPress={onClearAll} size="compact" variant="ghost">
            Clear All
          </Button>
        ) : null}
      </div>
      {resultCount !== undefined ? (
        <span aria-live="polite" className="np-filter-bar__count np-mono">
          {resultCount} results
        </span>
      ) : null}
    </section>
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
  readonly fallbackHref?: string;
  readonly mode?: "live" | "replay";
  readonly onRetry?: () => void;
  readonly provider: string;
  readonly state?: "blocked" | "failed" | "loading" | "offline" | "ready";
  readonly title: string;
}

export function StreamEmbedShell({
  children,
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
      className={cx("np-stream-shell", `np-stream-shell--${state}`)}
    >
      <header>
        <div>
          <Icon icon={Radio} size="small" />
          <span>{provider}</span>
        </div>
        <div>
          {state === "ready" ? (
            mode === "live" ? (
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
        Hide results
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

export function EntityDirectoryIntro({ children }: { readonly children?: ReactNode }) {
  return (
    <header className="np-directory-intro">
      <div>
        <span className="np-eyebrow">Reference directory</span>
        <h1>Teams and players</h1>
        <p>Browse active Tier-1 rosters independent of the current match schedule.</p>
      </div>
      {children ? <div className="np-directory-intro__actions">{children}</div> : null}
    </header>
  );
}
