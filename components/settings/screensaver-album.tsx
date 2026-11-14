"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SCREENSAVER_BUCKET, SCREENSAVER_PHOTO_LIMIT, SCREENSAVER_PHOTO_SIZE,
  SCREENSAVER_PHOTO_TYPES, screensaverPhotoUrl } from "@/lib/screensaver-photos";

export default function ScreensaverAlbum({ familyId }: { familyId: string }) {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [photos, setPhotos] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.storage.from(SCREENSAVER_BUCKET).list(familyId, {
      limit: SCREENSAVER_PHOTO_LIMIT,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) { setMessage("Could not load the album. Try again."); return; }
    setPhotos(data.filter((photo) => photo.id).map((photo) => photo.name));
  }, [familyId, supabase]);

  useEffect(() => { void load(); }, [load]);

  async function add(files: File[]) {
    if (!photos || busy || !files.length) return;
    if (photos.length + files.length > SCREENSAVER_PHOTO_LIMIT) {
      setMessage(`The album holds up to ${SCREENSAVER_PHOTO_LIMIT} photos. Choose fewer files or remove a photo first.`);
      return;
    }
    if (files.some((file) => !SCREENSAVER_PHOTO_TYPES.includes(file.type) || file.size > SCREENSAVER_PHOTO_SIZE || !file.size)) {
      setMessage("Choose JPEG, PNG or WebP photos up to 5 MB each.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      let added = 0;
      for (const file of files) {
        const { error } = await supabase.storage.from(SCREENSAVER_BUCKET).upload(
          `${familyId}/${crypto.randomUUID()}`, file, { contentType: file.type },
        );
        if (error) break;
        added++;
      }
      setMessage(added === files.length ? "Photos added." : `Added ${added} of ${files.length} photos. Try again with the remaining files.`);
      if (added) {
        await load();
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(name: string) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.storage.from(SCREENSAVER_BUCKET).remove([`${familyId}/${name}`]);
      if (error) { setMessage("Could not remove the photo. Try again."); return; }
      setPhotos((current) => current?.filter((photo) => photo !== name) ?? null);
      setMessage("Photo removed.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 mb-6" aria-busy={busy}>
      <h2 className="text-lg font-bold mb-2">Screensaver album</h2>
      <p className="text-sm text-cc-ink-dim mb-4">Choose the photos that rotate on the wall display. JPEG, PNG or WebP, up to 5 MB each.</p>
      <label className="block text-sm font-semibold">
        Add photos
        <input type="file" multiple accept={SCREENSAVER_PHOTO_TYPES.join(",")}
          disabled={!photos || busy || photos.length >= SCREENSAVER_PHOTO_LIMIT}
          className="block mt-2 max-w-full text-sm file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-cc-cream file:px-4 file:font-semibold disabled:opacity-50"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            void add(files);
          }} />
      </label>
      {photos?.length === 0 && <p className="mt-4 text-sm text-cc-ink-dim">Add your first photo to start the album. An empty album shows the clock.</p>}
      {!photos && message && <button type="button" className="min-h-11 underline" onClick={() => void load()}>Retry loading album</button>}
      {!!photos?.length && (
        <ul className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {photos.map((name, index) => (
            <li key={name} className="rounded-xl bg-cc-cream overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={screensaverPhotoUrl(name)} alt={`Album photo ${index + 1}`} loading="lazy" className="aspect-square w-full object-cover" />
              <button type="button" disabled={busy} onClick={() => void remove(name)}
                aria-label={`Remove album photo ${index + 1}`} className="min-h-11 w-full text-sm underline disabled:opacity-50">Remove</button>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="mt-2 text-sm">{message || (busy ? "Updating album…" : photos ? "" : "Loading album…")}</p>
    </section>
  );
}
