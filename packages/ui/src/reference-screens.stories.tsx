import { Database, FileCheck2, Gauge, Radio, Search, Settings } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Sparkline, StatTable, TrendChartShell } from "./data-display.js";
import { MobileAdminNavigation } from "./core-advanced.js";
import { EsportsFeatureGate } from "./esports-extended.js";
import {
  DateRail,
  MatchCard,
  MatchRow,
  RosterRow,
  ScheduleGroup,
  SpoilerControl,
  StreamEmbedShell,
  TeamIdentity,
} from "./esports.js";
import type { MatchDisplay } from "./esports.js";
import { Avatar, Icon } from "./internal.js";
import { Header, Navigation, Tabs } from "./navigation.js";
import {
  AdminNavigation,
  AdminShell,
  DataFreshnessBanner,
  IngestionRunRow,
  ProviderHealth,
} from "./operations.js";
import { Button, IconButton, LiveIndicator, MetaText, StatusIndicator } from "./primitives.js";
import "./review.stories.css";
import { BrandMark } from "./support.js";

const noop = () => undefined;

const matchScheduled: MatchDisplay = {
  bestOf: 3,
  competition: "Worlds 2026 · Swiss",
  href: "#",
  id: "scheduled",
  lifecycle: "scheduled",
  scheduledLabel: "18:00 EDT",
  streamAvailable: true,
  teams: [
    { name: "Gen.G", shortName: "GEN" },
    { name: "Bilibili Gaming", shortName: "BLG" },
  ],
};

const matchLive: MatchDisplay = {
  ...matchScheduled,
  id: "live",
  lifecycle: "live",
  scheduledLabel: "Game 2 · 24:18",
  teams: [
    { name: "T1", score: 1, shortName: "T1" },
    { name: "G2 Esports", score: 0, shortName: "G2" },
  ],
};

const matchFinal: MatchDisplay = {
  ...matchScheduled,
  id: "final",
  lifecycle: "final",
  scheduledLabel: "Final",
  teams: [
    { name: "Hanwha Life Esports", score: 2, shortName: "HLE", winner: true },
    { name: "FlyQuest", score: 1, shortName: "FLY" },
  ],
};

function PublicHeader({ currentHref }: { readonly currentHref: string }) {
  return (
    <Header
      actions={
        <IconButton icon={<Icon icon={Search} />} label="Search" size="compact" variant="ghost" />
      }
      brand={<BrandMark />}
      navigation={
        <Navigation
          currentHref={currentHref}
          items={[
            { href: "/schedule", label: "Schedule" },
            { href: "/events", label: "Events" },
            { href: "/teams", label: "Teams" },
            { href: "/players", label: "Players" },
          ]}
        />
      }
      status={<LiveIndicator label="3 live" />}
    />
  );
}

function HomeScreen() {
  return (
    <main className="np-screen" id="main-content">
      <PublicHeader currentHref="/schedule" />
      <section className="np-screen__hero">
        <div>
          <span className="np-eyebrow">Reliable Tier-1 esports data</span>
          <h1>Every match. One signal.</h1>
          <p>
            Verified schedules, live context, team rosters, and player performance across the
            competitions that matter.
          </p>
        </div>
        <div className="np-screen__hero-aside">
          <LiveIndicator label="Worlds 2026 live" />
          <strong>T1 1 — 0 G2 Esports</strong>
          <span className="np-meta">Game 2 · 24:18 · Swiss stage</span>
          <Button variant="primary">Open Live Match</Button>
        </div>
      </section>
      <div className="np-screen__content">
        <DateRail
          items={[
            { count: 3, day: "Wed", id: "8", label: "Jul 8" },
            { count: 6, day: "Thu", id: "9", label: "Jul 9" },
            { count: 5, day: "Fri", id: "10", label: "Jul 10", today: true },
            { count: 8, day: "Sat", id: "11", label: "Jul 11" },
            { count: 4, day: "Sun", id: "12", label: "Jul 12" },
          ]}
          onChange={noop}
          selectedId="10"
        />
        <section className="np-screen__section">
          <header className="np-screen__section-heading">
            <div>
              <span className="np-eyebrow">Now</span>
              <h2>Live matches</h2>
            </div>
            <Button variant="ghost">View All Live</Button>
          </header>
          <div className="np-review__grid">
            <MatchCard match={matchLive} />
            <MatchCard
              match={{
                ...matchLive,
                id: "live-2",
                teams: [
                  { name: "Top Esports", score: 0, shortName: "TES" },
                  { name: "Movistar KOI", score: 1, shortName: "MKOI" },
                ],
              }}
            />
          </div>
        </section>
        <section className="np-screen__section">
          <ScheduleGroup
            count={3}
            dateLabel="Upcoming today"
            description="Times shown in America/New_York"
          >
            <MatchRow match={matchScheduled} />
            <MatchRow
              match={{
                ...matchScheduled,
                id: "s2",
                scheduledLabel: "21:00 EDT",
                teams: [
                  { name: "KT Rolster", shortName: "KT" },
                  { name: "FlyQuest", shortName: "FLY" },
                ],
              }}
            />
            <MatchRow
              match={{
                ...matchScheduled,
                id: "s3",
                scheduledLabel: "23:00 EDT",
                teams: [
                  { name: "Hanwha Life Esports", shortName: "HLE" },
                  { name: "G2 Esports", shortName: "G2" },
                ],
              }}
            />
          </ScheduleGroup>
        </section>
      </div>
    </main>
  );
}

