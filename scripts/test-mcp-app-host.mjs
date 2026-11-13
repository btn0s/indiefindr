import {build} from 'esbuild';import {readFile} from 'node:fs/promises';import {createServer} from 'node:http';
const result=await build({entryPoints:['tests/mcp-app-host.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
const resource=JSON.parse((await readFile('src/lib/mcp-app-html.ts','utf8')).split('export const APP_HTML=')[1].trim().replace(/;$/,''));
const html='<!doctype html><html><body style="margin:0"><iframe title="Indiefindr MCP App response" sandbox="allow-scripts" style="border:0;width:100%;height:360px;display:block"></iframe><script type="module" src="/host.js"></script></body></html>';
createServer((request,response)=>{response.setHeader('Content-Type',request.url==='/host.js'?'application/javascript':'text/html');response.end(request.url==='/host.js'?result.outputFiles[0].text:request.url==='/resource'?resource:html);}).listen(4317,'127.0.0.1',()=>console.log('MCP App test host: 4317'));
