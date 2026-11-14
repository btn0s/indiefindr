import { qualityFields } from "./review-quality";
import { getGame, getGamePageSlate } from './catalog';
import { searchGames as searchCatalog } from './search';
import { steamRating } from './rating';
const origin='https://www.indiefindr.gg';
export const links=(appid:number)=>({url:`${origin}/games/${appid}`,steam_url:`https://store.steampowered.com/app/${appid}/`});
/** Catalog search in the agent-facing shape, used by /api/search and the MCP search tool. */
export async function searchGames(query:string){
 return (await searchCatalog(query)).map(g=>({appid:g.appid,name:g.title,year:g.release_date?.slice(0,4)??null,header_image:g.header_image,review_percent:g.review_positive_pct,review_count:g.review_count,...links(g.appid)}));
}
export async function gameDetails(appid:number){
 const game=await getGame(appid);if(!game)return null;
 return {appid,name:game.title,developers:game.developers,release_date:game.release_date,short_description:game.short_description,header_image:game.header_image,review_percent:game.review_positive_pct,review_label:steamRating(game.review_positive_pct,game.review_count),review_count:game.review_count,...qualityFields(game),...links(appid)};
}
export async function recommendationSlate(appid:number,limit=10){
 const game=await getGame(appid);if(!game)return null;
 const {recs}=await getGamePageSlate(appid,game.developers);
 const recommendations=recs.slice(0,Math.min(24,Math.max(1,limit))).map(({game:g})=>({appid:g.appid,name:g.title,header_image:g.header_image,review_percent:g.review_positive_pct,review_label:steamRating(g.review_positive_pct,g.review_count),review_count:g.review_count,...qualityFields(g),...links(g.appid)}));
 return {game:{appid,name:game.title,...qualityFields(game),...links(appid)},recommendations};
}
