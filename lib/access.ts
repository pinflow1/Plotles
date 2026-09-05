import { prisma } from "@/lib/prisma";
import type { CollaboratorRole } from "@prisma/client";

const CAN_EDIT: CollaboratorRole[] = ["owner", "edit"];

export async function getProjectRole(userId: string, projectId: string): Promise<CollaboratorRole | null> {
  const access = await prisma.projectAccess.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });
  return access?.role ?? null;
}

export function canEdit(role: CollaboratorRole | null): boolean {
  return !!role && CAN_EDIT.includes(role);
}

export function isOwner(role: CollaboratorRole | null): boolean {
  return role === "owner";
}
