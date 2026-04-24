import { Shift, User } from "@prisma/client";
import { getGoogleAccessToken } from "@/lib/auth";

const RETRY_LIMIT = 3;
const APP_NAME = "ShiftManager";
const BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

type ShiftWithStaff = Shift & { staff: User };

interface CalendarEventBody {
  summary: string;
  description: string;
  start: { dateTime: string };
  end: { dateTime: string };
  colorId: string;
  extendedProperties: { private: Record<string, string> };
  attendees?: { email: string }[];
  sendUpdates?: string;
}

function buildEventBody(shift: ShiftWithStaff): CalendarEventBody {
  const body: CalendarEventBody = {
    summary: `[シフト] ${shift.staff.name ?? "スタッフ"} - ${shift.role}`,
    description: shift.note ?? "",
    start: { dateTime: shift.startTime.toISOString() },
    end: { dateTime: shift.endTime.toISOString() },
    colorId: roleToColorId(shift.role),
    extendedProperties: {
      private: { shiftId: shift.id, appName: APP_NAME, staffId: shift.staffId },
    },
  };
  if (shift.staff.email) {
    body.attendees = [{ email: shift.staff.email }];
    body.sendUpdates = "all";
  }
  return body;
}

async function calendarFetch(
  url: string,
  method: string,
  accessToken: string,
  body?: unknown
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`Google Calendar API error ${res.status}: ${text}`);
    err.code = res.status;
    throw err;
  }
  return res;
}

async function withRetry<T>(fn: () => Promise<T>, retries = RETRY_LIMIT): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isLast = attempt === retries;
      const retryable = err?.code === 429 || (err?.code >= 500 && err?.code < 600);
      if (isLast || !retryable) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error("Retry limit exceeded");
}

export async function createCalendarEvent(shift: ShiftWithStaff, userId: string): Promise<string> {
  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) throw new Error("No Google access token");

  return withRetry(async () => {
    const res = await calendarFetch(BASE, "POST", accessToken, buildEventBody(shift));
    const data = await res.json() as { id: string };
    return data.id;
  });
}

export async function updateCalendarEvent(
  shift: ShiftWithStaff,
  googleEventId: string,
  userId: string
): Promise<void> {
  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) throw new Error("No Google access token");

  await withRetry(() =>
    calendarFetch(`${BASE}/${googleEventId}`, "PUT", accessToken, buildEventBody(shift))
  );
}

export async function deleteCalendarEvent(googleEventId: string, userId: string): Promise<void> {
  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) throw new Error("No Google access token");

  await withRetry(() =>
    calendarFetch(`${BASE}/${googleEventId}?sendUpdates=all`, "DELETE", accessToken)
  );
}

function roleToColorId(role: string): string {
  const map: Record<string, string> = {
    マネージャー: "11",
    リーダー: "6",
    スタッフ: "1",
    アルバイト: "2",
    研修中: "5",
  };
  return map[role] ?? "1";
}
