import "server-only";

import { STORAGE_DRIVER } from "@/lib/server/env";
import type { StoreDriver } from "@/lib/store/driver";

let pending: Promise<StoreDriver> | null = null;

/** يختار محرّك التخزين حسب STORAGE_DRIVER (firebase للإنتاج، local للتطوير). */
export function getDriver(): Promise<StoreDriver> {
  if (!pending) {
    pending = (async () => {
      if (STORAGE_DRIVER === "firebase") {
        const { FirebaseDriver } = await import("@/lib/store/firebase-driver");
        return new FirebaseDriver();
      }
      const { LocalDriver } = await import("@/lib/store/local-driver");
      return new LocalDriver();
    })();
  }
  return pending;
}

export type { StoreDriver };
