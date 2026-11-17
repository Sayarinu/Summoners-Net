import type { Match } from "@summonersnet/data";
import { WatchPlayer, watchableBroadcasts } from "../watch/player";

export function InlineMatchStream({ match, id }: { match: Match; id: string }) {
  const replay = match.state === "final";
  return (
    <div className="ev-inline-stream" id={id}>
      <WatchPlayer
        broadcasts={watchableBroadcasts(match)}
        defaultProvider={replay ? "youtube" : "twitch"}
        mode={replay ? "replay" : "live"}
        showHeading={false}
        showPlayerActions={false}
      />
    </div>
  );
}
