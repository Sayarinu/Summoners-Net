import { existsSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { database, migrate, type Executor } from "./database.js";
import { championOverview, championStats, tierList } from "./aggregates.js";
import { wpaLeaderboard } from "./wpa-leaderboards.js";
import { championBlindability, counterPickList } from "./blindability.js";
import { draftAssistant } from "./draft-assistant.js";
import { championDirectory, patchDirectory } from "./directories.js";
import { matchupPairs } from "./matchup-matrix.js";
import { championJunglePaths } from "./jungle-paths.js";
import { storedDraftLookup } from "./draft-model.js";

// Query plan budgets for the aggregate reads. The tables are seeded at a realistic size for a
// library with two years of pro data and four retained patches of solo queue, then every statement the reads run is
// checked with EXPLAIN: none may scan a large table sequentially or exceed the cost budget.
const env = new URL("../../../../.env", import.meta.url);
if (existsSync(env)) process.loadEnvFile(env);
const connection = process.env.TEST_DATABASE_URL;
if (!connection || new URL(connection).pathname !== "/esportsviewer_test")
  throw new Error("Integration tests require TEST_DATABASE_URL targeting esportsviewer_test.");
const pool = database(connection);
const largeTables = [
  "champion_aggregates",
  "champion_builds",
  "champion_buckets",
  "champion_duos",
  "pro_champion_stats",
  "wpa_aggregates",
  "blindability_scores",
  "matchup_aggregates",
  "jungle_path_clusters",
];
/** Planner cost units; the seeded reads stay well below it when an index supports them. */
const costBudget = 5000;
const now = new Date("2026-11-16T12:00:00.000Z");

beforeAll(async () => {
  await migrate(pool);
  await clear();
  const seed = (sql: string) => pool.query(sql, [now]);
  await seed(`INSERT INTO patches(patch_key,major,minor,release_order,ddragon_versions,observed_at)
    SELECT '16.'||m,16,m,m,ARRAY['16.'||m||'.1'],$1 FROM generate_series(1,24) m`);
  await seed(`INSERT INTO catalog_champions(patch_key,champion_id,champion_key,name,image,version,observed_at)
    SELECT p.patch_key,'Champ'||c,c,'Champion '||c,'Champ'||c||'.png',p.ddragon_versions[1],$1
    FROM patches p, generate_series(1,170) c`);
  const slices = `(SELECT * FROM patches WHERE minor>20) p, unnest(ARRAY['na1','euw1','kr']) region,
    unnest(ARRAY['CHALLENGER','MASTER','DIAMOND']) tier,
    generate_series(1,170) c, unnest(ARRAY['TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY']) role`;
  await seed(`INSERT INTO champion_aggregates(source,patch_key,queue,region,tier,champion_key,role,games,
      result_games,wins,bans,slice_games,win_rate,pick_rate,ban_rate,built_at)
    SELECT 'solo',p.patch_key,'420',region,tier,c,role,20+c%40,20+c%40,10+c%20,c%7,100000,
      (10+c%20)::float/(20+c%40),(20+c%40)::float/100000,(c%7)::float/100000,$1 FROM ${slices}`);
  await seed(`INSERT INTO champion_aggregates(source,patch_key,queue,region,tier,champion_key,role,games,
      result_games,wins,bans,slice_games,win_rate,pick_rate,ban_rate,built_at)
    SELECT 'pro',p.patch_key,'pro','League '||l,'PRO',c,'ALL',5+c%9,5+c%9,2+c%3,c%4,100000,
      (2+c%3)::float/(5+c%9),(5+c%9)::float/100000,(c%4)::float/100000,$1
    FROM patches p, generate_series(1,15) l, generate_series(1,170) c`);
  await seed(`INSERT INTO champion_builds(patch_key,queue,region,tier,champion_key,role,kind,build,games,
      result_games,wins,built_at)
    SELECT p.patch_key,'420',region,tier,c,role,kind,(3000+b)::text||','||(3100+b),5+b,5+b,2+b%3,$1
    FROM ${slices}, unnest(ARRAY['start','boots','path']) kind, generate_series(1,2) b`);
  await seed(`INSERT INTO champion_buckets(patch_key,queue,region,tier,champion_key,role,kind,bucket,games,
      result_games,wins,built_at)
    SELECT p.patch_key,'420',region,tier,c,role,kind,b,4+b,4+b,2,$1
    FROM ${slices}, unnest(ARRAY['length','gold15']) kind, generate_series(0,1) b`);
  await seed(`INSERT INTO champion_duos(patch_key,queue,region,tier,champion_key,role,ally_key,ally_role,
      games,result_games,wins,built_at)
    SELECT p.patch_key,'420',region,tier,c,role,1+(c*7+a)%170,'UTILITY',3+a,3+a,1+a%2,$1
    FROM ${slices}, generate_series(1,3) a WHERE role<>'UTILITY'`);
  await seed(`INSERT INTO pro_champion_stats(patch_key,league,champion_key,league_games,picks,bans,
      result_picks,wins,blue_picks,blue_result_picks,blue_wins,red_picks,red_result_picks,red_wins,
      blind_picks,counter_picks,built_at)
    SELECT p.patch_key,'League '||l,c,400,5+c%9,c%4,5+c%9,2+c%5,3,3,1,2+c%9,2+c%9,1,2,3,$1
    FROM patches p, generate_series(1,15) l, generate_series(1,170) c`);
  await seed(`INSERT INTO wp_models(kind,model_version,feature_version,patch_window,seed,train_matches,
      train_rows,eval_matches,eval_rows,coefficients,brier,bins,status,trained_at)
    SELECT 'timeline',1,1,ARRAY['16.24'],1,800,24000,200,6000,'{}',0.18,'[]',
      CASE WHEN m=3 THEN 'active' ELSE 'retired' END,$1 FROM generate_series(1,3) m`);
  await seed(`INSERT INTO wpa_aggregates(model_id,patch_key,kind,subject,games,total,built_at)
    SELECT m.id,p.patch_key,'player','puuid-'||s,1+s%30,(s%17-8)::float/10,$1
    FROM wp_models m, (SELECT * FROM patches WHERE minor>20) p, generate_series(1,3000) s`);
  await seed(`INSERT INTO blindability_scores(source,patch_key,champion_key,role,games,sampled_opponents,
      covered_opponents,covered_picks,role_picks,expected,worst_case,worst_opponent_key,variance,lower_tail,
      reason,counter_win_rate,counter_opponents,counter_picks,counter_reason,win_total,win_count,built_at)
    SELECT source,p.patch_key,c,role,200,40,30,9000,10000,0.51,0.42,1+c%170,0.002,0.46,NULL,
      CASE WHEN c%3=0 THEN NULL ELSE 0.5+(c%11)::float/100 END,c%3,(c%3)*40,
      CASE WHEN c%3=0 THEN 'never-best-response' END,100,200,$1
    FROM (SELECT * FROM patches WHERE minor>20) p, generate_series(1,170) c,
      unnest(ARRAY['TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY']) role, unnest(ARRAY['solo','pro']) source`);
  await seed(`INSERT INTO matchup_aggregates(source,patch_key,champion_key,opponent_key,role,games,metrics,built_at)
    SELECT source,p.patch_key,c,1+(c*7+o)%170,role,10+o,
      jsonb_build_object('winRate',jsonb_build_object('total',5+o%5,'count',10+o)),$1
    FROM (SELECT * FROM patches WHERE minor>20) p, generate_series(1,170) c, generate_series(1,20) o,
      unnest(ARRAY['TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY']) role, unnest(ARRAY['solo','pro']) source
    ON CONFLICT DO NOTHING`);
  await seed(`INSERT INTO jungle_path_clusters(patch_key,champion_key,start_side,route,gank_lane,games,
      result_games,wins,path_x,path_y,built_at)
    SELECT p.patch_key,c,s,r,g,5+c%20,5+c%20,2+c%7,ARRAY[3871,3783,6943],ARRAY[7901,6495,5422],$1
    FROM patches p, generate_series(1,170) c, unnest(ARRAY['blue-buff','red-buff','invade','unknown']) s,
      unnest(ARRAY['same-side','cross','invade','unknown']) r,
      unnest(ARRAY['top','mid','bot','unknown']) g`);
  await pool.query(`ANALYZE ${largeTables.join(",")},catalog_champions,patches,wp_models`);
}, 120_000);
// Leave nothing behind for the suites that share the test database.
const clear = () =>
  pool.query(`TRUNCATE ${largeTables.join(",")},wp_models,catalog_champions,patches CASCADE`);
afterAll(async () => {
  await clear();
  await pool.end();
});

interface PlanNode {
  "Node Type": string;
  "Relation Name"?: string;
  "Total Cost": number;
  Plans?: PlanNode[];
}
const nodes = (n: PlanNode): PlanNode[] => [n, ...(n.Plans ?? []).flatMap(nodes)];
/** Runs a read through a recording executor and returns each statement's plan. */
async function plans(read: (db: Executor) => Promise<unknown>) {
  const statements: { text: string; values: unknown[] }[] = [];
  const db = {
    query: (text: string, values: unknown[] = []) => {
      statements.push({ text, values });
      return pool.query(text, values);
    },
  } as unknown as Executor;
  await read(db);
  return Promise.all(
    statements.map(async (s) => {
      const explained = await pool.query<{ "QUERY PLAN": [{ Plan: PlanNode }] }>(
        `EXPLAIN (FORMAT JSON) ${s.text}`,
        s.values,
      );
      const plan = explained.rows[0]!["QUERY PLAN"][0].Plan;
      return {
        sql: s.text.replace(/\s+/g, " ").slice(0, 120),
        cost: plan["Total Cost"],
        seqScans: nodes(plan)
          .filter((n) => n["Node Type"] === "Seq Scan" && largeTables.includes(n["Relation Name"]!))
          .map((n) => n["Relation Name"]),
      };
    }),
  );
}
const reads: [string, (db: Executor) => Promise<unknown>][] = [
  ["champion statistics", (db) => championStats(db, { patch: "16.24", role: "MIDDLE" })],
  ["champion statistics, one tier", (db) => championStats(db, { patch: "16.23", tier: "MASTER" })],
  ["tier list", (db) => tierList(db, { patch: "16.24", role: "TOP" })],
  [
    "tier list, region and tier",
    (db) => tierList(db, { role: "JUNGLE", region: "kr", tier: "CHALLENGER", page: 3 }),
  ],
  ["tier list, pro", (db) => tierList(db, { source: "pro", patch: "16.24" })],
  [
    "champion overview",
    (db) => championOverview(db, { champion: "Champ42", patch: "16.24", role: "BOTTOM" }),
  ],
  [
    "champion overview, all roles",
    (db) => championOverview(db, { champion: "Champ7", region: "euw1", synergyPage: 2 }),
  ],
  [
    "champion overview, pro",
    (db) => championOverview(db, { champion: "Champ9", source: "pro", league: "League 3" }),
  ],
  ["WPA leaderboard", (db) => wpaLeaderboard(db, { kind: "player", sort: "total", page: 4 })],
  ["WPA leaderboard, champions", (db) => wpaLeaderboard(db, { patch: "16.23" })],
  ["counter-pick list", (db) => counterPickList(db, { role: "MIDDLE", page: 3 })],
  ["champion directory", (db) => championDirectory(db)],
  ["patch directory", (db) => patchDirectory(db)],
  ["matchup pairs export", (db) => matchupPairs(db, { role: "TOP", patch: "16.24", page: 4 })],
  [
    "draft assistant",
    (db) =>
      draftAssistant(db, {
        patch: "16.24",
        role: "TOP",
        blue: "Champ12:MIDDLE,Champ30:JUNGLE,Champ44",
        red: "Champ8:TOP,Champ9:BOTTOM",
        bans: "Champ1,Champ2",
      }),
  ],
  [
    "draft assistant, pro and blind",
    (db) => draftAssistant(db, { source: "pro", role: "UTILITY" }),
  ],
  [
    "draft model inputs for a role's candidates",
    (db) =>
      storedDraftLookup(
        db,
        "16.24",
        [
          ...Array.from({ length: 170 }, (_, i) => ({ championKey: i + 1, role: "TOP" as const })),
          { championKey: 3, role: "MIDDLE" },
          { championKey: 14, role: "JUNGLE" },
        ],
        [
          { championKey: 3, role: "MIDDLE" },
          { championKey: 14, role: "JUNGLE" },
          { championKey: 27, role: "TOP" },
        ],
      ),
  ],
  [
    "counter-pick list, pro by score",
    (db) => counterPickList(db, { role: "TOP", source: "pro", patch: "16.23", sort: "score" }),
  ],
  ["champion jungle paths", (db) => championJunglePaths(db, { championKey: 64, patch: "16.24" })],
  [
    "champion blindability",
    (db) =>
      championBlindability(db, { championKey: 42, source: "solo", patch: "16.24", role: "TOP" }),
  ],
];

it.each(reads)("%s stays within the plan budget on large aggregate tables", async (_, read) => {
  const results = await plans(read);
  expect(results.length).toBeGreaterThan(0);
  for (const r of results) {
    expect(r.seqScans, r.sql).toEqual([]);
    expect(r.cost, r.sql).toBeLessThanOrEqual(costBudget);
  }
});
