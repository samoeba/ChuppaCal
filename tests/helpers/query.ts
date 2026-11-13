import { vi } from "vitest";

/** A promise-like query double. Tests also assert the filters and writes applied. */
export function query(data: unknown = null, error: { message: string; code?: string } | null = null) {
  const result = Promise.resolve({ data, error });
  return {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(), range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(), returns: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnValue(result), maybeSingle: vi.fn().mockReturnValue(result),
    then: result.then.bind(result),
  };
}
