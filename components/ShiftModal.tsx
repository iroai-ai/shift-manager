"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

interface Staff {
  id: string;
  name: string | null;
  color: string;
}

interface Shift {
  id: string;
  staffId: string;
  startTime: string;
  endTime: string;
  role: string;
  note?: string | null;
}

interface Props {
  open: boolean;
  defaultStart?: Date;
  editShift?: Shift;
  staff: Staff[];
  onClose: (saved?: boolean) => void;
}

const ROLES = ["スタッフ", "アルバイト", "リーダー", "マネージャー", "研修中"];

function toLocalDatetime(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function ShiftModal({ open, defaultStart, editShift, staff, onClose }: Props) {
  const [staffId, setStaffId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [role, setRole] = useState(ROLES[0]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);

    if (editShift) {
      setStaffId(editShift.staffId);
      setStartTime(toLocalDatetime(new Date(editShift.startTime)));
      setEndTime(toLocalDatetime(new Date(editShift.endTime)));
      setRole(editShift.role);
      setNote(editShift.note ?? "");
    } else {
      setStaffId(staff[0]?.id ?? "");
      const start = defaultStart ?? new Date();
      const end = new Date(start.getTime() + 8 * 3600_000);
      setStartTime(toLocalDatetime(start));
      setEndTime(toLocalDatetime(end));
      setRole(ROLES[0]);
      setNote("");
    }
  }, [open, editShift, defaultStart, staff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const body = {
      staffId,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      role,
      note: note || undefined,
    };

    try {
      const url = editShift ? `/api/shifts/${editShift.id}` : "/api/shifts";
      const method = editShift ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "保存に失敗しました");
      }

      onClose(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editShift || !confirm("このシフトを削除しますか？")) return;
    setLoading(true);
    try {
      await fetch(`/api/shifts/${editShift.id}`, { method: "DELETE" });
      onClose(true);
    } catch {
      setError("削除に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4">
          {editShift ? "シフト編集" : "新規シフト登録"}
        </h2>

        {error && (
          <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">スタッフ</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              required
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name ?? s.id}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">開始日時</label>
              <input
                type="datetime-local"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">終了日時</label>
              <input
                type="datetime-local"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">役割</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="任意のメモ"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => onClose()}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50 transition"
              disabled={loading}
            >
              キャンセル
            </button>
            {editShift && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm hover:bg-red-600 transition"
                disabled={loading}
              >
                削除
              </button>
            )}
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 transition disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
