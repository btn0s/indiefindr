"use client";

import { useChat } from "ai/react";
import { Input } from "@/components/ui/input";

export default function Home() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: "/api/gather",
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-4">
        <div className="space-y-4">
          {messages.map((m) => (
            <div key={m.id} className="whitespace-pre-wrap">
              <div className="font-bold">{m.role}</div>
              <p>{m.content}</p>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="url"
            name="url"
            value={input}
            onChange={handleInputChange}
            placeholder="Enter URL"
            required
            className="w-full"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
          >
            Analyze URL
          </button>
        </form>
      </div>
    </div>
  );
}
