'use client';
import {useEffect,useRef,useState} from 'react';
import {Download,ImageDown,Share2,X} from 'lucide-react';
import {officeLabel} from '@/lib/config';
import {number,percentage} from '@/lib/formatting';
import {downloadBlob} from '@/lib/download';
import type {Candidate,OfficeMeta} from '@/types/election';

function wrap(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,lineHeight:number){
  let line='';for(const word of text.split(' ')){const next=line?`${line} ${word}`:word;if(ctx.measureText(next).width>width&&line){ctx.fillText(line,x,y);line=word;y+=lineHeight;}else line=next;}ctx.fillText(line,x,y);return y+lineHeight;
}
async function cardBlob(candidate:Candidate,meta:OfficeMeta|undefined,uf:string,stateName:string,stale:boolean):Promise<Blob>{
  await document.fonts.ready;
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Não foi possível gerar a imagem neste navegador.');
  ctx.fillStyle='#f5f7f6';ctx.fillRect(0,0,1080,1350);
  ctx.fillStyle='#17655c';ctx.fillRect(64,60,952,5);
  ctx.font='600 24px Manrope, sans-serif';ctx.fillText(`ELEIÇÕES 2026 · ${uf.toUpperCase()}`,64,117);
  ctx.fillStyle='#53656b';ctx.font='24px Manrope, sans-serif';ctx.fillText(officeLabel(candidate.office,uf),64,174);
  ctx.fillStyle='#1b2c32';ctx.font='600 52px "DM Sans", sans-serif';
  const nameSize=Math.min(52,Math.max(28,Math.floor(52*1666/Math.max(1,ctx.measureText(candidate.name).width))));ctx.font='600 '+nameSize+'px "DM Sans", sans-serif';
  const bottom=wrap(ctx,candidate.name,64,267,952,74);
  ctx.font='25px Manrope, sans-serif';ctx.fillStyle='#53656b';ctx.fillText(`${candidate.party} · ${candidate.number}`,64,bottom+8);
  ctx.fillStyle='#e8f3ee';ctx.fillRect(64,455,952,330);
  ctx.fillStyle='#1b2c32';ctx.font='700 88px Manrope, sans-serif';ctx.fillText(number(candidate.rank===null?null:candidate.votes),96,598);
  ctx.fillStyle='#53656b';ctx.font='22px Manrope, sans-serif';ctx.fillText(`votos em ${stateName}`,96,644);
  ctx.fillStyle='#17655c';ctx.font='600 44px Manrope, sans-serif';ctx.fillText(percentage(candidate.rank===null?null:candidate.percentage),96,726);
  ctx.fillStyle='#1b2c32';ctx.font='600 32px Manrope, sans-serif';ctx.fillText(candidate.rank===null?'Aguardando apuração':`${candidate.rank}º por votos`,540,726);
  ctx.fillStyle='#53656b';ctx.font='23px Manrope, sans-serif';ctx.fillText(meta?.seats?`${meta.seats} ${meta.seats===1?'vaga':'vagas'} no cargo`:'Vagas não informadas',64,852);
  ctx.fillStyle=candidate.officialElected?'#17655c':'#1b2c32';ctx.font='600 26px Manrope, sans-serif';
  wrap(ctx,candidate.officialElected?'Eleito confirmado pelo TSE':candidate.officialStatus||'Eleição ainda não confirmada pelo TSE',64,920,952,36);
  ctx.fillStyle='#53656b';ctx.font='22px Manrope, sans-serif';
  wrap(ctx,['federalDeputy','stateDeputy'].includes(candidate.office)?'A posição por votos não garante eleição no sistema proporcional.':'Liderança parcial não significa eleição.',64,1010,952,32);
  const time=meta?.updatedAt?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'medium'}).format(new Date(meta.updatedAt)):'indisponíveis';
  ctx.font='20px Manrope, sans-serif';ctx.fillText(`Dados TSE: ${time} · Brasília`,64,1131);
  if(stale){ctx.fillStyle='#936320';ctx.fillText('Último resultado válido · atualização com aviso',64,1167);}
  ctx.fillStyle='#17655c';ctx.fillRect(64,1200,952,1);ctx.font='600 24px Manrope, sans-serif';ctx.fillText('resultado-eleicoes-2026.vercel.app',64,1252);
  ctx.fillStyle='#53656b';ctx.font='18px Manrope, sans-serif';ctx.fillText('Painel independente · Feito por Vitor Rodi',64,1300);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Não foi possível gerar o PNG.')),'image/png'));
}
export default function ShareCandidate({candidate,meta,uf,stateName,stale=false}:{candidate:Candidate;meta?:OfficeMeta;uf:string;stateName:string;stale?:boolean}){
  const dialog=useRef<HTMLDialogElement>(null);
  const [blob,setBlob]=useState<Blob|null>(null),[url,setUrl]=useState<string|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),[canShare,setCanShare]=useState(false);
  const name=`eleicoes-2026-${uf}-${candidate.number}.png`;
  useEffect(()=>{if(!url)return;return()=>URL.revokeObjectURL(url);},[url]);
  async function generate(){
    setBusy(true);setError(null);setBlob(null);setUrl(null);setCanShare(false);dialog.current?.showModal();
    try{const result=await cardBlob(candidate,meta,uf,stateName,stale);setBlob(result);setUrl(URL.createObjectURL(result));setCanShare(!!navigator.canShare?.({files:[new File([result],name,{type:'image/png'})]}));}
    catch(e){setError(e instanceof Error?e.message:'Não foi possível gerar a imagem.');}finally{setBusy(false);}
  }
  async function share(){if(!blob)return;try{await navigator.share({files:[new File([blob],name,{type:'image/png'})],title:`${candidate.name} · Eleições 2026`,text:`Acompanhe os resultados: https://resultado-eleicoes-2026.vercel.app/?uf=${uf}`});}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setError('O compartilhamento não foi concluído. Você pode baixar o PNG.');}}
  return <><button className="share-card-button" onClick={()=>void generate()} aria-label={`Gerar imagem de ${candidate.name}`}><ImageDown size={15}/>Gerar imagem</button>
    <dialog ref={dialog} className="image-dialog" aria-label={`Imagem para compartilhar: ${candidate.name}`} onClick={e=>{if(e.target===dialog.current)dialog.current.close();}}><header><h3>Imagem para compartilhar</h3><button className="icon-button" onClick={()=>dialog.current?.close()} aria-label="Fechar imagem"><X size={20}/></button></header>{busy&&<p role="status">Gerando imagem…</p>}{error&&<p role="alert" className="warning-text">{error}</p>}
      {url&&<a href={url} target="_blank" rel="noreferrer" className="share-image-preview" style={{backgroundImage:`url("${url}")`}} aria-label="Abrir prévia da imagem em tamanho completo"/>}
      <footer>{blob&&<button className="add-button" onClick={()=>downloadBlob(blob,name)}><Download size={16}/>Baixar PNG</button>}{blob&&canShare&&<button className="secondary-button" onClick={()=>void share()}><Share2 size={16}/>Compartilhar imagem</button>}</footer>
    </dialog></>;
}
