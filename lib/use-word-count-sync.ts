import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { countWords } from "@/lib/word-count";
import { api } from "@/lib/api-client";

const DEBOUNCE_MS = 4000;

export function useWordCountSync({
  editor,
  projectId,
  chapterId,
  initialWordCount,
  enabled,
  onSynced,
}: {
  editor: Editor | null;
  projectId: string;
  chapterId: string;
  initialWordCount: number;
  enabled: boolean;
  onSynced: (chapterId: string, wordCount: number) => void;
}) {
  const lastSynced = useRef(initialWordCount);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    lastSynced.current = initialWordCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  useEffect(() => {
    if (!editor || !enabled) return;

    function flush(count: number) {
      if (count === lastSynced.current) return;
      lastSynced.current = count;
      onSynced(chapterId, count);
      api.patch(`/api/projects/${projectId}/chapters/${chapterId}`, { wordCount: count }).catch(() => {
        // Best-effort — a missed sync just means today's log undercounts
        // slightly, not a broken chapter. Not worth surfacing to the writer.
      });
    }

    function onUpdate() {
      const count = countWords(editor.getText());
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => flush(count), DEBOUNCE_MS);
    }

    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
      if (timer.current) {
        clearTimeout(timer.current);
        flush(countWords(editor.getText()));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, enabled, projectId, chapterId]);
                                                                     }
