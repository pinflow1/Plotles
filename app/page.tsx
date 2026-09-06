import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";

export default async function RootPage() {
  const userId = await getSessionUserId();
  redirect(userId ? "/dashboard" : "/login");
}
