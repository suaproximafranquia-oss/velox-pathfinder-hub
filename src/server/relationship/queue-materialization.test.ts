import { describe, expect, it } from "vitest";
import { canRematerializeQueueStatus } from "./repository.server";

describe("materialização monotônica da relationship_queue", () => {
  it("permite recalcular somente uma obrigação ainda PENDING", () => {
    expect(canRematerializeQueueStatus("PENDING")).toBe(true);
  });

  it.each(["PROCESSING", "EXECUTED", "CANCELLED"])(
    "nunca rebaixa %s para PENDING durante tick ou reconciliação",
    (status) => {
      expect(canRematerializeQueueStatus(status)).toBe(false);
    },
  );
});