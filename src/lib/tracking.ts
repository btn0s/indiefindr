export function track(kind:string,page_appid:number|null,target_appid:number,position=0){
 try{let session_id=sessionStorage.getItem('indiefindr-session');if(!session_id){session_id=crypto.randomUUID();sessionStorage.setItem('indiefindr-session',session_id);}navigator.sendBeacon('/api/events',new Blob([JSON.stringify({kind,page_appid,target_appid,position,session_id,referrer:document.referrer.slice(0,2048)})],{type:'application/json'}));}catch{/* Tracking must not interrupt navigation. */}
}
