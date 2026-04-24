export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createCalendarEvent } from "@/lib/google-calendar";
import { notifyShiftChange } from "@/lib/notifications";

const createShiftSchema = z.object({
  staffId: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  role: z.string().min(1),
  note: z.string().optional(),
  patternId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createShiftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { staffId, startTime, endTime, role, note, patternId } = parsed.data;

  // 1. DBにシフト保存 (sync_status: PENDING)
  const shift = await prisma.shift.create({
    data: {
      staffId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      role,
      note,
      patternId,
      syncStatus: "PENDING",
    },
    include: { staff: true },
  });

  // 2. GCalにイベント作成
  let googleEventId: string | null = null;
  let syncStatus: "SYNCED" | "FAILED" = "SYNCED";

  try {
    googleEventId = await createCalendarEvent(shift, session.user.id);
  } catch (error) {
    console.error("GCal create failed:", error);
    syncStatus = "FAILED";
  }

  // 3. DBを更新
  const updated = await prisma.shift.update({
    where: { id: shift.id },
    data: { googleEventId, syncStatus },
    include: { staff: true },
  });

  // 4. 同期ログ
  await prisma.calendarSyncLog.create({
    data: {
      shiftId: shift.id,
      userId: session.user.id,
      action: "CREATE",
      status: syncStatus,
      error: syncStatus === "FAILED" ? "GCal create failed" : null,
    },
  });

  // 5. メール通知
  notifyShiftChange(updated, "created").catch(console.error);

  return NextResponse.json(updated, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const staffId = searchParams.get("staffId");

  const shifts = await prisma.shift.findMany({
    where: {
      ...(start && end
        ? {
            startTime: { gte: new Date(start) },
            endTime: { lte: new Date(end) },
          }
        : {}),
      ...(staffId ? { staffId } : {}),
    },
    include: { staff: true },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json(shifts);
}
