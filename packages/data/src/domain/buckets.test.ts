import { expect, it } from "vitest";
import { bucketIndex, goldBuckets, lengthBuckets, levelBuckets } from "./buckets.js";

it("places values in half-open buckets with an open last bucket", () => {
  expect(bucketIndex(19.99, lengthBuckets)).toBe(0);
  expect(bucketIndex(20, lengthBuckets)).toBe(1);
  expect(bucketIndex(39.9, lengthBuckets)).toBe(4);
  expect(bucketIndex(75, lengthBuckets)).toBe(5);
  expect(bucketIndex(-1501, goldBuckets)).toBe(0);
  expect(bucketIndex(-1500, goldBuckets)).toBe(1);
  expect(bucketIndex(0, goldBuckets)).toBe(2);
  expect(bucketIndex(499, goldBuckets)).toBe(2);
  expect(bucketIndex(500, goldBuckets)).toBe(3);
  expect(bucketIndex(4000, goldBuckets)).toBe(4);
  expect([-3, -2, -1, 0, 1, 2, 5].map((d) => bucketIndex(d, levelBuckets))).toEqual([
    0, 0, 1, 2, 3, 4, 4,
  ]);
});
