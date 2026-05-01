"use client";

import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

interface Props {
  file: File;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
}

const MAX_DIMENSION = 512;
const JPEG_QUALITY = 0.85;

export default function PhotoCropModal({ file, onCancel, onSave }: Props) {
  const [src, setSrc] = useState<string>("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function handleSave() {
    if (!area) return;
    setSaving(true);
    try {
      const blob = await cropToBlob(src, area);
      onSave(blob);
    } catch (e) {
      alert("Could not process image: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="relative w-full h-80 bg-black">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, areaPixels) => setArea(areaPixels)}
            />
          )}
        </div>
        <div className="p-4">
          <p className="text-sm text-slate-400 mb-2">Zoom</p>
          <input
            type="range"
            min={1}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full touch-manipulation"
            data-no-keyboard
          />
        </div>
        <div className="flex gap-2 p-4 pt-0">
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold touch-manipulation"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !area}
            className="flex-1 bg-rose-500 text-white py-3 rounded-xl font-semibold touch-manipulation disabled:opacity-50"
          >
            {saving ? "Saving…" : "Use photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

async function cropToBlob(src: string, area: Area): Promise<Blob> {
  const img = await loadImage(src);
  // Square output — don't upscale beyond the cropped source pixels.
  const out = Math.min(MAX_DIMENSION, area.width, area.height);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, out, out);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not load image"));
    img.src = src;
  });
}
