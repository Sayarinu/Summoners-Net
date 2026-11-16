import { parseArgs } from "node:util";
import { z } from "zod";

const path = z
  .string()
  .min(1)
  .max(4096)
  .refine((s) => !s.includes("\0"), "Path contains a null byte.");
export const captureOptionsSchema = z
  .strictObject({
    replay: path,
    client: path.optional(),
    attach: z.boolean().default(false),
    output: path,
    ca: path.optional(),
    start: z.number().min(0).max(7200),
    end: z.number().min(0).max(7200),
    sampleRate: z.number().int().min(1).max(10).default(5),
    speed: z.number().int().min(1).max(8).default(1),
    width: z.number().int().min(1).max(16384),
    height: z.number().int().min(1).max(16384),
    crop: z.tuple([
      z.number().int().min(0),
      z.number().int().min(0),
      z.number().int().positive(),
      z.number().int().positive(),
    ]),
    timeoutMs: z.number().int().min(100).max(120000).default(30000),
  })
  .superRefine((o, ctx) => {
    const error = (message: string) => ctx.addIssue({ code: "custom", message });
    if (o.end <= o.start) error("End time must be later than start time.");
    if (!o.replay.toLowerCase().endsWith(".rofl")) error("Replay path must end in .rofl.");
    if (!o.attach && !o.client)
      error("Provide --client or use --attach after opening the replay in League.");
    if (o.attach && o.client) error("Use either --client or --attach.");
    if (o.crop[0] + o.crop[2] > o.width || o.crop[1] + o.crop[3] > o.height)
      error("Minimap crop must fit inside the requested frame dimensions.");
  });
export type CaptureOptions = z.infer<typeof captureOptionsSchema>;

export function parseCaptureArgs(args: string[]) {
  const number = (value: string | undefined) => (value?.trim() ? Number(value) : NaN);
  const { values } = parseArgs({
    args,
    allowPositionals: false,
    options: {
      replay: { type: "string" },
      client: { type: "string" },
      attach: { type: "boolean" },
      output: { type: "string" },
      ca: { type: "string" },
      start: { type: "string" },
      end: { type: "string" },
      rate: { type: "string", default: "5" },
      speed: { type: "string", default: "1" },
      width: { type: "string" },
      height: { type: "string" },
      crop: { type: "string" },
      timeout: { type: "string", default: "30000" },
    },
  });
  return captureOptionsSchema.parse({
    replay: values.replay,
    client: values.client,
    attach: values.attach,
    output: values.output,
    ca: values.ca,
    start: number(values.start),
    end: number(values.end),
    sampleRate: number(values.rate),
    speed: number(values.speed),
    width: number(values.width),
    height: number(values.height),
    crop: values.crop?.split(",").map(number),
    timeoutMs: number(values.timeout),
  });
}
