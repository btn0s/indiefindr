import { DetailedIndieGameReport } from "@/schema";

// Helper function to group links by type
const groupLinksByType = (links: DetailedIndieGameReport["relevantLinks"]) => {
  if (!links) return {};
  return links.reduce((acc, link) => {
    if (!link || !link.type || !link.url) return acc;
    const type = link.type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(link);
    return acc;
  }, {} as { [key: string]: typeof links });
};

interface IndieGameReportProps {
  reportData: DetailedIndieGameReport;
}

export function IndieGameReport({ reportData }: IndieGameReportProps) {
  const groupedLinks = groupLinksByType(reportData.relevantLinks);

  return (
    <div className="space-y-6 border rounded p-4 md:p-6 shadow-lg bg-card text-card-foreground">
      <section>
        <h2 className="text-xl font-semibold border-b pb-2 mb-3">
          Report Summary
        </h2>
        {reportData.overallReportSummary && (
          <p className="text-sm mb-3">{reportData.overallReportSummary}</p>
        )}
        {reportData.aiConfidenceAssessment && (
          <p className="text-xs text-muted-foreground italic">
            AI Confidence: {reportData.aiConfidenceAssessment}
          </p>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold border-b pb-2 mb-3">
          Core Information
        </h2>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          {reportData.gameName && (
            <div>
              <dt className="font-medium text-muted-foreground">Game Name:</dt>
              <dd className="font-semibold text-lg">{reportData.gameName}</dd>
            </div>
          )}
          {reportData.developerName && (
            <div>
              <dt className="font-medium text-muted-foreground">Developer:</dt>
              <dd>{reportData.developerName}</dd>
            </div>
          )}
          {reportData.publisherName && (
            <div>
              <dt className="font-medium text-muted-foreground">Publisher:</dt>
              <dd>{reportData.publisherName}</dd>
            </div>
          )}
        </dl>
      </section>

      <section>
        <h2 className="text-xl font-semibold border-b pb-2 mb-3">
          Details & Background
        </h2>
        {reportData.gameDescription && (
          <div className="pt-2">
            <h3 className="font-medium text-base mb-1">Game Description:</h3>
            <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
              {reportData.gameDescription}
            </p>
          </div>
        )}
        {reportData.developerBackground && (
          <div className="pt-3">
            <h3 className="font-medium text-base mb-1">
              Developer Background:
            </h3>
            <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
              {reportData.developerBackground}
            </p>
          </div>
        )}
        {reportData.publisherInfo && (
          <div className="pt-3">
            <h3 className="font-medium text-base mb-1">Publisher Info:</h3>
            <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
              {reportData.publisherInfo}
            </p>
          </div>
        )}
        {reportData.fundingInfo && (
          <div className="pt-3">
            <h3 className="font-medium text-base mb-1">Funding Info:</h3>
            <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
              {reportData.fundingInfo}
            </p>
          </div>
        )}
        {reportData.releaseInfo && (
          <div className="pt-3">
            <h3 className="font-medium text-base mb-1">Release Info:</h3>
            <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
              {reportData.releaseInfo}
            </p>
          </div>
        )}
        {reportData.genresAndTags && reportData.genresAndTags.length > 0 && (
          <div className="pt-3">
            <h3 className="font-medium text-base mb-1">Genres & Tags:</h3>
            <div className="flex flex-wrap gap-1">
              {reportData.genresAndTags.map((item, index) => (
                <span
                  key={index}
                  className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
        {reportData.teamMembers && reportData.teamMembers.length > 0 && (
          <div className="pt-3">
            <h3 className="font-medium text-base mb-1">Team Members:</h3>
            <ul className="list-disc list-inside text-sm space-y-1 pl-4">
              {reportData.teamMembers.map((member, index) => (
                <li key={index}>
                  <span className="font-semibold">{member.name || "N/A"}:</span>{" "}
                  {member.role || "N/A"}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold border-b pb-2 mb-3">
          Relevant Links
        </h2>
        {Object.keys(groupedLinks).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            {Object.entries(groupedLinks).map(([type, links]) => (
              <div key={type}>
                <h3 className="font-medium text-muted-foreground mb-1">
                  {type}
                </h3>
                <ul className="list-none space-y-1">
                  {(links as DetailedIndieGameReport["relevantLinks"])?.map(
                    (link, index) => (
                      <li key={index}>
                        <a
                          href={link?.url || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline break-all"
                        >
                          {link?.name || link?.url}
                        </a>
                      </li>
                    )
                  )}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No relevant links found.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold border-b pb-2 mb-3">
          Source Data (for Debugging)
        </h2>
        {reportData.sourceTweetText && (
          <div className="pt-2">
            <h3 className="font-medium text-sm">Source Tweet:</h3>
            <p className="text-xs whitespace-pre-wrap bg-muted p-2 rounded font-mono">
              {reportData.sourceTweetText}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
