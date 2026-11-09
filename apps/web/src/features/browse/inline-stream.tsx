import type { Broadcast } from "@summonersnet/data";
import { WatchPlayer } from "../watch/player";

export function InlineMatchStream({ broadcasts, id }: { broadcasts: Broadcast[]; id: string }) {
  return (
    <div className="ev-inline-stream" id={id}>
      <WatchPlayer
        broadcasts={broadcasts}
        defaultProvider="twitch"
        showHeading={false}
        showPlayerActions={false}
        showPreConsentLink={false}
      />
    </div>
  );
}