function LiveMatchScreen() {
  return (
    <main className="np-screen" id="main-content">
      <PublicHeader currentHref="/schedule" />
      <div className="np-screen__content">
        <div className="np-screen__section-heading">
          <div>
            <span className="np-eyebrow">Worlds 2026 · Swiss stage</span>
            <h2>T1 vs G2 Esports</h2>
          </div>
          <div className="np-review__row">
            <LiveIndicator label="Game 2" />
            <SpoilerControl hidden={false} onHiddenChange={noop} />
          </div>
        </div>
        <div className="np-screen__match-teams" aria-label="Match teams">
          <TeamIdentity detail="Blue side" name="T1" shortName="T1" size="large" />
          <TeamIdentity detail="Red side" name="G2 Esports" shortName="G2" size="large" />
        </div>
        <div className="np-review__stack">
          <StreamEmbedShell provider="Twitch" title="Worlds 2026 official stream">
            <div className="np-review__fake-stream">
              <strong>T1 1 — 0 G2</strong>
              <span>Game 2 · 24:18</span>
            </div>
          </StreamEmbedShell>
          <div className="np-screen__secondary-notice">
            <EsportsFeatureGate enabled={false} feature="Live draft and telemetry" />
          </div>
        </div>
      </div>
    </main>
  );
}

function TeamScreen() {
  return (
    <main className="np-screen" id="main-content">
      <PublicHeader currentHref="/teams" />
      <header className="np-screen__team-head">
        <Avatar alt="Gen.G logo" fallback="GEN" size="large" />
        <div>
          <span className="np-eyebrow">LCK · Tier 1</span>
          <h1>Gen.G</h1>
          <p>Active roster · Korea · Founded 2017</p>
        </div>
        <Button>Official Team Page</Button>
      </header>
      <div className="np-screen__content">
        <Tabs
          defaultSelectedKey="overview"
          items={[
            {
              id: "overview",
              label: "Overview",
              content: (
                <section>
                  <div className="np-screen__section-heading">
                    <div>
                      <span className="np-eyebrow">Roster</span>
                      <h2>Active players</h2>
                    </div>
                  </div>
                  <div className="np-review__frame">
                    <RosterRow
                      player={{ fullName: "Kim Gi-in", handle: "Kiin", href: "#", role: "Top" }}
                    />
                    <RosterRow
                      player={{
                        fullName: "Kim Geon-bu",
                        handle: "Canyon",
                        href: "#",
                        role: "Jungle",
                      }}
                    />
                    <RosterRow
                      player={{
                        fullName: "Jeong Ji-hoon",
                        handle: "Chovy",
                        href: "#",
                        role: "Mid",
                      }}
                    />
                    <RosterRow
                      player={{
                        fullName: "Park Jae-hyuk",
                        handle: "Ruler",
                        href: "#",
                        role: "Bot",
                      }}
                    />
                    <RosterRow
                      player={{
                        fullName: "Joo Yeong-jae",
                        handle: "Duro",
                        href: "#",
                        role: "Support",
                      }}
                    />
                  </div>
                </section>
              ),
            },
            {
              id: "matches",
              label: "Matches",
              content: (
                <ScheduleGroup dateLabel="Recent matches">
                  <MatchRow match={matchFinal} />
                  <MatchRow match={matchScheduled} />
                </ScheduleGroup>
              ),
            },
            {
              id: "statistics",
              label: "Statistics",
              content: (
                <div className="np-screen__team-grid">
                  <section>
                    <TrendChartShell
                      title="Recent form"
                      description="Gold difference at 15 across the last eight games."
                    >
                      <Sparkline
                        label="Recent Gen.G form"
                        values={[8, 12, 10, 18, 22, 19, 28, 32]}
                      />
                    </TrendChartShell>
                  </section>
                  <aside className="np-screen__aside">
                    <StatTable
                      caption="Team summary"
                      rows={[
                        { label: "Match win rate", value: "72.4%" },
                        { label: "Average game time", value: "31:42" },
                        { label: "First tower", value: "61%" },
                      ]}
                    />
                  </aside>
                </div>
              ),
            },
          ]}
          label="Team sections"
        />
      </div>
    </main>
  );
}

