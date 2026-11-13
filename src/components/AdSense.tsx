"use client";
import Script from "next/script";
import { useEffect, useRef } from "react";

declare global { interface Window { adsbygoogle?: Record<string, never>[] } }

export function AdSense({ client, slot }: { client: string; slot: string }) {
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }, []);
  return <aside aria-label="Advertisement" className="my-6">
    <p className="ad-label text-muted-foreground mb-2">Advertisement</p>
    <Script id="adsense" strategy="afterInteractive" crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`} />
    <ins className="adsbygoogle" style={{ display: "block", minHeight: 90 }}
      data-ad-client={client} data-ad-slot={slot} data-ad-format="auto"
      data-full-width-responsive="true" />
  </aside>;
}
