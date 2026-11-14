import React from 'react';
import { expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { Navbar } from '../src/components/Navbar';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock('@/lib/use-game-search',()=>({useGameSearch:()=>({games:[{appid:413150,name:'Stardew Valley',year:'2016',header_image:null,review_percent:98,review_count:600000}],loading:false,error:null,search:vi.fn()})}));
test('search is named and usable through the SDK agent',async()=>{
 const agent=createAgent();
 render(<Navbar/>);
 expect(screen.getByRole('combobox',{name:'Search games'})).toBeTruthy();
 await waitFor(()=>expect(agent.snapshot().some(entry=>entry.label==='Search games')).toBe(true));
 const result=await agent.act({steps:[{ref:'Search games',action:'setValue',args:['Stardew']}]});
 expect(result).toBeTruthy();
 await waitFor(()=>expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('Stardew'));

});
