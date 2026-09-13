import { describe, expect, it } from "vitest";
import { getModels, models } from "./models";

describe("model catalog", () => {
  it("contains all three model kinds", () => {
    expect(new Set(models.map((model) => model.kind))).toEqual(new Set(["text", "image", "video"]));
  });
  it("places free offers before paid and unknown models", () => {
    for (const kind of ["text", "image", "video"] as const) {
      const statuses = getModels(kind).map((model) => model.priceStatus);
      const firstPaid = statuses.findIndex((status) => status === "paid" || status === "unknown");
      if (firstPaid >= 0) expect(statuses.slice(firstPaid)).not.toContain("free");
    }
  });
  it("gives every model a direct docs link", () => {
    expect(models.every((model) => model.docsUrl.startsWith("https://agnes-ai.com/"))).toBe(true);
  });
});
