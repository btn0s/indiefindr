#!/usr/bin/env node
const args=process.argv.slice(2);let limit=10,json=false;const words=[];
for(let i=0;i<args.length;i++) {if(args[i]==='--json')json=true;else if(args[i]==='--limit')limit=Number(args[++i]);else if(args[i]==='--help'){console.log('Usage: indiefindr <game name or appid> [--limit 1..24] [--json]');process.exit(0);}else if(args[i].startsWith('--')){console.error('Unknown option: '+args[i]);process.exit(1);}else words.push(args[i]);}
const query=words.join(' ').trim();
if(!query||!Number.isInteger(limit)||limit<1||limit>24){console.error('Supply a game title or Steam appid and --limit from 1 to 24.');process.exit(1);}
const origin=process.env.INDIEFINDR_URL||'https://indiefindr.gg';
async function get(path){const response=await fetch(origin+path,{signal:AbortSignal.timeout(30000)});const result=await response.json();if(!response.ok)throw new Error(result.error||`Server returned ${response.status}`);return result;}
try{const appid=/^\d+$/.test(query)?query:(await get('/api/agent-search?q='+encodeURIComponent(query))).games[0]?.appid;if(!appid)throw new Error('No game matched. Try another title or its Steam appid.');const result=await get(`/api/recs/${appid}?limit=${limit}`);if(json)console.log(JSON.stringify(result,null,2));else{console.log(`Games like ${result.game.name}\n`);result.recommendations.forEach((g,i)=>console.log(`${i+1}. ${g.name} — ${g.review_label?g.review_percent+'% '+g.review_label:'Not yet rated'}\n   ${g.url}\n   ${g.steam_url}`));}}catch(error){console.error(error.message);process.exit(1);}
