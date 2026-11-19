import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user?.kind === "student") redirect("/student");
  if (session?.user?.kind === "staff") redirect("/dashboard");
  redirect("/login");
}
