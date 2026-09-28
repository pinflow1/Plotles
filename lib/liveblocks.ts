// Server-side only — calls Liveblocks' REST authorize-user endpoint.
// room:write / room:read are confirmed-valid permission strings (legacy
// names for *:write / *:read).
type LiveblocksPermission = "room:write" | "room:read";

export async function authorizeLiveblocksUser(params: {
  userId: string;
  userInfo: { name: string; avatar?: string | null };
  room: string;
  permission: LiveblocksPermission;
}): Promise<{ token: string }> {
  const secretKey = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secretKey) {
    throw new Error("LIVEBLOCKS_SECRET_KEY is not set. Copy .env.example to .env and set one.");
  }

  const res = await fetch("https://api.liveblocks.io/v2/authorize-user", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: params.userId,
      userInfo: { name: params.userInfo.name, avatar: params.userInfo.avatar ?? undefined },
      permissions: { [params.room]: [params.permission] },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Liveblocks authorization failed (${res.status}): ${detail}`);
  }

  return res.json();
}
