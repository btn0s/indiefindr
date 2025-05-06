import SearchClient from "@/components/SearchClient";
import { Suspense } from "react";

export default function SearchPage() {
  return (
    <Suspense fallback={<div>Loading search...</div>}>
      <SearchClient />
    </Suspense>
  );
}
