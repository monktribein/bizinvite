"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

interface PassQrCodeProps {
  /** Backend-signed pass token; the QR encodes exactly what the gate scanner verifies. */
  token: string;
  size?: number;
  className?: string;
  onDataUrl?: (url: string) => void;
}

/** Renders the pass QR from the signed token (same content as the image sent on WhatsApp). */
export function PassQrCode({ token, size = 224, className, onDataUrl }: PassQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(token, { width: 512, margin: 2, errorCorrectionLevel: "M" })
      .then((url) => {
        if (cancelled) return;
        setDataUrl(url);
        setFailed(false);
        onDataUrl?.(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, onDataUrl]);

  if (failed) {
    return <div className="text-xs text-rose-600">Could not render the QR code.</div>;
  }
  if (!dataUrl) {
    return <div style={{ width: size, height: size }} className="animate-pulse rounded-lg bg-slate-100" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt="Entry pass QR code" width={size} height={size} className={className} />;
}
