import { App } from '@modelcontextprotocol/ext-apps';
const app=new App({name:'indiefindr',version:'0.1.0'},{});
type Game={appid:number;name:string;url:string;header_image:string|null;review_percent:number|null;review_label:string|null};
type Slate={game:{name:string};recommendations:Game[]};
function render(data:Slate){
 document.querySelector('h1')!.textContent=`Games like ${data.game.name}`;
 const track=document.querySelector('#games')!;track.replaceChildren();
 for(const game of data.recommendations){
  const link=document.createElement('a');link.href=game.url;link.target='_blank';link.rel='noopener noreferrer';link.className='game';
  const art=document.createElement('div');art.className='art';if(game.header_image){const image=document.createElement('img');image.src=game.header_image;image.alt='';image.loading='eager';art.append(image);}link.append(art);
  const name=document.createElement('h2');name.textContent=game.name;link.append(name);
  const rating=document.createElement('p');if(game.review_label&&game.review_percent!==null){const percent=document.createElement('strong');percent.textContent=`${game.review_percent}%`;rating.append(percent,` ${game.review_label}`);}else rating.textContent='Not yet rated';link.append(rating);
  link.addEventListener('click',event=>{event.preventDefault();void app.openLink({url:game.url});});track.append(link);
 }
 document.querySelector('#status')!.textContent=data.recommendations.length?`${data.recommendations.length} indie games picked from the catalog`:'No recommendations available for this game.';
}
app.ontoolresult=result=>{
 if(result.isError){document.querySelector('#status')!.textContent='Recommendations unavailable. Try another game.';return;}
 const text=result.content?.find(block=>block.type==='text');
 try{const data=result.structuredContent??(text&&'text' in text?JSON.parse(text.text):null);if(data&&Array.isArray(data.recommendations))render(data as Slate);}catch{document.querySelector('#status')!.textContent='Could not read the recommendation result.';}
};
// Previous and Next page by what's visible; at either end the matching button is disabled. Arrow keys scroll the focused row natively, and snapping lands each step on a card.
const games=document.getElementById('games')!,previous=document.getElementById('previous') as HTMLButtonElement,next=document.getElementById('next') as HTMLButtonElement;
const edges=()=>{previous.disabled=games.scrollLeft<=1;next.disabled=games.scrollLeft+games.clientWidth>=games.scrollWidth-1;};
games.addEventListener('scroll',edges,{passive:true});new ResizeObserver(edges).observe(games);new MutationObserver(edges).observe(games,{childList:true});
for(const [button,direction] of [[previous,-1],[next,1]] as const)button.addEventListener('click',()=>games.scrollBy({left:direction*games.clientWidth*.9,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
void app.connect().catch(()=>{document.querySelector('#status')!.textContent='Open this response in an MCP Apps-compatible assistant.';});
