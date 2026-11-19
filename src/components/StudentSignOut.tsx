"use client";

import { signOut } from "next-auth/react";

export default function StudentSignOut() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/student-login" })} className="rounded-2xl bg-white px-5 py-3 text-lg font-bold text-gray-600 shadow">
      خروج 👋
    </button>
  );
}
