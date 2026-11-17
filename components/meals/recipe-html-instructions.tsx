"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useDialog } from "@/lib/use-dialog";
import { RECIPE_HTML_CSP } from "@/lib/recipe-html";

export default function RecipeHtmlInstructions({ id, source, name }: { id: string; source: "recipe" | "meal"; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="my-3 min-h-11 rounded-xl bg-sky-soft px-4 py-2 font-semibold text-sky-deep">
        Open visual instructions
      </button>
      {open && createPortal(<HtmlViewer id={id} source={source} name={name} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function HtmlViewer({ id, source, name, onClose }: { id: string; source: "recipe" | "meal"; name: string; onClose: () => void }) {
  const dialog = useDialog(true, onClose);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setError("");
      try {
        const response = await fetch(`/api/recipes/${source}/${id}/instructions`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Could not load visual instructions. Close and reopen the recipe, or retry.");
        const document = await response.json();
        if (typeof document.html !== "string") throw new Error("Could not read the HTML document");
        setHtml(document.html);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not load visual instructions");
      }
    }
    void load();
    return () => controller.abort();
  }, [id, source, attempt]);

  return (
    <div onClick={(event) => { event.stopPropagation(); onClose(); }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-2 sm:p-4">
      <div ref={dialog} role="dialog" aria-modal="true" aria-label="Visual recipe instructions" tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="flex h-[95dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-cc-line p-3">
          <h2 className="min-w-0 truncate font-semibold">{name}</h2>
          <button type="button" onClick={onClose} className="min-h-11 shrink-0 rounded-xl bg-cc-cream px-4 font-semibold">Close instructions</button>
        </div>
        {error ? (
          <div className="p-6"><p role="alert">{error}</p><button onClick={() => setAttempt((value) => value + 1)} className="mt-3 min-h-11 underline">Retry</button></div>
        ) : html === null ? <p role="status" className="p-6">Loading instructions…</p> : (
          <iframe title="Recipe instruction document" tabIndex={0} sandbox="" referrerPolicy="no-referrer"
            srcDoc={`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${RECIPE_HTML_CSP}"><meta name="viewport" content="width=device-width, initial-scale=1">${html}`}
            className="min-h-0 w-full flex-1 border-0 bg-white" />
        )}
      </div>
    </div>
  );
}
