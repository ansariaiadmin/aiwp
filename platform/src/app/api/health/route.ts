import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Health-check endpoint for Docker HEALTHCHECK / load balancers. Verifies
 * the process is up AND the database is reachable, so an orchestrator
 * never routes traffic to an instance that can't actually serve requests.
 */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok", time: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "unknown" },
      { status: 503 },
    );
  }
}
