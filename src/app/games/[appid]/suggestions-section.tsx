import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GameCard } from "@/components/GameCard";

export async function SuggestionsSection({appId,gameTitle}:{appId:number;gameTitle:string}) {
 const db=getSupabaseServerClient();
 const {data:recs,error}=await db.from("game_recs").select("rec_appid,rank,source").eq("appid",appId).order("rank");
 if(error) throw new Error("Recommendations unavailable");
 const source=recs?.some(r=>r.source==='llm')?'llm':'model';
 const slate=(recs||[]).filter(r=>r.source===source);
 const {data:games}=slate.length ? await db.from('games').select('appid,title,header_image').in('appid',slate.map(r=>r.rec_appid)).eq('is_indie',true) : {data:[]};
 const byid=new Map((games||[]).map(g=>[g.appid,g]));
 return <section className="flex flex-col gap-3"><h2 className="text-lg font-semibold">Indie games like {gameTitle}</h2><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{slate.map(r=>{const g=byid.get(r.rec_appid);return g ? <GameCard key={g.appid} {...g} pageAppid={appId} position={r.rank}/> : null;})}</div>{!slate.length && <p>Recommendations are being prepared for this game.</p>}</section>;
}
