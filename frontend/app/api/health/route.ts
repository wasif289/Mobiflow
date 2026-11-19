import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const result = await db.query("SELECT NOW() AS current_time");
    return NextResponse.json({
      ok: true,
      dbTime: result.rows[0]?.current_time,
    });
  } catch (error) {
    console.error("Supabase DB Error:", error);
    return NextResponse.json(
      { ok: false, error: "Database connection failed" },
      { status: 500 },
    );
  }
}
