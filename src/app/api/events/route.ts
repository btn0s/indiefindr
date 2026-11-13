import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
const event=z.object({kind:z.enum(['impression','click_card','click_steam','click_ad','click_affiliate']),page_appid:z.number().int().positive().nullable(),target_appid:z.number().int().positive(),position:z.number().int().min(0).max(100),session_id:z.uuid(),referrer:z.string().max(2048)});
export const preferredRegion = "pdx1";

export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return new Response(null,{status:403});
 if(Number(req.headers.get('content-length')||0)>4096)return new Response(null,{status:413});
 const body=await req.text();if(body.length>4096)return new Response(null,{status:413});
 let parsed;try{parsed=event.safeParse(JSON.parse(body));}catch{return new Response(null,{status:400});}
 if(!parsed.success)return new Response(null,{status:400});
 const {error}=await getSupabaseServiceClient().from('events').insert(parsed.data);
 return new Response(null,{status:error?503:204});
}
