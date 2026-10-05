'use client';
import {useCallback,useEffect,useId,useMemo,useRef,useState} from 'react';
import {MapPin,RefreshCw,Search} from 'lucide-react';
import {canonical} from '@/lib/config';
import {number,percentage,clock} from '@/lib/formatting';
import {remainingSections} from '@/lib/live-features';
import {presidentialMapTone,PRESIDENTIAL_MAP_COLORS} from '@/lib/presidential-map';
import type {ElectionSnapshot,WatchPreferences} from '@/types/election';
import type {MunicipalLeader,MunicipalProgressSnapshot} from '@/services/tse/municipal-progress';
import FocusPanel from '@/components/layout/focus-panel';
import {useDisplaySettings} from '@/components/layout/display-settings';
type Geometry={uf:string;viewBox:string;source:string;shapes:{id:string;d:string}[]};
function shade(value:number|null|undefined){if(value==null)return '#253344';const p=value/100;return `rgb(${Math.round(36+87*p)},${Math.round(59+105*p)},${Math.round(82+120*p)})`;}
export default function MunicipalMap({uf,snapshot,preferences}:{uf:string;snapshot:ElectionSnapshot|null;preferences:WatchPreferences}){
  const patternId=useId(),{mapPatterns}=useDisplaySettings();
  const [geometry,setGeometry]=useState<Geometry|null>(null),[progress,setProgress]=useState<MunicipalProgressSnapshot|null>(null);
  const [leaders,setLeaders]=useState<Record<string,MunicipalLeader>>({}),[chosen,setChosen]=useState(''),[query,setQuery]=useState('');
  const [mode,setMode]=useState<'progress'|'leaders'>('progress'),[pending,setPending]=useState(false),[bulk,setBulk]=useState(false);
  const [progressError,setProgressError]=useState(''),[geometryError,setGeometryError]=useState(''),[leaderError,setLeaderError]=useState('');
  const bulkController=useRef<AbortController|null>(null);
  const municipalities=useMemo(()=>progress?.municipalities.length?progress.municipalities:snapshot?.municipalities||[],[progress,snapshot]);
  const favorites=useMemo(()=>new Set(preferences.regional.flatMap(s=>s.municipalityCodes)),[preferences.regional]);
  const city=municipalities.find(m=>m.code===chosen)||municipalities.find(m=>favorites.has(m.code))||municipalities[0];
  const selected=city?.code,result=selected?leaders[selected]:undefined,cityProgress=progress?.municipalities.find(m=>m.code===selected);
  const byIbge=useMemo(()=>new Map(municipalities.filter(m=>m.ibgeCode).map(m=>[m.ibgeCode!,m])),[municipalities]);
  const visible=municipalities.filter(m=>canonical(m.name).includes(canonical(query))&&(!pending||progress?.municipalities.find(p=>p.code===m.code)?.status!=='finished')).sort((a,b)=>Number(favorites.has(b.code))-Number(favorites.has(a.code))||a.name.localeCompare(b.name,'pt-BR'));
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    void fetch(`/maps/${uf}-municipal.json`,{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error();const data:Geometry=await response.json();if(data.uf!==uf||!Array.isArray(data.shapes))throw new Error();if(active)setGeometry(data);}).catch(()=>{if(active)setGeometryError('A malha do município não carregou. A lista de cidades continua disponível.');});
    return()=>{active=false;controller.abort();};
  },[uf]);
  useEffect(()=>{
    let active=true,busy=false;let controller:AbortController|null=null;
    async function refresh(){if(busy||document.hidden)return;busy=true;controller=new AbortController();const timer=window.setTimeout(()=>controller?.abort(),60_000);try{
      const response=await fetch(`/api/elections/municipal/progress?uf=${uf}`,{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error();
      const data:MunicipalProgressSnapshot=await response.json();if(data.uf!==uf||!Array.isArray(data.municipalities))throw new Error();
      if(active){setProgress(old=>old?.updatedAt&&(!data.updatedAt||data.updatedAt<old.updatedAt)?{...old,stale:true}:data);setProgressError(data.stale?'Progresso municipal sem nova atualização; últimos dados válidos preservados quando disponíveis.':'');}
    }catch{if(active)setProgressError('Não foi possível atualizar o progresso municipal. Últimos valores preservados.');}finally{clearTimeout(timer);busy=false;}}
    void refresh();const interval=setInterval(()=>void refresh(),30_000),visible=()=>{if(!document.hidden)void refresh();};document.addEventListener('visibilitychange',visible);
    return()=>{active=false;clearInterval(interval);controller?.abort();document.removeEventListener('visibilitychange',visible);};
  },[uf]);
  const loadCities=useCallback(async(codes:string[],signal:AbortSignal)=>{
    const response=await fetch(`/api/elections/municipal/leaders?uf=${uf}&cities=${codes.join(',')}`,{cache:'no-store',signal});
    if(!response.ok)throw new Error('Não foi possível consultar os votos municipais. Tente novamente.');
    const data:{uf:string;municipalities:MunicipalLeader[];stale:boolean}=await response.json();
    if(data.uf!==uf||!Array.isArray(data.municipalities)||data.municipalities.some(m=>!codes.includes(m.municipality.code)||!Array.isArray(m.candidates)))throw new Error('Resultado de outra cidade rejeitado.');
    if(signal.aborted)return false;
    setLeaders(old=>{const next={...old};for(const m of data.municipalities){const prior=old[m.municipality.code];next[m.municipality.code]=prior?.verifiedSignatures&&(!m.verifiedSignatures||prior.meta.updatedAt&&(!m.meta.updatedAt||m.meta.updatedAt<prior.meta.updatedAt))?{...prior,stale:true}:m;}return next;});
    setLeaderError(data.stale?'Algumas lideranças não atualizaram. Resultados anteriores são preservados quando disponíveis.':'');
    return !data.stale;
  },[uf]);
  useEffect(()=>{
    if(!selected)return;let controller:AbortController|null=null,busy=false;
    async function refresh(){if(document.hidden||busy||bulkController.current)return;busy=true;controller=new AbortController();const timer=setTimeout(()=>controller?.abort(),60_000);try{await loadCities([selected!],controller.signal);}catch(e){if(!controller.signal.aborted)setLeaderError(e instanceof Error?e.message:'Consulta municipal indisponível.');}finally{clearTimeout(timer);busy=false;}}
    void refresh();const interval=setInterval(()=>void refresh(),30_000),visible=()=>{if(!document.hidden)void refresh();};document.addEventListener('visibilitychange',visible);
    return()=>{clearInterval(interval);controller?.abort();document.removeEventListener('visibilitychange',visible);};
  },[selected,loadCities]);
  useEffect(()=>()=>{bulkController.current?.abort();},[]);
  async function loadAll(){
    if(bulkController.current)return;const controller=new AbortController();bulkController.current=controller;setBulk(true);setMode('leaders');
    try{for(let i=0;i<municipalities.length;i+=20){if(controller.signal.aborted)break;const updated=await loadCities(municipalities.slice(i,i+20).map(m=>m.code),controller.signal);if(!updated)break;}}catch(e){if(!controller.signal.aborted)setLeaderError(e instanceof Error?e.message:'Consulta interrompida. Cidades já recebidas permanecem no mapa.');}finally{if(bulkController.current===controller){bulkController.current=null;setBulk(false);}}
  }
  const tone=(code:string)=>presidentialMapTone(leaders[code]?{...leaders[code],uf:uf.toUpperCase(),name:leaders[code].municipality.name}:undefined);
  return <FocusPanel label="Mapa dos municípios"><section className="analysis-panel municipal-map panel" id="mapa-municipios" aria-labelledby="municipal-map-title"><header className="analysis-heading"><div><span className="section-tag"><MapPin size={15}/> DENTRO DO ESTADO · {uf.toUpperCase()}</span><h2 id="municipal-map-title">Apuração e liderança nos municípios</h2><p className="small muted">Progresso da eleição federal · liderança para presidente · {municipalities.length||'—'} municípios.</p></div></header>
    <div className="municipal-map-controls"><div className="position-switch" role="group" aria-label="Visualização do mapa municipal"><button aria-pressed={mode==='progress'} onClick={()=>setMode('progress')}>Apuração municipal</button><button aria-pressed={mode==='leaders'} onClick={()=>setMode('leaders')}>Liderança presidencial</button></div><button className="secondary-button" disabled={!municipalities.length||bulk} onClick={()=>void loadAll()}><RefreshCw size={14}/>{bulk?'Consultando cidades…':'Consultar todas as lideranças'}</button>{bulk&&<button className="text-link small" onClick={()=>{bulkController.current?.abort();bulkController.current=null;setBulk(false);}}>Interromper consulta</button>}</div>
    {(progressError||geometryError||leaderError)&&<p className="warning-text small" role="status">{[progressError,geometryError,leaderError].filter(Boolean).join(' ')}</p>}
    <p className="small muted municipal-map-coverage" role="status">{Object.values(leaders).filter(m=>m.verifiedSignatures).length} de {municipalities.length||'—'} cidades com consulta de votos. Clique em uma cidade para consultar sua liderança; o botão acima carrega todas em lotes.</p>
    <div className="municipal-map-layout"><div className="municipal-geography">{geometry?<svg viewBox={geometry.viewBox} role="group" aria-label={`Mapa dos municípios de ${uf.toUpperCase()}`}><defs>{Object.entries(PRESIDENTIAL_MAP_COLORS).map(([kind,color])=><pattern id={`${patternId}-${kind}`} key={kind} patternUnits="userSpaceOnUse" width="8" height="8"><rect width="8" height="8" fill={color}/>{kind==='flavio'?<circle cx="4" cy="4" r="1.4" fill="#fff" fillOpacity=".7"/>:<path d="M0 8L8 0" stroke="#fff" strokeOpacity=".5"/>}</pattern>)}</defs>{geometry.shapes.map(shape=>{
      const m=byIbge.get(shape.id),p=m?progress?.municipalities.find(p=>p.code===m.code):undefined;
      const filtered=pending&&p?.status==='finished',leader=m?tone(m.code):null,label=m?`${m.name}: ${percentage(p?.percentage)} apurado${mode==='leaders'?`; ${leader?.label}`:''}; selecionar município`:'Localidade da malha IBGE sem correspondência no catálogo atual do TSE';
      return <path key={shape.id} d={shape.d} fillRule="evenodd" fill={mode==='progress'?shade(p?.percentage):mapPatterns&&leader?`url(#${patternId}-${leader.kind})`:leader?.color||'#253344'} className={m?.code===selected?'municipal-shape selected':'municipal-shape'} opacity={filtered?0.25:1} role={m?'button':undefined} tabIndex={m?0:undefined} aria-label={label} onClick={()=>m&&setChosen(m.code)} onKeyDown={event=>{if(m&&(event.key==='Enter'||event.key===' ')){event.preventDefault();setChosen(m.code);}}}><title>{label}</title></path>;
    })}</svg>:<p className="analysis-empty muted">{geometryError||'Carregando a malha do IBGE…'}</p>}{mode==='leaders'?<div className="map-leader-legend">{([['lula','Lula'],['flavio','Flávio Bolsonaro'],['tie','Empate'],['other','Outro candidato'],['unavailable','Sem consulta ou dados']] as const).map(([kind,label])=><span key={kind}><i style={{background:PRESIDENTIAL_MAP_COLORS[kind]}}/>{label}</span>)}</div>:<div className="map-legend"><span>0%</span><div/><span>100%</span><small>Mais claro = mais seções totalizadas</small></div>}
    <p className="small muted">A lista permite acessar todas as cidades, inclusive localidades sem polígono na malha simplificada. Liderança parcial não significa eleição.</p></div>
    <div><div className="municipal-selected panel"><h3>{city?.name||'Escolha uma cidade'}</h3><dl className="selected-section-counts"><div><dt>Apurado</dt><dd>{percentage(cityProgress?.percentage)}</dd></div><div><dt>Seções apuradas</dt><dd>{number(cityProgress?.sections)}</dd></div><div><dt>Faltam</dt><dd>{number(remainingSections(cityProgress))}</dd></div></dl><p className="small muted">Progresso TSE: {clock(progress?.updatedAt||null)} · eleição federal.</p><h4>Presidente · votos na cidade</h4>{result?.candidates.length?result.candidates.map(c=><div className="municipal-leader-row" key={c.id}><div><b>{c.rank}º · {c.name}</b><small>{c.party} · {c.number}</small></div><div><strong>{percentage(c.percentage)}</strong><small>{number(c.votes)} votos</small></div></div>):<p className="small muted">{result?.meta.status==='waiting'?'Aguardando apuração.':result?.verifiedSignatures?'Votação não disponível no momento.':'Consultando votos da cidade…'}</p>}<p className="small muted">Votos TSE: {clock(result?.meta.updatedAt||null)}{result?.stale?' · último resultado válido':''}</p></div>
    <label className="search"><Search size={15}/><input aria-label="Buscar município no mapa" placeholder="Buscar município…" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="pending-toggle"><input type="checkbox" checked={pending} onChange={e=>setPending(e.target.checked)}/>Somente municípios ainda em apuração</label><div className="municipal-map-cities" aria-label="Municípios disponíveis no mapa">{visible.map(m=>{const p=progress?.municipalities.find(p=>p.code===m.code);return <button key={m.code} aria-pressed={selected===m.code} onClick={()=>setChosen(m.code)}><span>{favorites.has(m.code)?'★ ':''}{m.name}</span><strong>{percentage(p?.percentage)}</strong></button>;})}{!visible.length&&<p className="small muted">Nenhuma cidade corresponde aos filtros. Limpe a busca ou o filtro de apuração.</p>}</div></div></div>
    <p className="small muted analysis-note">Progresso e votos têm consultas e horários próprios. A cidade selecionada atualiza a cada 30 segundos; as demais lideranças mantêm o horário da última consulta. Use “Consultar todas as lideranças” para atualizar o conjunto.</p><div className="tool-actions">{progress?.source&&<a className="text-link small" href={progress.source} target="_blank" rel="noreferrer">Progresso TSE</a>}{result?.source&&<a className="text-link small" href={result.source} target="_blank" rel="noreferrer">Votos municipais TSE</a>}{geometry&&<a className="text-link small" href={geometry.source} target="_blank" rel="noreferrer">Malha IBGE</a>}</div>
  </section></FocusPanel>;
}
