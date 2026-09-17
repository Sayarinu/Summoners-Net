"use client";

import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Crosshair,
  Database,
  ExternalLink,
  Gauge,
  Layers3,
  RefreshCw,
  Shield,
  ShieldAlert,
  Sparkles,
  Swords,
  Target,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Radio, RadioGroup } from "react-aria-components";

import { Skeleton, StatePanel } from "./data-display.js";
import { analyticsData, cx, Icon, VisuallyHidden } from "./internal.js";
import type { AnalyticsProps } from "./internal.js";
import { Button, Callout, MetaText, StatusIndicator, TextLink } from "./primitives.js";

export interface GameTitleOption {
  readonly available?: boolean;
  readonly meta?: ReactNode;
  readonly description?: string;
  readonly icon?: ReactNode;
  readonly id: string;
  readonly label: string;
  readonly shortLabel?: string;
}

export interface GameTitleSwitcherProps extends AnalyticsProps {
  readonly label?: string;
  readonly onChange?: (id: string) => void;
  readonly titles: readonly GameTitleOption[];
  readonly value: string;
}

export function GameTitleSwitcher({
  analyticsId,
  label = "Game title",
  onChange,
  titles,
  value,
}: GameTitleSwitcherProps) {
  return (
    <RadioGroup
      {...analyticsData(analyticsId)}
      aria-label={label}
      className="np-game-switcher"
      {...(onChange ? { onChange } : {})}
      value={value}
    >
      {titles.map((title) => (
        <Radio
          aria-label={title.label}
          {...(title.description ? { "aria-describedby": `np-game-${title.id}-description` } : {})}
          className="np-game-switcher__option"
          id={title.id}
          isDisabled={title.available === false}
          key={title.id}
          value={title.id}
        >
          {title.icon ? <span className="np-game-switcher__icon">{title.icon}</span> : null}
          <span className="np-game-switcher__identity">
            <strong>
              <span className="np-game-switcher__long">{title.label}</span>
              <span className="np-game-switcher__short">{title.shortLabel ?? title.label}</span>
            </strong>
            {title.description ? (
              <small id={`np-game-${title.id}-description`}>{title.description}</small>
            ) : null}
          </span>
          {title.meta}
          <span aria-hidden="true" className="np-game-switcher__selection" />
        </Radio>
      ))}
    </RadioGroup>
  );
}

export type MapVetoAction = "ban" | "decider" | "pick" | "remaining";

export interface MapVetoStep {
  readonly action: MapVetoAction;
  readonly id: string;
  readonly map: string;
  readonly side?: "CT" | "T";
  readonly team?: string;
}

export interface MapVetoProps extends AnalyticsProps {
  readonly bestOf: 1 | 3 | 5;
  readonly steps: readonly MapVetoStep[];
  readonly title?: string;
}