function AdminScreen() {
  const items = [
    { href: "/overview", icon: <Icon icon={Gauge} size="small" />, label: "Overview" },
    { href: "/providers", icon: <Icon icon={Radio} size="small" />, label: "Providers" },
    {
      meta: <MetaText tone="warning">2</MetaText>,
      href: "/ingestion",
      icon: <Icon icon={Database} size="small" />,
      label: "Ingestion",
    },
    { href: "/audit", icon: <Icon icon={FileCheck2} size="small" />, label: "Audit log" },
    { href: "/settings", icon: <Icon icon={Settings} size="small" />, label: "Settings" },
  ];
  const nav = <AdminNavigation currentHref="/providers" items={items} />;
  return (
    <>
      <div className="np-admin-screen__mobile-nav">
        <MobileAdminNavigation currentHref="/providers" items={items} />
      </div>
      <AdminShell
        actions={<Button variant="primary">Add Provider</Button>}
        navigation={nav}
        notice={
          <DataFreshnessBanner
            ageLabel="Updated 4 minutes ago"
            lastUpdated="2026-07-10T18:56:00-04:00"
            onRefresh={noop}
            provider="Live telemetry"
            state="delayed"
          />
        }
        title="Provider health"
      >
        <section>
          <div className="np-screen__section-heading">
            <div>
              <span className="np-eyebrow">Configured sources</span>
              <h2>5 providers</h2>
            </div>
            <StatusIndicator label="1 degraded" tone="warning" />
          </div>
          <ProviderHealth
            details={[
              { label: "Success rate", value: "99.98%" },
              { label: "P95 latency", value: "486ms" },
            ]}
            lastSuccess="12 seconds ago"
            name="Schedule API"
            state="healthy"
          />
          <ProviderHealth
            details={[{ label: "Freshness", value: "42s behind" }]}
            lastSuccess="2 minutes ago"
            name="Live telemetry"
            state="degraded"
          />
          <ProviderHealth name="Prediction service" state="unconfigured" />
        </section>
        <section>
          <div className="np-screen__section-heading">
            <div>
              <span className="np-eyebrow">Ingestion</span>
              <h2>Recent runs</h2>
            </div>
          </div>
          <div className="np-review__frame">
            <IngestionRunRow
              id="run_7F2A"
              onCancel={noop}
              progress={68}
              provider="Schedule API"
              startedAt="18:58:12"
              state="running"
            />
            <IngestionRunRow
              duration="42s"
              id="run_7F29"
              provider="Roster feed"
              startedAt="18:54:04"
              state="succeeded"
            />
            <IngestionRunRow
              duration="12s"
              id="run_7F28"
              onRetry={noop}
              provider="Live telemetry"
              startedAt="18:51:16"
              state="failed"
            />
          </div>
        </section>
      </AdminShell>
    </>
  );
}

const meta = {
  component: HomeScreen,
  parameters: { layout: "fullscreen" },
  title: "Reference screens",
} satisfies Meta<typeof HomeScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Home: Story = {};
export const LiveMatch: Story = { render: () => <LiveMatchScreen /> };
export const Team: Story = { render: () => <TeamScreen /> };
export const Admin: Story = { render: () => <AdminScreen /> };
