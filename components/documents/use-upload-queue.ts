"use client";

import { useCallback, useRef, useState } from "react";
import { discardUpload, finalizeUpload, registerUpload, type UploadTarget } from "@/lib/actions/documents";
import { checkFile, type DocumentCategory, IMAGE_TYPES, type FileProblem } from "@/lib/documents/rules";
import { isConvertibleImage, prepareImage, uploadObject } from "@/lib/documents/upload-client";
import { useT } from "@/lib/i18n/client";


export type QueueStatus = "preparing" | "queued" | "uploading" | "done" | "failed";

export type QueueItem = {
  key: string;
  name: string;
  size: number;
  status: QueueStatus;
  progress: number; // 0..1
  error?: string;
  file?: File;
};

export type Rejected = { name: string; problem: FileProblem | "image" };

let counter = 0;

/**
 * Files chosen for upload and their progress. Files upload one after another:
 * register (server) → bytes to Storage (browser) → finalize (server). A failed file is
 * cleaned up and can be retried; files already uploaded are never sent twice.
 */
export function useUploadQueue({ orgSlug, resizeImages }: { orgSlug: string; resizeImages: boolean }) {
  const t = useT();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [rejected, setRejected] = useState<Rejected[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const itemsRef = useRef<QueueItem[]>([]);

  const update = useCallback((next: (current: QueueItem[]) => QueueItem[]) => {
    itemsRef.current = next(itemsRef.current);
    setItems(itemsRef.current);
  }, []);
  const patch = useCallback(
    (key: string, values: Partial<QueueItem>) =>
      update((current) => current.map((item) => (item.key === key ? { ...item, ...values } : item))),
    [update],
  );

  const add = useCallback(
    async (files: FileList | File[]) => {
      const rejectedNow: Rejected[] = [];
      for (const original of Array.from(files)) {
        const key = `f${++counter}`;
        const convert = resizeImages && isConvertibleImage(original);
        if (!convert) {
          const problem = checkFile(original);
          if (problem) {
            rejectedNow.push({ name: original.name, problem });
            continue;
          }
          update((current) => [
            ...current,
            { key, name: original.name, size: original.size, status: "queued", progress: 0, file: original },
          ]);
          continue;
        }
        update((current) => [
          ...current,
          { key, name: original.name, size: original.size, status: "preparing", progress: 0 },
        ]);
        const prepared = await prepareImage(original);
        const problem = prepared ? checkFile(prepared) : "image";
        if (!prepared || problem) {
          update((current) => current.filter((item) => item.key !== key));
          rejectedNow.push({ name: original.name, problem: problem ?? "image" });
          continue;
        }
        patch(key, { name: prepared.name, size: prepared.size, status: "queued", file: prepared });
      }
      setRejected(rejectedNow);
    },
    [patch, resizeImages, update],
  );

  const remove = useCallback(
    (key: string) => update((current) => current.filter((item) => item.key !== key || item.status === "done")),
    [update],
  );

  /** Uploads everything not yet uploaded. Resolves true when every file is done. */
  const uploadAll = useCallback(
    async (target: UploadTarget, category?: DocumentCategory, title?: string): Promise<boolean> => {
      const copy = t.app.attachments;
      for (const item of itemsRef.current) {
        if (item.status === "done" || item.status === "preparing" || !item.file) continue;
        const file = item.file;
        patch(item.key, { status: "uploading", progress: 0, error: undefined });
        setAnnouncement(`${item.name}: ${copy.uploading(0)}`);
        try {
          await uploadOne(item, file);
        } catch {
          // Network or server failure: the file stays in the list for a retry.
          patch(item.key, { status: "failed", error: t.errors.network });
          setAnnouncement(`${item.name}: ${copy.failed}`);
        }
      }
      const all = itemsRef.current;
      const done = all.filter((item) => item.status === "done").length;
      if (all.length) setAnnouncement(copy.progressSummary(done, all.length));
      return all.every((item) => item.status === "done");

      async function uploadOne(item: QueueItem, file: File) {
        const registered = await registerUpload({
          orgSlug,
          target,
          file: { name: file.name, type: file.type, size: file.size },
          category: category ?? (IMAGE_TYPES.includes(file.type as never) ? "photo" : "other"),
          title,
        });
        if (!registered.ok || !registered.data) {
          patch(item.key, { status: "failed", error: (registered.errorCode ? t.errors[registered.errorCode] : copy.failed) });
          setAnnouncement(`${item.name}: ${copy.failed}`);
          return;
        }
        const { id, path } = registered.data;
        const uploaded = await uploadObject(path, file, (fraction) => patch(item.key, { progress: fraction }));
        const finalized = uploaded ? await finalizeUpload(orgSlug, id) : { ok: false };
        if (!finalized.ok) {
          await discardUpload(orgSlug, id).catch(() => undefined);
          patch(item.key, { status: "failed", error: copy.failed });
          setAnnouncement(`${item.name}: ${copy.failed}`);
          return;
        }
        patch(item.key, { status: "done", progress: 1 });
        setAnnouncement(`${item.name}: ${copy.done}`);
      }
    },
    [orgSlug, patch, t],
  );

  const clear = useCallback(() => update(() => []), [update]);

  return {
    items,
    rejected,
    announcement,
    add,
    remove,
    uploadAll,
    clear,
    busy: items.some((item) => item.status === "uploading" || item.status === "preparing"),
    hasPending: items.some((item) => item.status !== "done"),
  };
}

export type UploadQueue = ReturnType<typeof useUploadQueue>;
