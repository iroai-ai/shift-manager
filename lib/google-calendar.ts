import { google } from "googleapis";
import { Shift, User } from "@prisma/client";
import { getGoogleAccessToken } from "@/lib/auth";

const RETRY_LIMIT = 3;
const APP_NAME = "ShiftManager";

type ShiftWithStaff = Shift & { staff: User };

function buildCalendarClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
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

  const calendar = buildCalendarClient(accessToken);

  return withRetry(async () => {
    const event = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: `[シフト] ${shift.staff.name ?? "スタッフ"} - ${shift.role}`,
        description: shift.note ?? "",
        start: { dateTime: shift.startTime.toISOString() },
        end: { dateTime: shift.endTime.toISOString() },
        colorId: roleToColorId(shift.role),
        extendedProperties: {
          private: {
            shiftId: shift.id,
            appName: APP_NAME,
            staffId: shift.staffId,
          },
        },
        ...(shift.staff.email
          ? {
              attendees: [{ email: shift.staff.email }],
              sendUpdates: "all",
            }
          : {}),
      },
    });

    return event.data.id!;
  });
}

export async function updateCalendarEvent(
  shift: ShiftWithStaff,
  googleEventId: string,
  userId: string
): Promise<void> {
  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) throw new Error("No Google access token");

  const calendar = buildCalendarClient(accessToken);

  await withRetry(() =>
    calendar.events.update({
      calendarId: "primary",
      eventId: googleEventId,
      requestBody: {
        summary: `[シフト] ${shift.staff.name ?? "スタッフ"} - ${shift.role}`,
        description: shift.note ?? "",
        start: { dateTime: shift.startTime.toISOString() },
        end: { dateTime: shift.endTime.toISOString() },
        colorId: roleToColorId(shift.role),
        extendedProperties: {
          private: {
            shiftId: shift.id,
            appName: APP_NAME,
            staffId: shift.staffId,
          },
        },
        ...(shift.staff.email
          ? {
              attendees: [{ email: shift.staff.email }],
              sendUpdates: "all",
            }
          : {}),
      },
    })
  );
}

export async function deleteCalendarEvent(googleEventId: string, userId: string): Promise<void> {
  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) throw new Error("No Google access token");

  const calendar = buildCalendarClient(accessToken);

  await withRetry(() =>
    calendar.events.delete({
      calendarId: "primary",
      eventId: googleEventId,
      sendUpdates: "all",
    })
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
