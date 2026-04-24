export const runtime = "edge";

import { ShiftCalendar } from "@/components/ShiftCalendar";

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">シフトカレンダー</h1>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
            同期中
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
            同期失敗
          </span>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border p-4">
        <ShiftCalendar />
      </div>
    </div>
  );
}
