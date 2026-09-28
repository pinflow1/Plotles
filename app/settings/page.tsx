import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { SettingsView } from "@/components/settings/SettingsView";

export default async function SettingsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=/settings");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { penName: true, email: true, avatarUrl: true } });
  if (!user) redirect("/login");

  return <SettingsView user={user} />;
}
