# Live Playback Acceptance

The browser tests cover the stream player's behavior with stand-in YouTube and Twitch players: one
player at a time, no autoplay, the playback line, and the "Watch on YouTube" and "Watch on Twitch"
links when an embed is refused or never loads. They can't prove that a real third-party broadcast
plays with sound and picture. Check that by hand during a live match, then record the result below.

## How to Check

1. Run the app (`pnpm prod` or `pnpm dev`) and open it at `http://localhost:3000`. Twitch only
   embeds on the host named in its `parent` setting, which the app sets to the page's own host.
2. On **Matches**, find a match that is live now and press **Watch Live**.
3. For each provider the match offers (choose it under **Broadcast**):
   - Press the player's own play button. Nothing plays until you do.
   - Confirm that video moves and audio is heard.
   - Under the player, the status line reads **Playing on Twitch · channel** or **Playing on
     YouTube**. Pause the player and check that it changes to **Paused**.
   - Open a second match's stream and check that the first player closes.
4. Repeat in at least one other browser: Firefox or Safari.
5. Fill in a row below. Take a screenshot of the playing player with the status line, and attach it
   to the ticket.

If a player shows **Watch on Twitch** or **Watch on YouTube** instead of playing, record that too:
the provider refused the embed or it never loaded. Note any browser extension that blocks Twitch.

## Results

| Date (UTC) | Match | Provider | Channel or Video | Browser and Version | Video | Audio | Status Line | Notes |
| ---------- | ----- | -------- | ---------------- | ------------------- | ----- | ----- | ----------- | ----- |
|            |       |          |                  |                     |       |       |             |       |
