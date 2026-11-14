import {expect,test,vi} from 'vitest';
import {screen} from '@testing-library/react';
const state=vi.hoisted(()=>({onResult:undefined as undefined|((value:unknown)=>void)}));
vi.mock('@modelcontextprotocol/ext-apps',()=>({App:class {
 set ontoolresult(callback:(value:unknown)=>void){state.onResult=callback;}
 connect(){return Promise.resolve();}
 openLink(){return Promise.resolve({});}
}}));
test('MCP carousel shows Steam percent and label, nothing about review bombs',async()=>{
 document.body.innerHTML='<h1></h1><p id="status"></p><main id="games"></main><button id="previous"></button><button id="next"></button>';
 await import('../src/mcp-app/view');
 state.onResult!({structuredContent:{game:{name:'Example'},recommendations:[{appid:496240,name:'Onward',url:'https://www.indiefindr.gg/games/496240',header_image:null,review_percent:69,review_label:'Mixed'}]}});
 expect(screen.getByText('69%')).toBeTruthy();expect(screen.queryByText(/bomb/i)).toBeNull();expect(screen.getByText(/Mixed/)).toBeTruthy();
 expect(document.querySelector('a')?.href).toBe('https://www.indiefindr.gg/games/496240');
});
