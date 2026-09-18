"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function StudentSelect({
  students,
  selectedId,
}: {
  students: { id: string; fullName: string }[];
  selectedId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("student", id);
    router.push(`/dashboard/reports?${params.toString()}`);
  }

  return (
    <select
      className="input"
      value={selectedId}
      onChange={(e) => onChange(e.target.value)}
    >
      {students.map((s) => (
        <option key={s.id} value={s.id}>
          {s.fullName}
        </option>
      ))}
    </select>
  );
}
