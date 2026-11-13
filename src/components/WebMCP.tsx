'use client';
import { useEffect } from 'react';
type Tool={name:string;description:string;inputSchema:object;execute:(input:Record<string,unknown>)=>Promise<unknown>};
type ModelContext={registerTool:(tool:Tool)=>unknown;unregisterTool?:(name:string)=>void};
export function WebMCP(){useEffect(()=>{
 const context=(document as Document&{modelContext?:ModelContext}).modelContext??(navigator as Navigator&{modelContext?:ModelContext}).modelContext;if(!context)return;
 const read=async(path:string)=>{const response=await fetch(path);const data=await response.json();if(!response.ok)throw new Error(data.error??'Request failed. Retry shortly.');return data;};
 const tools:Tool[]=[
 {name:'search_games',description:'Find catalog games by title.',inputSchema:{type:'object',properties:{query:{type:'string',minLength:1,maxLength:200}},required:['query']},execute:async({query})=>read('/api/agent-search?q='+encodeURIComponent(String(query)))},
 {name:'get_game',description:'Read public game metadata by Steam appid.',inputSchema:{type:'object',properties:{appid:{type:'integer',minimum:1}},required:['appid']},execute:async({appid})=>read('/api/agent-game/'+encodeURIComponent(String(appid)))},
 {name:'get_recommendations',description:'Read stored indie recommendations by game title or Steam appid.',inputSchema:{type:'object',properties:{game:{type:'string'},limit:{type:'integer',minimum:1,maximum:24}},required:['game']},execute:async({game,limit=10})=>{const value=String(game);const id=/^\d+$/.test(value)?value:(await read('/api/agent-search?q='+encodeURIComponent(value))).games[0]?.appid;if(!id)throw new Error('No matching game. Try another title or Steam appid.');return read(`/api/recs/${id}?limit=${encodeURIComponent(String(limit))}`);}}
 ];
 for(const tool of tools)context.registerTool(tool);
 return()=>{for(const tool of tools)context.unregisterTool?.(tool.name);};
 },[]);return null;}
