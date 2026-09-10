import { expect, it } from "vitest";
import { belongsToReentryCycle, reentryInternalOrder, reentryQueueOrder } from "./reentry-cycle";

it("RE mantém ordens internas e separa cada ciclo sem sobrescrever histórico", () => {
  for (const step of ["RE0", "RE1", "RE2", "RE3"]) {
    for (const order of [1, 2, 3]) {
      const encoded = reentryQueueOrder(2, order);
      expect(reentryInternalOrder(step, encoded)).toBe(order);
      expect(belongsToReentryCycle(step, encoded, 2)).toBe(true);
      expect(belongsToReentryCycle(step, encoded, 1)).toBe(false);
      expect(belongsToReentryCycle(step, order, 2)).toBe(false);
    }
  }
  expect(reentryInternalOrder("E0", 2)).toBe(2);
  expect(reentryInternalOrder("RF0", 1)).toBe(1);
  expect(belongsToReentryCycle("E0", 201, 2)).toBe(false);
});