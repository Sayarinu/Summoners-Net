import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { options, replayFixture } from "./harness.js";

export async function captureFixture(names = ["frame_1.png", "frame_2.png"], width = 4) {
  const root = await mkdtemp(join(tmpdir(), "summonersnet-capture-test-"));
  const replay = join(root, "sample with spaces.rofl"),
    client = join(root, "client with spaces");
  await writeFile(replay, "constructed replay fixture");
  await writeFile(client, "fixture executable", { mode: 0o755 });
  const input = { ...options(), replay, output: join(root, "output") };
  const fixture = replayFixture();
  fixture.onRecording = async (body) => {
    if (typeof body.path !== "string") throw new Error("Expected an output path");
    const data = Buffer.alloc(width * 4 * 3);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 3;
        data[index] = x * 20;
        data[index + 1] = y * 20;
        data[index + 2] = 100;
      }
    for (const name of names)
      await sharp(data, { raw: { width, height: 4, channels: 3 } })
        .png()
        .toFile(join(body.path, name));
  };
  return { root, input, fixture, client, runtime: { platform: "win32", ...fixture.controls } };
}
