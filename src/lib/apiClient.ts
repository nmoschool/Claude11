"use client";

/** استدعاء API من المتصفح مع رسائل خطأ عربية موحّدة */
export async function api<T = any>(url: string, method = "GET", body?: unknown): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(url, {
    method,
    headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const issue = data.error?.issues?.[0];
    const msg = data.error?.message_ar ?? "تعذّر تنفيذ العملية";
    throw new Error(issue ? `${msg} (${issue.path?.join(".")}: ${issue.message})` : msg);
  }
  return data as T;
}
