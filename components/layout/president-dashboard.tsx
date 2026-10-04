'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Globe2, Radio, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import NationalPresident from '@/components/cards/national-president';
import PresidentsByState from '@/components/cards/presidents-by-state';
import Ranking from '@/components/rankings/ranking';
import BrazilProgressMap from '@/components/charts/brazil-progress-map';
import { clock, number, percentage } from '@/lib/formatting';
import type { NationalPresidentSnapshot } from '@/types/election';
import ProjectFooter from './project-footer';

export default function PresidentDashboard(){
  const [data,setData]=useState<NationalPresidentSnapshot|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(false);
  const busy=useRef(false),controller=useRef<AbortController|null>(null),requestId=useRef(0);
  const refresh=useCallback(async()=>{
    if(busy.current)return;
    busy.current=true;setLoading(true);
    const id=++requestId.current,abort=new AbortController();controller.current=abort;
    const timeout=window.setTimeout(()=>abort.abort(),60_000);
    try{
      const response=await fetch('/api/elections/br/president',{cache:'no-store',signal:abort.signal});
      if(!response.ok)throw new Error('Resultado indisponível.');
      const result:NationalPresidentSnapshot=await response.json();
      if(!Array.isArray(result.candidates)||!result.meta||!result.source)throw new Error('Resposta inválida.');
      if(id!==requestId.current)return;
      setData(previous=>previous?.source.verifiedSignatures&&(!result.source.verifiedSignatures||(previous.meta.updatedAt&&(!result.meta.updatedAt||result.meta.updatedAt<previous.meta.updatedAt)))?{...previous,stale:true,checkedAt:result.checkedAt}:result);
      setError(false);
    }catch{if(id===requestId.current)setError(true);}
    finally{window.clearTimeout(timeout);if(id===requestId.current){busy.current=false;setLoading(false);}}
  },[]);
  const cancelRefresh=useCallback(()=>{requestId.current++;controller.current?.abort();busy.current=false;},[]);
  useEffect(()=>{
    let active=true;
    void Promise.resolve().then(()=>{if(active)void refresh();});
    const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},15_000);
    const onVisible=()=>{if(!document.hidden)void refresh();};document.addEventListener('visibilitychange',onVisible);
    return()=>{active=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);cancelRefresh();};
  },[refresh,cancelRefresh]);
  const meta=data?.meta,warning=error||data?.stale||meta?.status==='unavailable';
  const leaders=data?{...data,candidates:data.candidates.filter(c=>c.rank!==null).slice(0,2)}:undefined;
  return <>
    <a className="skip-link" href="#main">Ir para os resultados</a>
    <div className="topbar"><div className="container topbar-inner"><span>ELEIÇÕES GERAIS <b>2026</b></span><span>1º TURNO <i/> 04 OUTUBRO</span><a href="https://resultados.tse.jus.br/" target="_blank" rel="noreferrer">Portal oficial do TSE <ExternalLink size={12}/></a></div></div>
    <header className="container masthead"><div className="brand"><div className="sc-mark" aria-hidden="true">BR<span>2026</span></div><div><p className="eyebrow">GERAL · BRASIL E EXTERIOR</p><h1>PRESIDENTE<br className="mobile-break"/> DO BRASIL<span className="title-dot">.</span></h1></div></div><div className="live-block"><span className={`live-badge ${warning?'live-warning':''}`}><Radio size={15}/>{meta?.status==='finished'?'TOTALIZAÇÃO FINAL':warning?'ATUALIZAÇÃO COM AVISO':'AO VIVO'}</span><p className="small muted">Votação nacional do TSE.</p></div></header>
    <main id="main" className="container">
      <section className="progress-panel" aria-labelledby="president-progress-title"><div className="progress-main"><div className="progress-kicker"><span className="eyebrow" id="president-progress-title">TOTALIZAÇÃO · PRESIDENTE NO BRASIL</span><ShieldCheck size={18} className="accent"/></div><div className="progress-value"><strong>{percentage(meta?.percentage)}</strong><span className="muted small">das seções totalizadas<br/>Brasil e exterior</span></div><div className="progress-track" role="progressbar" aria-label="Seções totalizadas para presidente no Brasil" aria-valuemin={0} aria-valuemax={100} aria-valuenow={meta?.percentage??undefined}><span style={{width:`${meta?.percentage||0}%`}}/></div><p className="small muted">{meta?.totalSections!=null?`${number(meta.sections)} de ${number(meta.totalSections)} seções`:'Consultando a fonte nacional'}</p></div>
        <div className="counting-status"><Globe2 size={24} className="accent"/><div><h2>{meta?.status==='finished'?'Totalização nacional finalizada':meta?.status==='counting'?'Apuração nacional em andamento':meta?.status==='waiting'?'Aguardando totalização nacional':loading?'Consultando dados nacionais':'Aguardando disponibilidade do TSE'}</h2><p className="muted small">Atualização automática a cada 15 segundos.</p></div></div>
        <div className="refresh-block"><button className="refresh-button" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={16} className={loading?'spin':''}/>{loading?'Atualizando…':'Atualizar agora'}</button><p className="small muted">Consulta: {clock(data?.checkedAt||null)}</p><p className="small muted">Dados TSE: {clock(meta?.updatedAt||null)}</p></div>
      </section>
      {warning&&<aside className="warning" role="status"><TriangleAlert size={18}/><div><strong>Atualização nacional com aviso</strong><p>{meta?.status==='unavailable'&&!data?.stale?'Divulgação nacional temporariamente indisponível no TSE.':'Não foi possível atualizar. O último resultado nacional válido permanece na tela, quando disponível.'}</p></div></aside>}
      <NationalPresident data={leaders}/>
      <div className="section-heading"><div><span className="section-tag">RESULTADO NACIONAL</span><h2>Todos os candidatos à Presidência</h2><p className="section-description muted">Votos em todo o Brasil e no exterior, ordenados por posição atual.</p></div></div>
      <section className="president-national-ranking" aria-label="Ranking nacional de presidente"><Ranking uf="br" stateName="Brasil e exterior" office="president" candidates={data?.candidates} meta={meta}/></section>
      <PresidentsByState/>
      <BrazilProgressMap/>
      <section className="source-section"><ShieldCheck size={22} className="accent"/><div><h2>Resultado oficial nacional</h2><p className="small muted">{data?.source.verifiedSignatures?'Arquivo nacional do TSE com assinatura digital verificada.':'Aguardando validação da fonte oficial nacional.'} Posições são calculadas por votos, com empates. Liderança parcial não significa eleição.</p><details><summary>Consultar fontes</summary><ul>{data?.source.files.map(url=><li key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></li>)}</ul></details></div></section>
    </main><ProjectFooter/>
  </>;
}
