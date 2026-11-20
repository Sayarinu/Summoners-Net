import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage } from "node:http";
import type { request, RequestOptions } from "node:https";
import { expect, it } from "vitest";
import { assertReplayUrl, createReplayFetch, replayOrigin } from "./local-fetch.js";

function transport(mode = "ok", status: number | null = 200) {
  const calls: { url: URL; options: RequestOptions; body: string | undefined }[] = [];
  const send = ((
    url: URL,
    options: RequestOptions,
    receive: (response: IncomingMessage) => void,
  ) => {
    const response = new EventEmitter() as IncomingMessage;
    if (status !== null) response.statusCode = status;
    let timeout = () => {};
    const req = new EventEmitter() as ClientRequest;
    req.setTimeout = (_ms: number, callback?: () => void) => {
      timeout = callback!;
      return req;
    };
    req.destroy = (error?: Error) => {
      req.emit("error", error);
      return req;
    };
    req.end = ((body?: string) => {
      calls.push({ url, options, body });
      queueMicrotask(() => {
        if (mode === "timeout") {
          timeout();
          return;
        }
        if (mode === "network") {
          req.emit("error", new Error("connection refused"));
          return;
        }
        receive(response);
        if (mode === "response-error") {
          response.emit("error", new Error("response failed"));
          return;
        }
        response.emit("data", mode === "oversized" ? Buffer.alloc(1048577) : Buffer.from("{}"));
        response.emit("end");
      });
      return req;
    }) as ClientRequest["end"];
    return req;
  }) as typeof request;
  return { send, calls };
}

it("allows only fixed local replay endpoints and rejects redirects", async () => {
  for (const path of ["game", "playback", "render", "recording"])
    expect(assertReplayUrl(replayOrigin + "/replay/" + path).hostname).toBe("127.0.0.1");
  for (const url of [
    "http://127.0.0.1:2999/replay/game",
    "https://example.com/replay/game",
    "https://127.0.0.1:3000/replay/game",
    "https://user@127.0.0.1:2999/replay/game",
    replayOrigin + "/replay/game?x=1",
    replayOrigin + "/replay/game#x",
    replayOrigin + "/liveclientdata/allgamedata",
  ]) {
    const t = transport();
    await expect(
      createReplayFetch(undefined, t.send)(url, { method: "GET", redirect: "error" }),
    ).rejects.toThrow("local Replay API");
    expect(t.calls).toEqual([]);
  }
  await expect(
    createReplayFetch(undefined, transport("ok", 302).send)(replayOrigin + "/replay/game", {
      method: "GET",
      redirect: "error",
    }),
  ).rejects.toThrow("redirects");
});
it("scopes certificate trust, sends JSON and preserves HTTP status without disabling TLS", async () => {
  const t = transport();
  const response = await createReplayFetch("test CA", t.send)(replayOrigin + "/replay/playback", {
    method: "POST",
    body: '{"paused":true}',
    redirect: "error",
  });
  expect(await response.json()).toEqual({});
  expect(t.calls[0]).toMatchObject({
    body: '{"paused":true}',
    options: {
      ca: "test CA",
      rejectUnauthorized: true,
      headers: { "content-type": "application/json" },
    },
  });
  const empty = await createReplayFetch(undefined, transport("ok", 204).send)(
    replayOrigin + "/replay/game",
    { method: "GET", redirect: "error" },
  );
  expect(await empty.text()).toBe("");
  const failed = await createReplayFetch(undefined, transport("ok", null).send)(
    replayOrigin + "/replay/game",
    { method: "GET", redirect: "error" },
  );
  expect(failed.status).toBe(500);
});
it("bounds response bytes and propagates network, stream and timeout errors", async () => {
  for (const mode of ["oversized", "network", "response-error", "timeout"])
    await expect(
      createReplayFetch(undefined, transport(mode).send)(replayOrigin + "/replay/game", {
        method: "GET",
        redirect: "error",
      }),
    ).rejects.toThrow();
  await expect(
    createReplayFetch(undefined, transport("ok", 199).send)(replayOrigin + "/replay/game", {
      method: "GET",
      redirect: "error",
    }),
  ).rejects.toThrow("Invalid");
});
