'use client';
import {useEffect,useRef,useState} from 'react';
import {Download,FileSpreadsheet,Search} from 'lucide-react';
import {OFFICES,type ElectionSnapshot,type Office} from '@/types/election';
import {officeLabel} from '@/lib/config';
import {matchesCandidate} from '@/lib/panel-tools';
import {number} from '@/lib/formatting';
import {downloadBlob} from '@/lib/download';
import {initialExportRows,mergeExportRows,municipalExportSchema,exportRowStatus,type MunicipalExport,type MunicipalExportRow} from '@/lib/municipal-export';
import type {OfficeFilter} from '@/components/layout/panel-filters';

export default function MunicipalExcelExport({uf,snapshot,officeFilter}:{uf:string;snapshot:ElectionSnapshot|null;officeFilter:OfficeFilter}){
  const [office,setOffice]=useState<Office>(officeFilter==='all'?'stateDeputy':officeFilter),[query,setQuery]=useState(''),[candidateId,setCandidateId]=useState('');
  const [result,setResult]=useState<MunicipalExport|null>(null),[busy,setBusy]=useState(false),[downloading,setDownloading]=useState(false),[message,setMessage]=useState(''),[done,setDone]=useState(0);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>{controller.current?.abort();},[]);
  const all=snapshot?.[office]||[],candidates=all.filter(c=>matchesCandidate(c,query)).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const candidate=all.find(c=>c.id===candidateId),cities=snapshot?.municipalities||[];
  const available=result?.rows.filter(row=>row.votes!==null).length||0;
  function reset(){controller.current?.abort();controller.current=null;setBusy(false);setResult(null);setMessage('');setDone(0);setCandidateId('');}
  async function download(data:MunicipalExport,signal?:AbortSignal){
    setDownloading(true);
    try{
      const response=await fetch('/api/elections/municipal/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(municipalExportSchema.parse(data)),signal});
      if(!response.ok)throw new Error('Não foi possível gerar o arquivo. Tente baixar novamente.');
      downloadBlob(await response.blob(),`votos-por-cidade-${uf}-${data.candidate.number}-${data.candidate.id}.xlsx`);
      if(!signal?.aborted)setMessage(`Excel gerado: ${data.rows.length} cidades, ${data.rows.filter(r=>r.votes!==null).length} com votos disponíveis.`);
    }finally{setDownloading(false);}
  }
  async function generate(){
    if(!candidate||!cities.length||controller.current)return;
    const abort=new AbortController();controller.current=abort;setBusy(true);setDone(0);setMessage('Consultando os votos por cidade…');
    let data:MunicipalExport={uf,candidate:{id:candidate.id,name:candidate.name,number:candidate.number,party:candidate.party,office},rows:initialExportRows(cities)};
    setResult(data);
    try{
      for(let i=0;i<cities.length;i+=20){
        const codes=cities.slice(i,i+20).map(c=>c.code),params=new URLSearchParams({uf,office,candidate:candidate.id,cities:codes.join(',')});
        const timer=window.setTimeout(()=>abort.abort(),60_000);
        let batch:{uf:string;candidate:MunicipalExport['candidate'];rows:MunicipalExportRow[];stale:boolean};
        try{const response=await fetch(`/api/elections/municipal/candidate?${params}`,{cache:'no-store',signal:abort.signal});if(!response.ok){const error=await response.json().catch(()=>null);throw new Error(error?.error||'Não foi possível consultar o TSE.');}batch=await response.json();}finally{clearTimeout(timer);}
        if(controller.current!==abort||abort.signal.aborted)return;
        if(batch.uf!==uf||batch.candidate.id!==candidate.id||batch.candidate.office!==office)throw new Error('Resposta de outro candidato ou estado rejeitada.');
        data=municipalExportSchema.parse({uf,candidate:batch.candidate,rows:mergeExportRows(data.rows,batch.rows,codes)});
        setResult(data);setDone(i+codes.length);
        if(batch.stale){setMessage('O TSE não atualizou parte da consulta. Você pode baixar um Excel parcial; as cidades sem dados ficam em branco.');return;}
      }
      await download(data,abort.signal);
    }catch(error){if(controller.current===abort)setMessage(abort.signal.aborted?'Consulta interrompida. As cidades já recebidas podem ser baixadas no Excel parcial.':`${error instanceof Error?error.message:'Consulta indisponível.'} Você pode baixar os dados já recebidos.`);}
    finally{if(controller.current===abort){controller.current=null;setBusy(false);}}
  }
  const partial=result&&(done<result.rows.length||result.rows.some(row=>row.stale));
  return <section className="analysis-panel panel municipal-excel" id="excel-municipal" aria-labelledby="municipal-excel-title">
    <header className="analysis-heading"><div><span className="section-tag"><FileSpreadsheet size={15}/>VOTOS POR CIDADE · {uf.toUpperCase()}</span><h2 id="municipal-excel-title">Excel de um candidato por município</h2><p className="small muted">Escolha o cargo e o candidato. O arquivo inclui todas as {cities.length||'—'} cidades do estado, com votos, apuração, horário e fonte TSE.</p></div></header>
    <div className="municipal-excel-fields"><label>Cargo<select aria-label="Cargo para exportar Excel" value={office} disabled={busy||downloading} onChange={e=>{reset();setOffice(e.target.value as Office);setQuery('');}}>{OFFICES.map(o=><option key={o} value={o}>{officeLabel(o,uf)}</option>)}</select></label>
    <label>Buscar candidato<span className="search"><Search size={15}/><input aria-label="Buscar candidato para Excel" placeholder="Nome, número ou partido" value={query} disabled={busy||downloading} onChange={e=>setQuery(e.target.value)}/></span></label>
    <label>Candidato<select aria-label="Candidato para exportar Excel" value={candidateId} disabled={busy||downloading||!all.length} onChange={e=>{reset();setCandidateId(e.target.value);}}><option value="">Selecione um candidato</option>{candidate&&!candidates.some(c=>c.id===candidate.id)&&<option value={candidate.id}>{candidate.name} · {candidate.number} · {candidate.party}</option>}{candidates.map(c=><option key={c.id} value={c.id}>{c.name} · {c.number} · {c.party}</option>)}</select></label></div>
    <div className="tool-actions"><button className="add-button" disabled={!candidate||!cities.length||busy||downloading} onClick={()=>void generate()}><FileSpreadsheet size={16}/>{busy?'Consultando cidades…':'Gerar Excel com votos por cidade'}</button>{busy&&<button className="secondary-button" onClick={()=>controller.current?.abort()}>Interromper consulta</button>}{result&&!busy&&available>0&&<button className="secondary-button" disabled={downloading} onClick={()=>void download(result).catch(e=>setMessage(e instanceof Error?e.message:'Falha ao baixar.'))}><Download size={16}/>{downloading?'Gerando arquivo…':partial?'Baixar Excel parcial':'Baixar Excel novamente'}</button>}</div>
    {(busy||result)&&<div className="municipal-excel-progress"><progress value={done} max={cities.length||1} aria-label="Cidades consultadas para Excel"/><p className="small muted">{done} de {cities.length} cidades consultadas · {available} com votos disponíveis.</p></div>}
    <p className="small muted" role="status">{message||'Células de votos vazias indicam dados indisponíveis. Zero publicado permanece zero no Excel. A consulta pode levar alguns minutos.'}</p>
    {result&&<div className="municipal-excel-preview"><table><caption>Prévia do Excel · primeiras 8 cidades em ordem alfabética</caption><thead><tr><th>Município</th><th>Votos</th><th>Situação</th></tr></thead><tbody>{result.rows.slice(0,8).map(row=><tr key={row.code}><td>{row.name}</td><td>{number(row.votes)}</td><td>{exportRowStatus(row)}</td></tr>)}</tbody></table></div>}
    <a className="text-link small" href="https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados" target="_blank" rel="noreferrer">Documentação dos resultados municipais do TSE</a>
  </section>;
}
