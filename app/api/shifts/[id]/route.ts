import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/google-calendar";
import { notifyShiftChange } from "@/lib/notifications";

const updateShiftSchema = z.object({
  staffId: z.string().min(1).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  role: z.string().min(1).optional(),
  note: z.string().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateShiftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const updated = await prisma.shift.update({
    where: { id },
    data: {
      ...(data.staffId && { staffId: data.staffId }),
      ...(data.startTime && { startTime: new Date(data.startTime) }),
      ...(data.endTime && { endTime: new Date(data.endTime) }),
      ...(data.role && { role: data.role }),
      ...(data.note !== undefined && { note: data.note }),
      syncStatus: "PENDING",
    },
    include: { staff: true },
  });

  let syncStatus: "SYNCED" | "FAILED" = "SYNCED";

  try {
    if (updated.googleEventId) {
      await updateCalendarEvent(updated, updated.googleEventId, session.user.id);
    }
  } catch (error) {
    console.error("GCal update failed:", error);
    syncStatus = "FAILED";
  }

  await prisma.shift.update({ where: { id }, data: { syncStatus } });
  await prisma.calendarSyncLog.create({
    data: {
      shiftId: id,
      userId: session.user.id,
      action: "UPDATE",
      status: syncStatus,
      error: syncStatus === "FAILED" ? "GCal update failed" : null,
    },
  });

  notifyShiftChange({ ...updated, syncStatus }, "updated").catch(console.error);

  return NextResponse.json({ ...updated, syncStatus });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shift = await prisma.shift.findUnique({
    where: { id },
    include: { staff: true },
  });
  if (!shift) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let syncStatus: "SYNCED" | "FAILED" = "SYNCED";

  if (shift.googleEventId) {
    try {
      await deleteCalendarEvent(shift.googleEventId, session.user.id);
    } catch (error) {
      console.error("GCal delete failed:", error);
      syncStatus = "FAILED";
    }
  }

  await prisma.calendarSyncLog.create({
    data: {
      shiftId: id,
      userId: session.user.id,
      action: "DELETE",
      status: syncStatus,
      error: syncStatus === "FAILED" ? "GCal delete failed" : null,
    },
  });

  notifyShiftChange(shift, "deleted").catch(console.error);

  await prisma.shift.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
