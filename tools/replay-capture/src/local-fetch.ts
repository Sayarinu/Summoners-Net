import { request } from "node:https";

export interface ReplayRequest {
  method: "GET" | "POST";
  body?: string;
  signal?: AbortSignal | undefined;
  redirect: "error";
}
export type ReplayFetch = (url: string, options: ReplayRequest) => Promise<Response>;
export const replayOrigin = "https://127.0.0.1:2999";
const paths = new Set(["/replay/game", "/replay/playback", "/replay/render", "/replay/recording"]);
export function assertReplayUrl(value: string) {
  const url = new URL(value);
  if (
    url.origin !== replayOrigin ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !paths.has(url.pathname)
  )
    throw new Error(
      "Capture requests may only use the local Replay API at https://127.0.0.1:2999.",
    );
  return url;
}
/** Certificate trust is scoped to these fixed loopback requests; redirects are never followed. */
export function createReplayFetch(ca?: string, send: typeof request = request): ReplayFetch {
  return (value, options) =>
    new Promise((resolve, reject) => {
      const url = assertReplayUrl(value);
      const req = send(
        url,
        {
          method: options.method,
          ca,
          signal: options.signal,
          headers: { "content-type": "application/json" },
          rejectUnauthorized: true,
        },
        (response) => {
          const chunks: Buffer[] = [];
          let bytes = 0;
          response.on("data", (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > 1048576) {
              const error = new Error("Replay API response exceeds 1 MiB.");
              reject(error);
              req.destroy(error);
            } else chunks.push(chunk);
          });
          response.on("error", reject);
          response.on("end", () => {
            const status = response.statusCode ?? 500;
            if (status >= 300 && status < 400) {
              reject(new Error("Replay API redirects are not allowed."));
              return;
            }
            if (status < 200 || status > 599) {
              reject(new Error("Invalid Replay API response status."));
              return;
            }
            resolve(
              new Response(
                status === 204 || status === 205 ? null : Buffer.concat(chunks).toString("utf8"),
                { status },
              ),
            );
          });
        },
      );
      req.setTimeout(5000, () => req.destroy(new Error("Replay API request timed out.")));
      req.on("error", reject);
      req.end(options.body);
    });
}
