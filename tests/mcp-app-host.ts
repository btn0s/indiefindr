import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
const frame=document.querySelector('iframe')!;
const bridge=new AppBridge(null,{name:'indiefindr-spec-test-host',version:'1.0.0'},{openLinks:{}});
bridge.onopenlink=async({url})=>{document.body.dataset.opened=url;return {};};
bridge.onsizechange=({height})=>{frame.style.height=`${Math.max(280,height??320)}px`;};
bridge.oninitialized=async()=>{
 const appid=new URL(location.href).searchParams.get('appid')??'413150';
 const limit=Math.min(24,Math.max(1,Number(new URL(location.href).searchParams.get('limit')??10)));
 const result=await fetch(`https://www.indiefindr.gg/api/recs/${appid}?limit=${limit}`).then(response=>response.json());
 await bridge.sendToolInput({arguments:{game:appid,limit}});
 await bridge.sendToolResult({content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result});
 document.body.dataset.ready='true';
};
const resource=await fetch('/resource').then(response=>response.text());
const connected=bridge.connect(new PostMessageTransport(frame.contentWindow!,frame.contentWindow!));
frame.srcdoc=resource;
await connected;
