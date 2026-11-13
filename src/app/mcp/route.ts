import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { searchGames,gameDetails,recommendationSlate } from '@/lib/agent-catalog';
const text=(result:unknown)=>({content:[{type:'text' as const,text:JSON.stringify(result)}]});
const safely=async(fn:()=>Promise<unknown>)=>{try{return text(await fn());}catch{return {isError:true,...text({error:'Catalog unavailable. Retry shortly or use a Steam appid.'})};}};
const handler=createMcpHandler(server=>{
 server.registerTool('search_games',{title:'Search Steam games',description:'Find up to eight catalog games by title, with appid, release year and Steam review percentage.',inputSchema:z.object({query:z.string().trim().min(1).max(200)}),annotations:{readOnlyHint:true}},async({query})=>safely(()=>searchGames(query)));
 server.registerTool('get_recommendations',{title:'Get indie game recommendations',description:'Read the stored indie recommendation slate for a game title or Steam appid. Returns up to 24 games with review scores and links.',inputSchema:z.object({game:z.union([z.string().trim().min(1).max(200),z.number().int().positive()]),limit:z.number().int().min(1).max(24).default(10)}),annotations:{readOnlyHint:true}},async({game,limit})=>safely(async()=>{const id=/^\d+$/.test(String(game))?Number(game):(await searchGames(String(game)))[0]?.appid;if(!id)throw new Error('No match');return await recommendationSlate(id,limit)??{error:'Game not found. Search for another title or use its Steam appid.'};}));
 server.registerTool('get_game',{title:'Get game details',description:'Read a catalog game’s developer, release date, short description, Steam rating and links by Steam appid.',inputSchema:z.object({appid:z.number().int().positive()}),annotations:{readOnlyHint:true}},async({appid})=>safely(async()=>await gameDetails(appid)??{error:'Game not found. Check the Steam appid.'}));
});
export {handler as GET,handler as POST};
