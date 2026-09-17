import { ExternalLink, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  CompetitionIdentity,
  DateRail,
  EventHeader,
  MatchCard,
  MatchRow,
  PlayerIdentity,
  RosterRow,
  ScheduleGroup,
  StandingsTable,
  TeamIdentity,
} from "./esports.js";
import type { MatchDisplay } from "./esports.js";
import { Icon } from "./internal.js";
import { Button, IconButton } from "./primitives.js";
import "./review.stories.css";

const scheduled: MatchDisplay = {
  bestOf: 3,
  competition: "Worlds 2026 · Swiss",
  href: "#match",
  id: "match-1",
  lifecycle: "scheduled",
  scheduledLabel: "Today · 18:00 EDT",
  streamAvailable: true,
  teams: [
    { name: "Gen.G", shortName: "GEN" },
    { name: "Bilibili Gaming", shortName: "BLG" },
  ],
};

const live: MatchDisplay = {
  ...scheduled,
  id: "match-2",
  lifecycle: "live",
  scheduledLabel: "Game 2 · 24:18",
  teams: [
    { name: "T1", score: 1, shortName: "T1" },
    { name: "G2 Esports", score: 0, shortName: "G2" },
  ],
};

const final: MatchDisplay = {
  ...scheduled,
  id: "match-3",
  lifecycle: "final",
  scheduledLabel: "Final · Yesterday",
  teams: [
    { name: "Hanwha Life Esports", score: 2, shortName: "HLE", winner: true },
    { name: "FlyQuest", score: 1, shortName: "FLY" },
  ],
};

function PublicEsportsGallery() {
  const [date, setDate] = useState("jul-10");

  return (
    <main className="np-review">
      <div className="np-review__inner">
        <header className="np-review__masthead">
          <div>
            <span className="np-eyebrow">Esports / 01</span>
            <h1>Schedule & identity</h1>
          </div>
          <p>
            Competition information remains readable at live-match density and independent of
            provider assets.
          </p>
        </header>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">Identities</span>
            <h2>Competition, team, player</h2>
          </header>
          <div className="np-review__grid">
            <div className="np-review__stage">
              <CompetitionIdentity
                name="League of Legends Champions Korea"
                region="Korea"
                shortName="LCK"
                tier="Tier 1"
              />
            </div>
            <div className="np-review__stage">
              <TeamIdentity detail="LCK · Seed 1" name="Gen.G" shortName="GEN" />
            </div>
            <div className="np-review__stage">
              <PlayerIdentity country="Korea" fullName="Jeong Ji-hoon" handle="Chovy" role="Mid" />
            </div>
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">MatchRow</span>
            <h2>Every match lifecycle</h2>
          </header>
          <div className="np-review__frame">
            <MatchRow
              actions={
                <IconButton
                  icon={<Icon icon={MoreHorizontal} size="small" />}
                  label="Match actions"
                  size="compact"
                  variant="ghost"
                />
              }
              match={scheduled}
            />
            <MatchRow match={live} />
            <MatchRow match={final} />
            <MatchRow
              match={{
                ...scheduled,
                id: "match-4",
                lifecycle: "postponed",
                scheduledLabel: "Time to be confirmed",
              }}
            />
            <MatchRow
              match={{
                ...scheduled,
                id: "match-5",
                lifecycle: "cancelled",
                scheduledLabel: "Cancelled by organizer",
              }}
            />
            <MatchRow match={final} spoilerHidden />
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">MatchCard</span>
            <h2>Featured and responsive</h2>
          </header>
          <div className="np-review__grid">
            <MatchCard match={scheduled} />
            <MatchCard match={live} />
            <MatchCard match={final} spoilerHidden />
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">DateRail + ScheduleGroup</span>
            <h2>Schedule composition</h2>
          </header>
          <div className="np-review__stack">
            <DateRail
              items={[
                { count: 3, day: "Wed", id: "jul-8", label: "Jul 8" },
                { count: 6, day: "Thu", id: "jul-9", label: "Jul 9" },
                { count: 5, day: "Fri", id: "jul-10", label: "Jul 10", today: true },
                { count: 8, day: "Sat", id: "jul-11", label: "Jul 11" },
                { count: 4, day: "Sun", id: "jul-12", label: "Jul 12" },
              ]}
              onChange={setDate}
              selectedId={date}
            />
            <ScheduleGroup
              count={3}
              dateLabel="Friday, July 10"
              description="Times shown in America/New_York"
            >
              <MatchRow match={live} />
              <MatchRow match={scheduled} />
              <MatchRow
                match={{
                  ...scheduled,
                  id: "match-6",
                  scheduledLabel: "21:00 EDT",
                  teams: [
                    { name: "KT Rolster", shortName: "KT" },
                    { name: "Movistar KOI", shortName: "MKOI" },
                  ],
                }}
              />
            </ScheduleGroup>
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">EventHeader</span>
            <h2>Event context</h2>
          </header>
          <div className="np-review__frame">
            <EventHeader
              actions={
                <Button endIcon={<Icon icon={ExternalLink} size="small" />}>Official Site</Button>
              }
              dates="September 24 — November 7"
              format="Swiss + knockout"
              name="World Championship 2026"
              region="International"
              shortName="W26"
              status="live"
              tier="Tier 1"
            />
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">RosterRow</span>
            <h2>Roster states</h2>
          </header>
          <div className="np-review__frame">
            <RosterRow
              actions={
                <IconButton
                  icon={<Icon icon={MoreHorizontal} size="small" />}
                  label="Player actions"
                  size="compact"
                  variant="ghost"
                />
              }
              detail="71.4% win rate · 5.8 KDA"
              player={{ handle: "Kiin", role: "Top" }}
              status="starter"
            />
            <RosterRow
              detail="67.4% win rate · 6.2 KDA"
              player={{ handle: "Canyon", role: "Jungle" }}
              status="starter"
            />
            <RosterRow
              detail="Substitute roster"
              player={{ handle: "About", role: "Support" }}
              status="substitute"
            />
            <RosterRow
              detail="Strategic staff"
              player={{ handle: "KIM", role: "Head coach" }}
              status="coach"
            />
          </div>
        </section>

        <section className="np-review__section">
          <header className="np-review__section-header">
            <span className="np-eyebrow">StandingsTable</span>
            <h2>Qualification is textual</h2>
          </header>
          <StandingsTable
            caption="Worlds 2026 Swiss standings"
            rows={[
              {
                id: "gen",
                losses: 0,
                points: 9,
                position: 1,
                qualified: true,
                team: { name: "Gen.G", shortName: "GEN" },
                wins: 3,
              },
              {
                id: "t1",
                losses: 1,
                points: 6,
                position: 2,
                qualified: true,
                team: { name: "T1", shortName: "T1" },
                wins: 3,
              },
              {
                form: "W · L · W",
                id: "blg",
                losses: 1,
                points: 4,
                position: 3,
                team: { name: "Bilibili Gaming", shortName: "BLG" },
                wins: 2,
              },
              {
                form: "L · W · L",
                id: "g2",
                losses: 2,
                points: 2,
                position: 4,
                team: { name: "G2 Esports", shortName: "G2" },
                wins: 1,
              },
            ]}
          />
        </section>
      </div>
    </main>
  );
}

const meta = {
  component: PublicEsportsGallery,
  parameters: { layout: "fullscreen" },
  title: "Esports/01 Schedule and identity",
} satisfies Meta<typeof PublicEsportsGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
