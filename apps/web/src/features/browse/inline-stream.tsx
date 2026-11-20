import type { Match } from "@summonersnet/data";
import { WatchPlayer, watchableBroadcasts } from "../watch/player";

export function InlineMatchStream({ match, id }: { match: Match; id: string }) {
  const replay = match.state === "final";
  return (
    <div className="w-full border-t border-line bg-raised pt-4 pb-2" id={id}>
      <WatchPlayer
        broadcasts={watchableBroadcasts(match)}
        defaultProvider={replay ? "youtube" : "twitch"}
        mode={replay ? "replay" : "live"}
        showHeading={false}
        beside
      />
    </div>
  );
}
