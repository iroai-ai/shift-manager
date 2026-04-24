"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/auth/signin" })}
      className="text-sm text-gray-500 hover:text-red-500 transition"
    >
      ログアウト
    </button>
  );
}
