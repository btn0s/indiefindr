import React from 'react';
import { expect,test,vi } from 'vitest';
import { render,waitFor } from '@testing-library/react';
import { WebMCP } from '../src/components/WebMCP';
test('registers public tools with document modelContext and unregisters on unmount',async()=>{
 const tools=new Map<string,{execute:(input:Record<string,unknown>)=>Promise<unknown>}>();
 const unregisterTool=vi.fn();
 Object.assign(document,{modelContext:{registerTool:(tool:{name:string;execute:(input:Record<string,unknown>)=>Promise<unknown>})=>tools.set(tool.name,tool),unregisterTool}});
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({recommendations:[{appid:1}]})})));
 const view=render(<WebMCP/>);await waitFor(()=>expect(tools.size).toBe(3));
 await tools.get('get_recommendations')!.execute({game:'413150',limit:3});
 expect(fetch).toHaveBeenCalledWith('/api/recs/413150?limit=3');view.unmount();expect(unregisterTool).toHaveBeenCalledTimes(3);
 Object.assign(document,{modelContext:undefined});vi.unstubAllGlobals();
});
test('falls back to navigator modelContext and safely does nothing without either host',()=>{
 const registerTool=vi.fn();Object.assign(document,{modelContext:undefined});Object.defineProperty(navigator,'modelContext',{value:{registerTool},configurable:true});
 const view=render(<WebMCP/>);expect(registerTool).toHaveBeenCalledTimes(3);view.unmount();Object.defineProperty(navigator,'modelContext',{value:undefined,configurable:true});
 expect(()=>render(<WebMCP/>)).not.toThrow();
});
