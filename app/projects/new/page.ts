import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { CreateStoryView } from "@/components/projects/CreateStoryView";

export default async function NewProjectPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=/projects/new");

  return <CreateStoryView />;
}
