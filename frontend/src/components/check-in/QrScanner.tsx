"use client";

import React, { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface QrScannerProps {
  /** Called once per decoded code; the same code is ignored for `repeatDelayMs`. */
  onScan: (data: string) => void;
  /** Stops decoding (e.g. while the previous scan is being verified). */
  paused?: boolean;
  repeatDelayMs?: number;
}

/** Largest frame side decoded; smaller frames keep decoding fast on phones. */
const MAX_DECODE_SIZE = 640;
const DECODE_INTERVAL_MS = 120;

type CameraState = "starting" | "running" | "denied" | "unavailable" | "error";

function cameraError(err: unknown): { state: CameraState; text: string } {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return { state: "denied", text: "Camera permission was denied. Allow camera access in the browser settings, then try again." };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return { state: "unavailable", text: "No camera was found on this device." };
  }
  return { state: "error", text: err instanceof Error ? err.message : "Could not start the camera." };
}

/**
 * Live camera QR scanner. Uses the rear camera where available and decodes frames
 * with jsQR on a canvas, so it works in every browser that supports getUserMedia
 * (which requires HTTPS or localhost).
 */
export function QrScanner({ onScan, paused = false, repeatDelayMs = 4000 }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pausedRef = useRef(paused);
  const onScanRef = useRef(onScan);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<CameraState>("starting");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let frame: number | null = null;
    let lastDecode = 0;
    let lastCode: { data: string; at: number } | null = null;
    const canvas = document.createElement("canvas");
    const videoEl = videoRef.current;

    const decodeLoop = () => {
      frame = requestAnimationFrame(decodeLoop);
      const video = videoRef.current;
      const now = performance.now();
      if (!video || video.readyState < video.HAVE_ENOUGH_DATA || pausedRef.current) return;
      if (now - lastDecode < DECODE_INTERVAL_MS) return;
      lastDecode = now;

      const scale = Math.min(1, MAX_DECODE_SIZE / Math.max(video.videoWidth, video.videoHeight));
      const width = Math.round(video.videoWidth * scale);
      const height = Math.round(video.videoHeight * scale);
      if (!width || !height) return;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, width, height);
      const code = jsQR(ctx.getImageData(0, 0, width, height).data, width, height, { inversionAttempts: "dontInvert" });
      if (!code?.data) return;

      if (lastCode && lastCode.data === code.data && Date.now() - lastCode.at < repeatDelayMs) return;
      lastCode = { data: code.data, at: Date.now() };
      if (navigator.vibrate) navigator.vibrate(80);
      onScanRef.current(code.data);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unavailable");
        setErrorText(
          window.isSecureContext
            ? "This browser cannot access the camera."
            : "The camera needs a secure (https) connection. Open the dashboard over https."
        );
        return;
      }
      try {
        const granted = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        const video = videoRef.current;
        if (cancelled || !video) {
          // Unmounted while the permission prompt was open: release the camera right away.
          granted.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = granted;
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        setState("running");
        frame = requestAnimationFrame(decodeLoop);
      } catch (err) {
        if (cancelled) return;
        const { state: next, text } = cameraError(err);
        setState(next);
        setErrorText(text);
      }
    };
    void start();

    return () => {
      cancelled = true;
      if (frame !== null) cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
      if (videoEl) videoEl.srcObject = null;
    };
  }, [attempt, repeatDelayMs]);

  const retry = () => {
    setState("starting");
    setErrorText("");
    setAttempt((a) => a + 1);
  };

  const running = state === "running";

  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl border-2 border-indigo-500/50 bg-slate-900 text-white shadow-inner">
      <video
        ref={videoRef}
        muted
        playsInline
        className={`h-full w-full object-cover ${running ? "" : "hidden"}`}
      />

      {running && (
        <>
          <div className="pointer-events-none absolute inset-10 rounded-xl border-2 border-white/70" />
          {!paused && (
            <div className="pointer-events-none absolute inset-x-10 top-1/2 h-0.5 bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-pulse" />
          )}
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold">
            {paused ? "Verifying…" : "Point the camera at the guest's QR pass"}
          </span>
        </>
      )}

      {!running && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          {state === "starting" ? (
            <>
              <Camera className="h-10 w-10 text-white/60 animate-pulse" />
              <span className="text-xs font-semibold text-white/80">Starting camera…</span>
            </>
          ) : (
            <>
              <CameraOff className="h-10 w-10 text-rose-300" />
              <span className="text-xs text-white/80">{errorText}</span>
              {state !== "unavailable" && (
                <Button type="button" size="sm" variant="outline" onClick={retry} className="bg-white text-slate-900">
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try again
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
