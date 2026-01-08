export type TestResult = {
  testName: string;
  gameTitle: string;
  suggestions: Array<{ title: string; appid?: number; reason?: string }>;
  timing: number;
};

export function formatSideBySide(results: TestResult[][]): string {
  // Group results by game
  const byGame = new Map<string, TestResult[]>();
  
  for (const testResults of results) {
    for (const result of testResults) {
      if (!byGame.has(result.gameTitle)) {
        byGame.set(result.gameTitle, []);
      }
      byGame.get(result.gameTitle)!.push(result);
    }
  }

  let output = "";
  
  for (const [gameTitle, testResults] of byGame.entries()) {
    output += `\n=== ${gameTitle} ===\n\n`;
    
    // Find max suggestions count
    const suggestionCounts = testResults.map(r => r.suggestions.length);
    const maxSuggestions = suggestionCounts.length > 0 ? Math.max(...suggestionCounts) : 0;
    
    // Build columns for each test
    const columns: Array<{ header: string; lines: string[] }> = [];
    for (const result of testResults) {
      const lines: string[] = [];
      for (let i = 0; i < maxSuggestions; i++) {
        const suggestion = result.suggestions[i];
        if (suggestion) {
          const title = suggestion.title.length > 50 
            ? suggestion.title.substring(0, 47) + "..." 
            : suggestion.title;
          const appidStr = suggestion.appid ? ` (${suggestion.appid})` : "";
          lines.push(`${i + 1}. ${title}${appidStr}`);
        } else {
          lines.push(`${i + 1}. -`);
        }
      }
      columns.push({ header: result.testName, lines });
    }
    
    // Print in 2x2 grid format
    const col1 = columns[0];
    const col2 = columns[1];
    const col3 = columns[2];
    const col4 = columns[3];
    
    if (col1 && col2) {
      output += `${col1.header.padEnd(55)} ${col2.header}\n`;
      output += `${"-".repeat(55)} ${"-".repeat(55)}\n`;
      for (let i = 0; i < maxSuggestions; i++) {
        const l1 = col1.lines[i] || "";
        const l2 = col2.lines[i] || "";
        output += `${l1.padEnd(55)} ${l2}\n`;
      }
    }
    
    if (col3 && col4) {
      output += `\n${col3.header.padEnd(55)} ${col4.header}\n`;
      output += `${"-".repeat(55)} ${"-".repeat(55)}\n`;
      for (let i = 0; i < maxSuggestions; i++) {
        const l3 = col3.lines[i] || "";
        const l4 = col4.lines[i] || "";
        output += `${l3.padEnd(55)} ${l4}\n`;
      }
    }
    
    output += "\n";
  }
  
  return output;
}
