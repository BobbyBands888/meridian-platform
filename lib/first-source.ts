import "server-only";
import { cookies } from "next/headers";
import { externalSource, FIRST_SOURCE_COOKIE } from "@/lib/attribution";

/** The visitor's first outside ?s= value from the attribution cookie, for Server Actions. Null when there isn't one. */
export async function readFirstSource(): Promise<string | null> {
  return externalSource((await cookies()).get(FIRST_SOURCE_COOKIE)?.value);
}
