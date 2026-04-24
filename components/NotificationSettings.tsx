"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

interface Props {
  initial: {
    notifyOnCreate: boolean;
    notifyOnUpdate: boolean;
    notifyOnDelete: boolean;
  };
}

export function NotificationSettings({ initial }: Props) {
  const { data: session } = useSession();
  const [settings, setSettings] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (key: keyof typeof settings) =>
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    if (!session?.user?.id) return;
    setSaving(true);
    try {
      await fetch(`/api/users/${session.user.id}/notifications`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const items: [keyof typeof settings, string][] = [
    ["notifyOnCreate", "シフト作成時"],
    ["notifyOnUpdate", "シフト更新時"],
    ["notifyOnDelete", "シフト削除時"],
  ];

  return (
    <div className="bg-white rounded-xl border p-6 max-w-sm">
      <h3 className="font-semibold mb-4">メール通知設定</h3>
      <div className="space-y-3">
        {items.map(([key, label]) => (
          <label key={key} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={() => toggle(key)}
              className="w-4 h-4 accent-blue-600"
            />
            <span className="text-sm text-gray-700">{label}</span>
          </label>
        ))}
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-4 w-full bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 transition disabled:opacity-50"
      >
        {saved ? "保存しました" : saving ? "保存中..." : "設定を保存"}
      </button>
    </div>
  );
}
