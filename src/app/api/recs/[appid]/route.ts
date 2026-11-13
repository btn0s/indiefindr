import { recommendationSlate } from '@/lib/agent-catalog';
export async function GET(request:Request,{params}:{params:Promise<{appid:string}>}){
 const {appid}=await params;const raw=new URL(request.url).searchParams.get('limit')??'10';
 if(!/^\d+$/.test(appid)||!/^\d+$/.test(raw)||Number(raw)<1||Number(raw)>24)return Response.json({error:'Use a numeric Steam appid and limit from 1 to 24.'},{status:400});
 try {const result=await recommendationSlate(Number(appid),Number(raw));return Response.json(result??{error:'Game not found. Search for another title or check its Steam appid.'},{status:result?200:404,headers:result?{'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=86400','Access-Control-Allow-Origin':'*'}:{}});}catch{return Response.json({error:'Catalog unavailable. Retry shortly.'},{status:503});}
}
