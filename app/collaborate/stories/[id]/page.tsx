import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { StoryPreviewView } from "@/components/collaborate/StoryPreviewView";

export default async function StoryPage({ params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) redirect(`/login?next=/collaborate/stories/${params.id}`);

  return <StoryPreviewView projectId={params.id} />;
}
