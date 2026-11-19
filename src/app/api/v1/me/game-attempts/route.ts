import { withStudent } from "@/lib/studentGuard";
import { syncAttempts } from "@/lib/gameService";

/** مزامنة دفعة محاولات (idempotent بواسطة clientId) — النقاط تُحسب على الخادم */
export const POST = withStudent(async (req, student) => syncAttempts(student, await req.json()));
