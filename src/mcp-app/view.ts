import { App } from '@modelcontextprotocol/ext-apps';
const app=new App({name:'indiefindr',version:'0.1.0'},{});
type Game={appid:number;name:string;url:string;header_image:string|null;review_percent:number|null;review_label:string|null;review_bombed?:boolean;clean_score?:number|null;bomb_windows?:unknown};
type Slate={game:{name:string};recommendations:Game[]};
function render(data:Slate){
 document.querySelector('h1')!.textContent=`Games like ${data.game.name}`;
 const track=document.querySelector('#games')!;track.replaceChildren();
 for(const game of data.recommendations){
  const link=document.createElement('a');link.href=game.url;link.target='_blank';link.rel='noopener noreferrer';link.className='game';
  if(game.header_image){const image=document.createElement('img');image.src=game.header_image;image.alt='';image.loading='eager';link.append(image);}else{const placeholder=document.createElement('div');placeholder.className='placeholder';link.append(placeholder);}
  const name=document.createElement('h2');name.textContent=game.name;link.append(name);
  const rating=document.createElement('p');if(game.review_label&&game.review_percent!==null){const percent=document.createElement('strong');percent.textContent=`${game.review_percent}%`;rating.append(percent,` ${game.review_label}`);}else rating.textContent='Not yet rated';if(game.review_bombed){const label=document.createElement("span");label.className="review-bombed";label.textContent="Review bombed";rating.append(label);}link.append(rating);
  link.addEventListener('click',event=>{event.preventDefault();void app.openLink({url:game.url});});track.append(link);
 }
 document.querySelector('#status')!.textContent=data.recommendations.length?`${data.recommendations.length} indie games picked from the catalog`:'No recommendations available for this game.';
}
app.ontoolresult=result=>{
 if(result.isError){document.querySelector('#status')!.textContent='Recommendations unavailable. Try another game.';return;}
 const text=result.content?.find(block=>block.type==='text');
 try{const data=result.structuredContent??(text&&'text' in text?JSON.parse(text.text):null);if(data&&Array.isArray(data.recommendations))render(data as Slate);}catch{document.querySelector('#status')!.textContent='Could not read the recommendation result.';}
};
for(const [id,direction] of [['previous',-1],['next',1]] as const)document.getElementById(id)!.addEventListener('click',()=>document.getElementById('games')!.scrollBy({left:direction*540,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
void app.connect().catch(()=>{document.querySelector('#status')!.textContent='Open this response in an MCP Apps-compatible assistant.';});