export function MapVeto({ analyticsId, bestOf, steps, title = "Map veto" }: MapVetoProps) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-labelledby="np-map-veto-title"
      className="np-map-veto"
    >
      <header>
        <div>
          <span className="np-eyebrow">Best of {bestOf}</span>
          <h2 id="np-map-veto-title">{title}</h2>
        </div>
        <Icon icon={Layers3} size="medium" />
      </header>
      <ol>
        {steps.map((step, index) => (
          <li className={`np-map-veto__step--${step.action}`} key={step.id}>
            <span className="np-map-veto__order">{index + 1}</span>
            <div>
              <strong>{step.map}</strong>
              <span>
                {step.action === "decider" || step.action === "remaining"
                  ? "Series decider"
                  : `${step.team ?? "TBD"} ${step.action === "ban" ? "removed" : "picked"}`}
              </span>
            </div>
            <MetaText
              tone={
                step.action === "ban" ? "danger" : step.action === "pick" ? "accent" : "neutral"
              }
            >
              {step.action}
            </MetaText>
            {step.side ? <span className="np-map-veto__side">Starts {step.side}</span> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export type MapState = "complete" | "live" | "scheduled";

export interface MapSeriesGame {
  readonly id: string;
  readonly map: string;
  readonly scoreA?: number;
  readonly scoreB?: number;
  readonly state: MapState;
}

export interface MapSeriesScoreProps extends AnalyticsProps {
  readonly bestOf: 1 | 3 | 5;
  readonly games: readonly MapSeriesGame[];
  readonly scoreA: number;
  readonly scoreB: number;
  readonly teamA: string;
  readonly teamB: string;
}

export function MapSeriesScore({
  analyticsId,
  bestOf,
  games,
  scoreA,
  scoreB,
  teamA,
  teamB,
}: MapSeriesScoreProps) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-label={`${teamA} versus ${teamB} map series`}
      className="np-map-series"
    >
      <header>
        <div className={cx("np-map-series__team", scoreA > scoreB && "is-leading")}>
          <span>{teamA}</span>
          <strong>{scoreA}</strong>
        </div>
        <div className="np-map-series__meta">
          <span>Best of {bestOf}</span>
          <strong>Map score</strong>
        </div>
        <div
          className={cx(
            "np-map-series__team",
            "np-map-series__team--away",
            scoreB > scoreA && "is-leading",
          )}
        >
          <strong>{scoreB}</strong>
          <span>{teamB}</span>
        </div>
      </header>
      <div className="np-map-series__games">
        {games.map((game) => (
          <article
            className={`np-map-series__game np-map-series__game--${game.state}`}
            key={game.id}
          >
            <div>
              <strong>{game.map}</strong>
              <StatusIndicator
                label={game.state}
                tone={
                  game.state === "live" ? "live" : game.state === "complete" ? "success" : "neutral"
                }
              />
            </div>
            <span>
              {game.scoreA === undefined || game.scoreB === undefined ? (
                <span aria-label="Score not available">—</span>
              ) : (
                <>
                  <strong className={cx(game.scoreA > game.scoreB && "is-winner")}>
                    {game.scoreA}
                  </strong>
                  <span aria-hidden="true">:</span>
                  <strong className={cx(game.scoreB > game.scoreA && "is-winner")}>
                    {game.scoreB}
                  </strong>
                </>
              )}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

export interface RoundTeamScore {
  readonly equipmentValue?: number;
  readonly name: string;
  readonly score: number;
  readonly side: "CT" | "T";
  readonly timeouts?: number;
}

export interface RoundScoreboardProps extends AnalyticsProps {
  readonly phase: "bomb-planted" | "buy" | "freeze" | "live" | "round-end" | "tactical-timeout";
  readonly round: number;
  readonly teamA: RoundTeamScore;
  readonly teamB: RoundTeamScore;
  readonly timer?: string;
}

function RoundTeam({ team }: { readonly team: RoundTeamScore }) {
  return (
    <div
      className={cx(
        "np-round-scoreboard__team",
        `np-round-scoreboard__team--${team.side.toLowerCase()}`,
      )}
    >
      <span className="np-round-scoreboard__side">{team.side}</span>
      <div>
        <strong>{team.name}</strong>
        {team.equipmentValue !== undefined ? (
          <small>${team.equipmentValue.toLocaleString()} equipment</small>
        ) : null}
      </div>
      <strong className="np-round-scoreboard__score">{team.score}</strong>
      {team.timeouts !== undefined ? (
        <span className="np-round-scoreboard__timeouts">{team.timeouts} TO</span>
      ) : null}
    </div>
  );
}

export function RoundScoreboard({
  analyticsId,
  phase,
  round,
  teamA,
  teamB,
  timer,
}: RoundScoreboardProps) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-label={`Round ${round} scoreboard`}
      className={cx("np-round-scoreboard", `np-round-scoreboard--${phase}`)}
    >
      <RoundTeam team={teamA} />
      <div aria-atomic="true" className="np-round-scoreboard__round" role="status">
        <span>Round {round}</span>
        <strong>{timer ?? phase.replaceAll("-", " ")}</strong>
        <MetaText
          tone={phase === "bomb-planted" ? "danger" : phase === "live" ? "live" : "neutral"}
        >
          {phase.replaceAll("-", " ")}
        </MetaText>
      </div>
      <RoundTeam team={teamB} />
    </section>
  );
}

export type EconomyState = "buy" | "eco" | "force" | "half-buy" | "unknown";

export interface EconomyTeam {
  readonly equipmentValue: number;
  readonly lossBonus?: number;
  readonly money: number;
  readonly name: string;
  readonly state: EconomyState;
}

export interface EconomyStripProps extends AnalyticsProps {
  readonly teams: readonly [EconomyTeam, EconomyTeam];
}

export function EconomyStrip({ analyticsId, teams }: EconomyStripProps) {
  return (
    <section {...analyticsData(analyticsId)} aria-label="Team economy" className="np-economy-strip">
      <header>
        <Icon icon={CircleDollarSign} size="small" />
        <span>Economy</span>
      </header>
      {teams.map((team, teamIndex) => (
        <article key={`economy-team-${teamIndex}`}>
          <strong>{team.name}</strong>
          <MetaText
            tone={team.state === "eco" ? "warning" : team.state === "buy" ? "success" : "neutral"}
          >
            {team.state}
          </MetaText>
          <dl>
            <div>
              <dt>Cash</dt>
              <dd>${team.money.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Equipment</dt>
              <dd>${team.equipmentValue.toLocaleString()}</dd>
            </div>
            {team.lossBonus !== undefined ? (
              <div>
                <dt>Loss bonus</dt>
                <dd>${team.lossBonus.toLocaleString()}</dd>
              </div>
            ) : null}
          </dl>
        </article>
      ))}
    </section>
  );
}

export interface LoadoutPlayer {
  readonly alive?: boolean;
  readonly armor: number;
  readonly defuseKit?: boolean;
  readonly handle: string;
  readonly hasHelmet?: boolean;
  readonly money: number;
  readonly primary?: string;
  readonly secondary?: string;
  readonly utility?: number;
}

export interface LoadoutStripProps extends AnalyticsProps {
  readonly players: readonly LoadoutPlayer[];
  readonly side: "CT" | "T";
  readonly team: string;
}

export function LoadoutStrip({ analyticsId, players, side, team }: LoadoutStripProps) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-labelledby={`np-loadout-${team}`}
      className={`np-loadout-strip np-loadout-strip--${side.toLowerCase()}`}
    >
      <header>
        <div>
          <span>{side}</span>
          <h3 id={`np-loadout-${team}`}>{team} loadout</h3>
        </div>
        <span>
          ${players.reduce((total, player) => total + player.money, 0).toLocaleString()} available
        </span>
      </header>
      <div
        aria-label={`${team} player economy and equipment`}
        className="np-table-wrap"
        role="region"
        tabIndex={0}
      >
        <table className="np-loadout-table">
          <caption className="np-visually-hidden">{team} player economy and equipment</caption>
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Cash</th>
              <th scope="col">Primary</th>
              <th scope="col">Secondary</th>
              <th scope="col">Armor</th>
              <th scope="col">Utility</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr className={cx(player.alive === false && "is-eliminated")} key={player.handle}>
                <th scope="row">
                  <span aria-hidden="true" className="np-loadout-table__alive" />
                  {player.handle}
                </th>
                <td className="np-mono">${player.money.toLocaleString()}</td>
                <td>{player.primary ?? "—"}</td>
                <td>{player.secondary ?? "—"}</td>
                <td>
                  <span className="np-loadout-icons">
                    <span>
                      <Icon icon={Shield} size="small" />
                      <VisuallyHidden>Armor </VisuallyHidden>
                      {player.armor}
                    </span>
                    {player.hasHelmet ? <MetaText>Helmet</MetaText> : null}
                    {player.defuseKit ? <MetaText tone="info">Kit</MetaText> : null}
                  </span>
                </td>
                <td>{player.utility ?? 0} grenades</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export interface EconomyLoadoutStripProps extends AnalyticsProps {
  readonly players: readonly LoadoutPlayer[];
  readonly side: "CT" | "T";
  readonly team: string;
  readonly teamEconomy: EconomyTeam;
}

export function EconomyLoadoutStrip({
  analyticsId,
  players,
  side,
  team,
  teamEconomy,
}: EconomyLoadoutStripProps) {
  return (
    <div {...analyticsData(analyticsId)} className="np-economy-loadout">
      <div className="np-economy-loadout__summary">
        <span>
          <Icon icon={CircleDollarSign} size="small" />
          {teamEconomy.state}
        </span>
        <strong>${teamEconomy.equipmentValue.toLocaleString()}</strong>
        <small>Team equipment value</small>
      </div>
      <LoadoutStrip players={players} side={side} team={team} />
    </div>
  );
}

export type CS2PlayerStatKey =
  "adr" | "assists" | "deaths" | "headshots" | "kast" | "kd" | "kills" | "rating";

export interface CS2PlayerStatRow {
  readonly adr: number;
  readonly assists: number;
  readonly deaths: number;
  readonly handle: string;
  readonly headshots: number;
  readonly id: string;
  readonly kast: number;
  readonly kd: number;
  readonly kills: number;
  readonly rating: number;
  readonly team: string;
}

export interface CS2PlayerStatsTableProps extends AnalyticsProps {
  readonly caption?: string;
  readonly onSort?: (key: CS2PlayerStatKey) => void;
  readonly rows: readonly CS2PlayerStatRow[];
  readonly sort?: {
    readonly direction: "ascending" | "descending";
    readonly key: CS2PlayerStatKey;
  };
}

const statColumns: readonly {
  readonly key: CS2PlayerStatKey;
  readonly label: string;
  readonly suffix?: string;
}[] = [
  { key: "kills", label: "K" },
  { key: "deaths", label: "D" },
  { key: "assists", label: "A" },
  { key: "kd", label: "K/D" },
  { key: "adr", label: "ADR" },
  { key: "kast", label: "KAST", suffix: "%" },
  { key: "headshots", label: "HS", suffix: "%" },
  { key: "rating", label: "Rating" },
];

export function CS2PlayerStatsTable({
  analyticsId,
  caption = "Player map statistics",
  onSort,
  rows,
  sort,
}: CS2PlayerStatsTableProps) {
  return (
    <div
      {...analyticsData(analyticsId)}
      aria-label={caption}
      className="np-cs2-stats np-table-wrap"
      role="region"
      tabIndex={0}
    >
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Player</th>
            {statColumns.map((column) => {
              const active = sort?.key === column.key;
              return (
                <th aria-sort={active ? sort.direction : "none"} key={column.key} scope="col">
                  {onSort ? (
                    <button onClick={() => onSort(column.key)} type="button">
                      {column.label}
                      {active ? (
                        <Icon
                          icon={sort.direction === "ascending" ? ChevronUp : ChevronDown}
                          size="small"
                        />
                      ) : null}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">
                <strong>{row.handle}</strong>
                <small>{row.team}</small>
              </th>
              {statColumns.map((column) => (
                <td key={column.key}>
                  {row[column.key].toFixed(
                    column.key === "kd" || column.key === "rating"
                      ? 2
                      : column.key === "adr"
                        ? 1
                        : 0,
                  )}
                  {column.suffix}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface PredictionOutcome {
  readonly colorIndex?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  readonly id: string;
  readonly label: string;
  readonly probability: number;
}

export interface PredictionProbabilityProps extends AnalyticsProps {
  readonly outcomes: readonly PredictionOutcome[];
  readonly title?: string;
}

export function PredictionProbability({
  analyticsId,
  outcomes,
  title = "Model probability",
}: PredictionProbabilityProps) {
  const safeOutcomes = outcomes.map((outcome) => ({
    ...outcome,
    probability: Math.min(1, Math.max(0, outcome.probability)),
  }));
  const total = safeOutcomes.reduce((sum, outcome) => sum + outcome.probability, 0);
  return (
    <figure
      {...analyticsData(analyticsId)}
      aria-label={title}
      className="np-prediction-probability"
    >
      <figcaption>
        <Icon icon={Sparkles} size="medium" />
        <h3>{title}</h3>
      </figcaption>
      <div aria-hidden="true" className="np-prediction-probability__bar">
        {safeOutcomes.map((outcome, index) => (
          <span
            className={`np-chart-fill--${outcome.colorIndex ?? (index % 8) + 1}`}
            key={outcome.id}
            style={{ width: `${total > 0 ? (outcome.probability / total) * 100 : 0}%` }}
          />
        ))}
      </div>
      <ul>
        {safeOutcomes.map((outcome, index) => (
          <li key={outcome.id}>
            <span>
              <span
                aria-hidden="true"
                className={`np-chart-swatch np-chart-swatch--${outcome.colorIndex ?? (index % 8) + 1}`}
              />
              {outcome.label}
            </span>
            <strong>{Math.round(outcome.probability * 100)}%</strong>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export interface ConfidenceIntervalProps extends AnalyticsProps {
  readonly confidence?: number;
  readonly higherLabel?: string;
  readonly lower: number;
  readonly lowerLabel?: string;
  readonly point: number;
  readonly upper: number;
}

export function ConfidenceInterval({
  analyticsId,
  confidence = 95,
  higherLabel = "Higher",
  lower,
  lowerLabel = "Lower",
  point,
  upper,
}: ConfidenceIntervalProps) {
  const safeLower = Math.min(1, Math.max(0, lower));
  const safeUpper = Math.min(1, Math.max(safeLower, upper));
  const safePoint = Math.min(safeUpper, Math.max(safeLower, point));
  const style = {
    "--np-ci-lower": `${safeLower * 100}%`,
    "--np-ci-point": `${safePoint * 100}%`,
    "--np-ci-upper": `${safeUpper * 100}%`,
  } as CSSProperties;
  return (
    <figure {...analyticsData(analyticsId)} className="np-confidence-interval" style={style}>
      <figcaption>
        <span>{confidence}% confidence interval</span>
        <strong>{Math.round(safePoint * 100)}%</strong>
      </figcaption>
      <div
        aria-label={`${confidence}% confidence interval from ${Math.round(safeLower * 100)}% to ${Math.round(safeUpper * 100)}%, point estimate ${Math.round(safePoint * 100)}%`}
        className="np-confidence-interval__track"
        role="img"
      >
        <span className="np-confidence-interval__range" />
        <span className="np-confidence-interval__point" />
      </div>
      <div className="np-confidence-interval__labels">
        <span>{lowerLabel}</span>
        <span>
          {Math.round(safeLower * 100)}–{Math.round(safeUpper * 100)}%
        </span>
        <span>{higherLabel}</span>
      </div>
    </figure>
  );
}

export interface CalibrationBin {
  readonly actual: number;
  readonly id: string;
  readonly predicted: number;
  readonly sampleSize: number;
}

export interface CalibrationChartProps extends AnalyticsProps {
  readonly bins: readonly CalibrationBin[];
  readonly calibrationError?: number;
  readonly title?: string;
}

export function CalibrationChart({
  analyticsId,
  bins,
  calibrationError,
  title = "Probability calibration",
}: CalibrationChartProps) {
  const safeBins = bins.map((bin) => ({
    ...bin,
    actual: Math.min(1, Math.max(0, bin.actual)),
    predicted: Math.min(1, Math.max(0, bin.predicted)),
  }));
  return (
    <figure {...analyticsData(analyticsId)} aria-label={title} className="np-calibration-chart">
      <figcaption>
        <div>
          <span className="np-eyebrow">Model quality</span>
          <h3>{title}</h3>
          <p>Predicted probability compared with observed outcomes.</p>
        </div>
        {calibrationError !== undefined ? (
          <MetaText tone={calibrationError <= 0.05 ? "success" : "warning"}>
            ECE {(calibrationError * 100).toFixed(1)}%
          </MetaText>
        ) : null}
      </figcaption>
      <div aria-hidden="true" className="np-calibration-chart__plot">
        <span className="np-calibration-chart__ideal" />
        {safeBins.map((bin) => (
          <span
            className="np-calibration-chart__point"
            key={bin.id}
            style={
              {
                "--np-calibration-x": `${bin.predicted * 100}%`,
                "--np-calibration-y": `${(1 - bin.actual) * 100}%`,
                "--np-calibration-size": `${Math.max(6, Math.min(16, bin.sampleSize / 10))}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="np-calibration-chart__axes" aria-hidden="true">
        <span>Observed frequency</span>
        <span>Predicted probability</span>
      </div>
      <details>
        <summary>View calibration data</summary>
        <div
          aria-label={`${title} calibration data`}
          className="np-table-wrap"
          role="region"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Predicted</th>
                <th scope="col">Observed</th>
                <th scope="col">Sample</th>
              </tr>
            </thead>
            <tbody>
              {safeBins.map((bin) => (
                <tr key={bin.id}>
                  <td>{Math.round(bin.predicted * 100)}%</td>
                  <td>{Math.round(bin.actual * 100)}%</td>
                  <td>{bin.sampleSize}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export interface ModelSourceProps extends AnalyticsProps {
  readonly evaluatedAt?: string;
  readonly evaluatedLabel?: string;
  readonly model: string;
  readonly sampleSize?: number;
  readonly source: string;
  readonly sourceHref?: string;
  readonly version: string;
}

export function ModelSource({
  analyticsId,
  evaluatedAt,
  evaluatedLabel,
  model,
  sampleSize,
  source,
  sourceHref,
  version,
}: ModelSourceProps) {
  return (
    <aside
      {...analyticsData(analyticsId)}
      aria-label="Prediction model details"
      className="np-model-source"
    >
      <div className="np-model-source__identity">
        <Icon icon={Bot} size="medium" />
        <span>
          <strong>{model}</strong>
          <code>{version}</code>
        </span>
      </div>
      <dl>
        <div>
          <dt>Feature source</dt>
          <dd>
            {sourceHref ? (
              <TextLink href={sourceHref} rel="noreferrer" target="_blank" variant="muted">
                {source}
                <Icon icon={ExternalLink} size="small" />
              </TextLink>
            ) : (
              source
            )}
          </dd>
        </div>
        {evaluatedAt && evaluatedLabel ? (
          <div>
            <dt>Last evaluated</dt>
            <dd>
              <time dateTime={evaluatedAt}>{evaluatedLabel}</time>
            </dd>
          </div>
        ) : null}
        {sampleSize !== undefined ? (
          <div>
            <dt>Evaluation sample</dt>
            <dd>{sampleSize.toLocaleString()} series</dd>
          </div>
        ) : null}
      </dl>
    </aside>
  );
}

export interface PredictionDisclaimerProps extends AnalyticsProps {
  readonly methodologyHref?: string;
}

export function PredictionDisclaimer({
  analyticsId,
  methodologyHref = "/methodology/predictions",
}: PredictionDisclaimerProps) {
  return (
    <div {...analyticsData(analyticsId)}>
      <Callout title="Informational analysis only" tone="info">
        <p>
          Probabilities are experimental estimates, not facts, betting advice, or guarantees. Do not
          use them to make financial decisions.{" "}
          <TextLink href={methodologyHref}>Read the model methodology</TextLink>
        </p>
      </Callout>
    </div>
  );
}

export interface PredictionPanelProps extends AnalyticsProps {
  readonly children?: ReactNode;
  readonly interval?: ConfidenceIntervalProps;
  readonly model: ModelSourceProps;
  readonly outcomes: readonly PredictionOutcome[];
  readonly title: string;
}

export function PredictionPanel({
  analyticsId,
  children,
  interval,
  model,
  outcomes,
  title,
}: PredictionPanelProps) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-labelledby="np-prediction-panel-title"
      className="np-prediction-panel"
    >
      <header>
        <div>
          <span className="np-eyebrow">Experimental · V2</span>
          <h2 id="np-prediction-panel-title">{title}</h2>
        </div>
        <MetaText tone="info">Model estimate</MetaText>
      </header>
      <PredictionProbability outcomes={outcomes} />
      {interval ? <ConfidenceInterval {...interval} /> : null}
      {children}
      <ModelSource {...model} />
      <PredictionDisclaimer />
    </section>
  );
}

export interface PredictionUnavailableProps extends AnalyticsProps {
  readonly onRetry?: () => void;
  readonly reason?: ReactNode;
}

export function PredictionUnavailable({
  analyticsId,
  onRetry,
  reason,
}: PredictionUnavailableProps) {
  return (
    <div {...analyticsData(analyticsId)} role="status">
      <StatePanel
        action={
          onRetry ? (
            <Button onPress={onRetry} startIcon={<Icon icon={RefreshCw} size="small" />}>
              Retry Model
            </Button>
          ) : null
        }
        title="Prediction unavailable"
        tone="warning"
      >
        {reason ??
          "The model service did not return a trustworthy estimate. Match data remains available."}
      </StatePanel>
    </div>
  );
}

export interface PredictionLoadingProps extends AnalyticsProps {
  readonly label?: string;
}

export function PredictionLoading({
  analyticsId,
  label = "Generating model estimate",
}: PredictionLoadingProps) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-busy="true"
      aria-label={label}
      className="np-prediction-loading"
    >
      <div>
        <Icon icon={Sparkles} size="medium" />
        <span>{label}</span>
      </div>
      <Skeleton height={12} width="34%" />
      <Skeleton height={28} radius="sm" />
      <div className="np-prediction-loading__rows">
        <Skeleton height={14} width="72%" />
        <Skeleton height={14} width="56%" />
        <Skeleton height={14} width="64%" />
      </div>
    </section>
  );
}

export interface StaleModelNoticeProps extends AnalyticsProps {
  readonly ageLabel: string;
  readonly lastEvaluatedAt: string;
  readonly onRefresh?: () => void;
  readonly thresholdLabel?: string;
  readonly version: string;
}

export function StaleModelNotice({
  ageLabel,
  analyticsId,
  lastEvaluatedAt,
  onRefresh,
  thresholdLabel,
  version,
}: StaleModelNoticeProps) {
  return (
    <Callout
      actions={
        onRefresh ? (
          <Button
            onPress={onRefresh}
            size="small"
            startIcon={<Icon icon={RefreshCw} size="small" />}
          >
            Request New Estimate
          </Button>
        ) : null
      }
      title="Model estimate may be stale"
      tone="warning"
    >
      <div {...analyticsData(analyticsId)} className="np-stale-model">
        Version <code>{version}</code> was evaluated{" "}
        <time dateTime={lastEvaluatedAt}>{ageLabel}</time>.
        {thresholdLabel ? ` Freshness target: ${thresholdLabel}.` : null}
      </div>
    </Callout>
  );
}

export interface PredictionQualitySummaryProps extends AnalyticsProps {
  readonly brierScore: number;
  readonly calibrationError: number;
  readonly sampleSize: number;
}

export function PredictionQualitySummary({
  analyticsId,
  brierScore,
  calibrationError,
  sampleSize,
}: PredictionQualitySummaryProps) {
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-label="Model quality summary"
      className="np-prediction-quality"
    >
      <div>
        <Icon icon={Gauge} size="medium" />
        <span>
          <small>Brier score</small>
          <strong>{brierScore.toFixed(3)}</strong>
        </span>
      </div>
      <div>
        <Icon icon={Target} size="medium" />
        <span>
          <small>Calibration error</small>
          <strong>{(calibrationError * 100).toFixed(1)}%</strong>
        </span>
      </div>
      <div>
        <Icon icon={Database} size="medium" />
        <span>
          <small>Evaluation sample</small>
          <strong>{sampleSize.toLocaleString()}</strong>
        </span>
      </div>
    </section>
  );
}

export interface PredictionGuardrailProps extends AnalyticsProps {
  readonly checks: readonly {
    readonly id: string;
    readonly label: string;
    readonly passed: boolean;
  }[];
}

export function PredictionGuardrail({ analyticsId, checks }: PredictionGuardrailProps) {
  const allPassed = checks.every((check) => check.passed);
  return (
    <section
      {...analyticsData(analyticsId)}
      aria-label="Prediction release checks"
      className="np-prediction-guardrail"
    >
      <header>
        <Icon icon={allPassed ? CheckCircle2 : AlertTriangle} size="medium" />
        <strong>{allPassed ? "Release checks passed" : "Prediction withheld"}</strong>
      </header>
      <ul>
        {checks.map((check) => (
          <li key={check.id}>
            <Icon icon={check.passed ? CheckCircle2 : ShieldAlert} size="small" />
            <span>{check.label}</span>
            <MetaText tone={check.passed ? "success" : "danger"}>
              {check.passed ? "Passed" : "Blocked"}
            </MetaText>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CS2TitleIcon() {
  return <Icon icon={Crosshair} label="Counter-Strike 2" size="medium" />;
}

export function LeagueTitleIcon() {
  return <Icon icon={Swords} label="League of Legends" size="medium" />;
}

export function PredictionTitleIcon() {
  return <Icon icon={BarChart3} label="Prediction analysis" size="medium" />;
}
