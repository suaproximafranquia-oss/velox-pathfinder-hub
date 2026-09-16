import { describe, expect, it } from "vitest";
import { canRematerializeQueueStatus } from "./repository.server";

describe("materialização monotônica da relationship_queue", () => {
  it("permite recalcular uma obrigação PENDING ou antes neutralizada", () => {
    expect(canRematerializeQueueStatus("PENDING")).toBe(true);
    expect(canRematerializeQueueStatus("CANCELLED")).toBe(true);
  });

  it.each(["PROCESSING", "EXECUTED"])(
    "nunca rebaixa %s para PENDING durante tick ou reconciliação",
    (status) => {
      expect(canRematerializeQueueStatus(status)).toBe(false);
    },
  );
});