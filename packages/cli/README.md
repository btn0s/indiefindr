# indiefindr
Requires Node 20+. No account or API key.

    npx indiefindr "lil gator game"
    npx indiefindr 413150 --limit 24 --json

Reads the same precomputed indie recommendation slate as the game page. Unrated games remain eligible. No LLM or model inference runs on requests.

Privacy: https://www.indiefindr.gg/privacy
Support and connection docs: https://www.indiefindr.gg/agents

Steam ratings remain visible. Rescued games add “Review bombed”; JSON results include the clean score and dated positive/negative vote counts.
