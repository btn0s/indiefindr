import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/CodeBlock";

export const metadata: Metadata = { title: "Agent access" };

const MCP_URL = "https://www.indiefindr.gg/mcp";

export default function Agents() {
  return <main className="discovery-page">
    <h1 className="page-title">Ask indiefindr</h1>
    <div className="source-description agent-docs">
      <p>Public indie game recommendations, with Steam ratings and links. No account or API key required.</p>
      <h2>Connect an assistant</h2>
      <p>In Claude, add a custom connector with URL <code>{MCP_URL}</code>. In ChatGPT, open Plugins, choose Add custom MCP server, and enter that URL with no authentication. Account and workspace policies determine availability.</p>
      <p>For Cursor, add this server to your MCP configuration:</p>
      <CodeBlock code={JSON.stringify({ mcpServers: { indiefindr: { url: MCP_URL } } }, null, 2)} />
      <p>For Codex:</p>
      <CodeBlock code={`[mcp_servers.indiefindr]\nurl = "${MCP_URL}"`} />
      <p>Tools: <code>search_games</code>, <code>get_game</code>, and <code>get_recommendations</code>. For example: “Find indie games like Lil Gator Game.”</p>
      <p><a href="https://developers.openai.com/plugins/deploy/connect-chatgpt">Official ChatGPT connection guide</a> and <a href="https://developers.openai.com/codex/mcp">Codex MCP configuration</a>.</p>
      <h2>CLI</h2>
      <p>The CLI is prepared for npm publication. Once published:</p>
      <CodeBlock code={`npx indiefindr "lil gator game"\nnpx indiefindr 413150 --limit 24 --json`} />
      <p>Steam ratings remain visible. Rescued review-bomb cases carry a Review bombed label, clean score and dated vote counts in JSON responses.</p>
      <h2>JSON API</h2>
      <CodeBlock code="GET https://www.indiefindr.gg/api/recs/413150?limit=10" />
      <p>The default limit is 10; the maximum is 24. Results contain precomputed recommendations. Games with sparse or no reviews remain eligible. Supported browsers also expose the same three tools on game pages through WebMCP.</p>
      <p><Link href="/privacy">Privacy</Link> and <a href="https://github.com/btn0s/indiefindr/issues">support</a>.</p>
    </div>
  </main>;
}
