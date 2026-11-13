import { getGame, getGamePageSlate } from './catalog';
import { getSupabaseServerClient } from './supabase/server';
import { steamRating } from './rating';
const origin='https://indiefindr.gg';
export const links=(appid:number)=>({url:`${origin}/games/${appid}`,steam_url:`https://store.steampowered.com/app/${appid}/`});
export async function searchGames(query:string){
 const db=getSupabaseServerClient();
 const {data,error}=await db.rpc('search_games',{search_query:query.trim(),max_results:8});
 if(error)throw new Error('Search unavailable. Retry shortly or use a Steam appid.');
 const ids=(data??[]).map((g:{appid:number})=>g.appid);
 if(!ids.length)return [];
 const {data:rows,error:detailsError}=await db.from('games').select('appid,title,release_date,review_positive_pct').in('appid',ids);
 if(detailsError)throw new Error('Game metadata unavailable. Retry shortly.');
 return ids.map((id:number)=>rows?.find(g=>g.appid===id)).filter(Boolean).map((g:{appid:number;title:string;release_date:string|null;review_positive_pct:number|null}|undefined)=>({appid:g!.appid,name:g!.title,year:g!.release_date?.slice(0,4)??null,review_percent:g!.review_positive_pct}));
}
export async function gameDetails(appid:number){
 const game=await getGame(appid);if(!game)return null;
 return {appid,name:game.title,developers:game.developers,release_date:game.release_date,short_description:game.short_description,header_image:game.header_image,review_percent:game.review_positive_pct,review_label:steamRating(game.review_positive_pct,game.review_count),review_count:game.review_count,...links(appid)};
}
export async function recommendationSlate(appid:number,limit=10){
 const game=await getGame(appid);if(!game)return null;
 const {recs}=await getGamePageSlate(appid,game.developers);
 const recommendations=recs.slice(0,Math.min(24,Math.max(1,limit))).map(({game:g})=>({appid:g.appid,name:g.title,header_image:g.header_image,review_percent:g.review_positive_pct,review_label:steamRating(g.review_positive_pct,g.review_count),review_count:g.review_count,...links(g.appid)}));
 return {game:{appid,name:game.title,...links(appid)},recommendations};
}
