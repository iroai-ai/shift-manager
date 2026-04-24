import { Resend } from "resend";
import { Shift, User } from "@prisma/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@example.com";

type ShiftWithStaff = Shift & { staff: User };
type NotifyAction = "created" | "updated" | "deleted";

const actionLabel: Record<NotifyAction, string> = {
  created: "登録",
  updated: "更新",
  deleted: "削除",
};

export async function notifyShiftChange(
  shift: ShiftWithStaff,
  action: NotifyAction
): Promise<void> {
  const staff = shift.staff;
  if (!staff.email) return;

  const enabled =
    (action === "created" && staff.notifyOnCreate) ||
    (action === "updated" && staff.notifyOnUpdate) ||
    (action === "deleted" && staff.notifyOnDelete);

  if (!enabled) return;

  const dateStr = format(shift.startTime, "yyyy年MM月dd日(E)", { locale: ja });
  const startStr = format(shift.startTime, "HH:mm");
  const endStr = format(shift.endTime, "HH:mm");
  const label = actionLabel[action];

  try {
    await resend.emails.send({
      from: FROM,
      to: staff.email,
      subject: `【シフト${label}】${dateStr} ${startStr}〜${endStr}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">シフト${label}のお知らせ</h2>
          <p>${staff.name ?? "スタッフ"} さんのシフトが${label}されました。</p>
          <table style="border-collapse: collapse; width: 100%;">
            <tr>
              <th style="text-align:left; padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">日付</th>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${dateStr}</td>
            </tr>
            <tr>
              <th style="text-align:left; padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">時間</th>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${startStr} 〜 ${endStr}</td>
            </tr>
            <tr>
              <th style="text-align:left; padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">役割</th>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${shift.role}</td>
            </tr>
            ${shift.note ? `<tr>
              <th style="text-align:left; padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">メモ</th>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${shift.note}</td>
            </tr>` : ""}
          </table>
          <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
            このメールはシフト管理システムから自動送信されています。
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send notification email:", error);
  }
}
