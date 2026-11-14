"use client";
import { Button } from "@ui-sdk/react/button";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** A code sample with a copy button. The icon crossfades to a check, then back after a moment. */
export function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return <div className="code-block">
    <pre><code>{code}</code></pre>
    <Button className="button button-secondary copy-button" onClick={copy} data-copied={copied || undefined} aria-label={copied ? "Copied" : "Copy to clipboard"}>
      <Copy className="copy-icon" size={14} aria-hidden="true" />
      <Check className="copy-check" size={14} strokeWidth={2.5} aria-hidden="true" />
    </Button>
  </div>;
}
