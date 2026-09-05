"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useEditorPreferences, FONT_LABELS } from "@/lib/editor-preferences";
import { useTheme, type ThemeMode } from "@/lib/theme-context";
import { useSessionCache } from "@/lib/session-cache";
import { api } from "@/lib/api-client";
import { Segmented } from "@/components/ui/Segmented";
import { NavDrawer } from "@/components/navigation/NavDrawer";
import { CollaboratorsPanel } from "@/components/bottom-sheet/CollaboratorsPanel";

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <div className="mb-1.5 px-1 text-xs uppercase tracking-[0.08em] text-text-soft">{label}</div>
      <div className="rounded-2xl bg-surface">{children}</div>
    </section>
  );
}

function Row({ label, value, onClick }: { label: string; value?: React.ReactNode; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className="flex w-full items-center justify-between px-4 py-3 text-left first:rounded-t-2xl last:rounded-b-2xl [&:not(:first-child)]:border-t [&:not(:first-child)]:border-divider active:bg-active"
    >
      <span className="text-[15px] text-text">{label}</span>
      {typeof value === "string" ? <span className="text-sm text-text-soft">{value}</span> : value}
    </Tag>
  );
}

export function SettingsView({ user }: { user: { penName: string; email: string; avatarUrl: string | null } }) {
  const router = useRouter();
  const { fontFamily, textSize } = useEditorPreferences();
  const { mode, setMode } = useTheme();
  const { current } = useSessionCache();
  const isProjectOwner = current?.role === "owner";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function signOut() {
    await api.post("/api/auth/logout");
    router.replace("/login");
    router.refresh();
  }

  async function deleteProject() {
    if (!current) return;
    setDeleting(true);
    try {
      await api.delete(`/api/projects/${current.projectId}`);
      router.replace("/dashboard");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper pb-16 pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={() => setDrawerOpen(true)} aria-label="Menu" className="rounded-lg p-2.5 text-text active:bg-active">
          <ChevronLeft size={20} strokeWidth={1.6} />
        </button>
        <span className="text-xs font-bold tracking-[0.16em] text-text">SETTINGS</span>
        <div className="w-9" />
      </header>

      <div className="mx-auto max-w-lg px-5 pt-3">
        <Section label="Writing">
          <Row label="Font" value={FONT_LABELS[fontFamily]} />
          <Row label="Text Size" value={`${textSize}px`} />
          <Row label="Autosave" value="On" />
          <Row label="Focus Mode" value="Set from Quick Tools" />
        </Section>

        <Section label="Appearance">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[15px] text-text">Theme</span>
            <Segmented
              value={mode}
              onChange={(v: ThemeMode) => setMode(v)}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
            />
          </div>
        </Section>

        {current ? (
          <>
            <Section label={`Collaboration · ${current.projectTitle}`}>
              <div className="px-4 py-3">
                <CollaboratorsPanel projectId={current.projectId} isOwner={isProjectOwner} />
              </div>
            </Section>

            <Section label="Data">
              {/* Export isn't built yet — stubbed per the brief. */}
              <Row label="Export" value="Coming soon" />
            </Section>
          </>
        ) : (
          <p className="mb-7 px-1 text-sm text-text-soft">Open a story to see its collaboration and data settings here.</p>
        )}

        <Section label="Account">
          <Row label="Pen name" value={user.penName} />
          <Row label="Email" value={user.email} />
          <Row label="Sign out" onClick={signOut} />
        </Section>

        {current && isProjectOwner && (
          <section className="mt-10 border-t border-divider pt-5">
            <div className="mb-1.5 px-1 text-xs uppercase tracking-[0.08em] text-text-soft">Danger Zone</div>
            <div className="rounded-2xl bg-surface px-4 py-3">
              {!confirmingDelete ? (
                <button onClick={() => setConfirmingDelete(true)} className="text-[15px] text-text">
                  Delete “{current.projectTitle}”
                </button>
              ) : (
                <div>
                  <p className="mb-3 text-sm text-text-soft">This permanently deletes the story for every collaborator. There's no undo.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmingDelete(false)}
                      className="flex-1 rounded-lg bg-active py-2 text-sm text-text"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={deleteProject}
                      disabled={deleting}
                      className="flex-1 rounded-lg bg-strong py-2 text-sm font-semibold text-on-strong disabled:opacity-60"
                    >
                      {deleting ? "Deleting…" : "Delete permanently"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <NavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} user={user} active="settings" />
    </div>
  );
}
