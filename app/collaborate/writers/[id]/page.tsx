import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { WriterProfileView } from "@/components/collaborate/WriterProfileView";

export default async function WriterPage({ params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) redirect(`/login?next=/collaborate/writers/${params.id}`);

  return <WriterProfileView userId={params.id} />;
}
