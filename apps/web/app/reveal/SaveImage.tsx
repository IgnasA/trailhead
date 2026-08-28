"use client";

// "Save as image" — the wireframe calls this the only free acquisition
// channel, so it ships in the MVP. The map canvas is composited with the
// numbers into a PNG entirely in the browser; nothing is uploaded.
import { useState } from "react";
import type { RevealStats } from "./Reveal";

const W = 1200;
const H = 900;

export function SaveImage({ stats }: { stats: RevealStats }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");

      ctx.fillStyle = "#f3f2f2";
      ctx.fillRect(0, 0, W, H);

      // The live map's canvas is readable because the map sets
      // preserveDrawingBuffer at creation.
      const mapCanvas = document.querySelector<HTMLCanvasElement>(".maplibregl-canvas");
      if (mapCanvas) {
        const targetH = 430;
        const scale = W / mapCanvas.width;
        ctx.drawImage(mapCanvas, 0, H - targetH, W, Math.min(targetH, mapCanvas.height * scale));
      }

      ctx.fillStyle = "#201e1d";
      ctx.font = "800 18px Archivo, system-ui, sans-serif";
      ctx.fillText("TRAILHEAD", 60, 72);

      const years = [stats.first_date?.slice(0, 4), stats.last_date?.slice(0, 4)].filter(Boolean);
      if (years.length === 2) {
        ctx.font = "600 16px Archivo, system-ui, sans-serif";
        ctx.fillStyle = "#7d7979";
        ctx.fillText(`${years[0]}  →  ${years[1]}`, 60, 150);
      }

      ctx.fillStyle = "#201e1d";
      ctx.font = "800 150px Archivo, system-ui, sans-serif";
      ctx.fillText(String(stats.flights), 60, 280);
      ctx.font = "700 34px Archivo, system-ui, sans-serif";
      ctx.fillText("flights", 68 + ctx.measureText(String(stats.flights)).width, 280);

      const cells: [string, string][] = [
        ["Countries", stats.countries.toLocaleString()],
        ["Airports", stats.airports.toLocaleString()],
        ["Kilometres", stats.km.toLocaleString()],
        ["Airlines", stats.airlines.toLocaleString()],
      ];
      cells.forEach(([label, value], i) => {
        const x = 60 + i * 280;
        ctx.fillStyle = "#7d7979";
        ctx.font = "600 14px Archivo, system-ui, sans-serif";
        ctx.fillText(label.toUpperCase(), x, 350);
        ctx.fillStyle = label === "Kilometres" ? "#ec3013" : "#201e1d";
        ctx.font = "800 44px Archivo, system-ui, sans-serif";
        ctx.fillText(value, x, 400);
      });

      ctx.strokeStyle = "#201e1d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(60, 430);
      ctx.lineTo(W - 60, 430);
      ctx.stroke();

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("could not render");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "trailhead.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <button className="btn btn-secondary" onClick={save} disabled={busy}>
        {busy ? "Rendering…" : "Save as image"}
      </button>
      {error && <span style={{ fontSize: 12, color: "var(--color-accent-700)" }}>{error}</span>}
    </span>
  );
}
