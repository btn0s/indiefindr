"use client";

import { useState } from "react";
import { DetailedIndieGameReport } from "@/schema";
import { IndieGameReport } from "@/components/IndieGameReport";
import { IndieGameListItem } from "@/components/IndieGameListItem";
import { SubmitGameDialog } from "@/components/SubmitGameDialog";

export default function Home() {
  const [resultData, setResultData] = useState<DetailedIndieGameReport | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleSuccess = (data: DetailedIndieGameReport) => {
    setError(null); // Clear previous errors on new success
    setResultData(data);
  };

  const handleError = (error: Error) => {
    setError(error);
    setResultData(null); // Clear previous results on error
  };

  const handleLoadingChange = (loading: boolean) => {
    setIsLoading(loading);
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 bg-background text-foreground">
      <div className="w-full max-w-5xl space-y-6">
        {/* Header Row */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">IndieFindr</h1>
          <SubmitGameDialog
            onSuccess={handleSuccess}
            onError={handleError}
            onLoadingChange={handleLoadingChange}
          />
        </div>

        {/* Status Indicators */}
        {isLoading && (
          <div className="text-center p-4 text-blue-600">
            Gathering Info... (this may take a minute or two)
          </div>
        )}

        {error && (
          <div className="text-red-500 border border-red-500 rounded p-3">
            <p>
              <strong>Error:</strong> {error.message}
            </p>
          </div>
        )}

        {/* Results Display */}
        {resultData && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold border-b pb-2">
              Latest Find:
            </h2>
            {/* Display both list item and full report for now */}
            <IndieGameListItem reportData={resultData} />
            <IndieGameReport reportData={resultData} />
          </div>
        )}
      </div>
    </div>
  );
}
