import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type D1Binding = Parameters<typeof drizzle>[0];

declare global {
  var __ECHOQZTEST_DB__: D1Binding | undefined;
}

export function getDb() {
  const binding = globalThis.__ECHOQZTEST_DB__;
  if (!binding) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(binding, { schema });
}
