"use client";
import { Toast, ToastDescription, ToastRegion, ToastTitle } from "@ui-sdk/react/toast";
export function Toaster() {
  return <ToastRegion aria-label="Notifications" className="fixed bottom-4 right-4 z-50">{() => <Toast className="rounded-lg border bg-card p-4 text-card-foreground"><ToastTitle /><ToastDescription /></Toast>}</ToastRegion>;
}
