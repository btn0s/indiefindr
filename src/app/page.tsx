import { Input } from "@/components/ui/input";

async function logUrl(formData: FormData) {
  "use server";
  const url = formData.get("url");
  console.log("Submitted URL:", url);
}

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <form action={logUrl} className="w-full max-w-md space-y-4">
        <Input
          type="url"
          name="url"
          placeholder="Enter URL"
          required
          className="w-full"
        />
        <button
          type="submit"
          className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
        >
          Submit URL
        </button>
      </form>
    </div>
  );
}
