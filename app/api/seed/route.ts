import { NextResponse } from "next/server";
import { countByStatus, seedTasks, totalEstimate } from "@/lib/seed-data";

export async function GET() {
  return NextResponse.json({
    total: seedTasks.length,
    todo: countByStatus("todo"),
    doing: countByStatus("doing"),
    done: countByStatus("done"),
    totalEstimateHours: totalEstimate(),
  });
}
