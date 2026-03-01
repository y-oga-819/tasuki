import { describe, it, expect, vi } from "vitest";
import { withTimeout } from "../hooks/useAsyncAction";

describe("withTimeout", () => {
  it("resolves when action completes before timeout", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 1000);
    expect(result).toBe("ok");
  });

  it("rejects when action exceeds timeout", async () => {
    vi.useFakeTimers();

    const slow = new Promise<string>((resolve) => {
      setTimeout(() => resolve("late"), 5000);
    });

    const promise = withTimeout(slow, 100);
    vi.advanceTimersByTime(200);

    await expect(promise).rejects.toThrow("Timeout after 100ms");

    vi.useRealTimers();
  });

  it("rejects when action itself rejects", async () => {
    const failing = Promise.reject(new Error("boom"));
    await expect(withTimeout(failing, 1000)).rejects.toThrow("boom");
  });
});
