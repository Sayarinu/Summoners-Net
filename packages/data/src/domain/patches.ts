// One patch key ("major.minor", unpadded) links the patch strings of every source:
// - Data Dragon versions such as "15.21.1" (and legacy "4.1.2");
// - Riot match versions such as "15.21.715.4285";
// - Oracle's Elixir patches such as "15.21" or "16.01" (zero-padded minor);
// - Riot's year-based labels from 2025 onwards, such as "25.21", which is patch 15.21.
// Anything else ("25.S1.1", "lolpatch_7.20", "0.151.2", "") is unparseable and returns null.
export interface PatchKey {
  key: string;
  major: number;
  minor: number;
}
// Year-based labels started at 25 (2025), when the game's major version was 15.
const firstYearLabel = 25;
const yearLabelOffset = 10;
export function normalizePatch(input: string | null | undefined): PatchKey | null {
  const match = input?.trim().match(/^(\d{1,2})\.(\d{1,2})((?:\.\d+){0,2})$/);
  if (!match) return null;
  let major = Number(match[1]);
  const minor = Number(match[2]);
  // Year-based labels are only ever two parts; versions with a build part are game majors.
  if (major >= firstYearLabel && !match[3]) major -= yearLabelOffset;
  if (major < 1 || minor < 1) return null;
  return { key: `${major}.${minor}`, major, minor };
}
export const comparePatches = (a: PatchKey, b: PatchKey) => a.major - b.major || a.minor - b.minor;
