import { it, expect } from "vitest";
import { imageAddress, readImage } from "./images.js";
it("limits images to the public PandaScore CDN without credentials or redirects", () => {
  expect(imageAddress("https://cdn-api.pandascore.co/images/player.png")).toContain("player.png");
  for (const url of [
    "http://cdn-api.pandascore.co/a",
    "https://cdn-api.pandascore.co.evil.test/a",
    "https://localhost/a",
    "https://token@cdn-api.pandascore.co/a",
    "https://cdn-api.pandascore.co:444/a",
    "not a URL",
  ])
    expect(() => imageAddress(url)).toThrow();
});
it("checks bytes and MIME, rejects HTML/SVG, and bounds streamed responses", async () => {
  for (const [header, bytes] of [
    [
      "image/png",
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGNomrgAK2IYWhIAdr5swVmNv80AAAAASUVORK5CYII=",
        "base64",
      ),
    ],
    ["image/jpeg", Buffer.from([255, 216, 255])],
    ["image/gif", Buffer.from("GIF89a")],
    ["image/webp", Buffer.from("RIFF1234WEBP")],
  ] as const) {
    const result = await readImage(new Response(bytes, { headers: { "content-type": header } }));
    expect(result.mime).toBe(header);
    expect(result.hash).toHaveLength(64);
  }
  for (const response of [
    new Response("not found", { status: 404 }),
    new Response(null),
    new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } }),
    new Response("GIF89a", { headers: { "content-type": "image/png" } }),
    new Response("bad", { headers: { "content-length": "3145729" } }),
    new Response(new Uint8Array(3145729)),
  ])
    await expect(readImage(response)).rejects.toThrow();
});

it("rejects corrupt or truncated PNG chunks that stricter browsers cannot display", async () => {
  const good = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGNomrgAK2IYWhIAdr5swVmNv80AAAAASUVORK5CYII=",
    "base64",
  );
  const bad = Buffer.from(good);
  bad[good.length - 15] = 0;
  const wide = Buffer.from(good);
  wide.writeUInt32BE(9000, 16);
  const zero = Buffer.from(good);
  zero.writeUInt32BE(0, 20);
  const noData = Buffer.concat([good.subarray(0, 33), good.subarray(-12)]);
  const invalid = [
    bad,
    wide,
    zero,
    noData,
    good.subarray(0, 8),
    good.subarray(0, -12),
    good.subarray(0, -5),
    Buffer.concat([good, Buffer.from("trailing")]),
  ];
  for (const bytes of invalid)
    await expect(
      readImage(new Response(bytes, { headers: { "content-type": "image/png" } })),
    ).rejects.toThrow("integrity");
});
