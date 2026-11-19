import { withStudent } from "@/lib/studentGuard";
import { progress } from "@/lib/gameService";

export const GET = withStudent(async (_req, student) => progress(student));
