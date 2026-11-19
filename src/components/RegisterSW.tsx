"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    const secure = location.protocol === "https:" || location.hostname === "localhost";
    if ("serviceWorker" in navigator && secure) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);
  return null;
}
