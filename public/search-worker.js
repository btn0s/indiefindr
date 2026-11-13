let rows = [];
let ready = false;
let pending = null;
const normalize = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();
function search({ query, id }) {
  const q = normalize(query);
  if (!q) return self.postMessage({ type: 'results', id, games: [] });
  const tokens = q.split(/\s+/);
  const exact = [], prefixes = [], matches = [];
  for (const row of rows) {
    const text = row[2];
    if (!tokens.every(token => text.includes(token))) continue;
    const game = { appid: row[0], title: row[1] };
    if (text === q) exact.push(game);
    else if (text.startsWith(q) && prefixes.length < 8) prefixes.push(game);
    else if (matches.length < 8) matches.push(game);
  }
  self.postMessage({ type: 'results', id, games: [...exact, ...prefixes, ...matches].slice(0, 8) });
}
self.onmessage = async ({ data }) => {
  if (data.type === 'load') {
    try {
      const response = await fetch(data.url, { priority: 'low' });
      if (!response.ok) throw new Error('Index unavailable');
      const index = await response.json();
      rows = index.games.map(row => [row[0], row[1], normalize(row[1])]);
      ready = true;
      self.postMessage({ type: 'ready' });
      if (pending) search(pending);
    } catch { self.postMessage({ type: 'error' }); }
  } else if (data.type === 'search') {
    pending = data;
    if (ready) search(data);
  }
};
