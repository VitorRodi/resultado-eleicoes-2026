'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CheckCheck, CirclePause, Clock3, ExternalLink, Radio, RefreshCw, ShieldCheck, TriangleAlert, Vote } from 'lucide-react';
import Avatar from '@/components/cards/avatar';
import TrackedCard from '@/components/tracking/tracked-card';
import RegionalChart from '@/components/charts/regional-chart';
import Ranking from '@/components/rankings/ranking';
import { number, percentage, clock } from '@/lib/formatting';
import { OFFICE_CONFIG } from '@/lib/config';
import { track } from '@/lib/tracking';
import type { Candidate, ElectionSnapshot } from '@/types/election';

function Leader({ office, candidates, state }: { office:'president'|'governor'|'senator'; candidates:Candidate[]; state?:ElectionSnapshot }) {
  const meta = state?.offices[office], waiting = !meta || meta.status === 'waiting';
  const tie = !waiting && office !== 'senator' && !candidates.length && !!state?.[office].length;
  return <article className="leader-card panel"><div className="leader-heading"><span className="eyebrow">{OFFICE_CONFIG[office].label.toUpperCase()}</span><span className="small muted">{office === 'senator' ? '2 vagas' : 'Em SC'}</span></div>
    {candidates.length ? candidates.map(c => <div className="leader-candidate" key={c.id}><Avatar name={c.name} url={c.photoUrl} large={office !== 'senator'} /><div className="leader-data"><h3>{c.name}</h3><p className="small muted">{c.party} · {c.number}</p><strong className="leader-percentage">{percentage(c.percentage)}</strong><p className="small muted">{number(c.votes)} votos</p>{c.officialStatus && <span className="official-pill">{c.officialStatus}</span>}</div></div>) : <div className="leader-waiting"><div className="ballot-symbol"><Vote size={27} strokeWidth={1.2} aria-hidden="true" /></div><h3>{tie ? 'Liderança empatada' : waiting ? 'Aguardando apuração' : 'Aguardando dados oficiais'}</h3><p className="small muted">{tie ? 'Consulte o ranking por votos abaixo.' : 'A liderança será exibida com os primeiros resultados.'}</p></div>}
    <div className="leader-footer"><span>{waiting ? 'Totalização não iniciada' : meta?.status === 'finished' ? 'Totalização final' : 'Liderança no resultado atual'}</span><ArrowUpRight size={14} aria-hidden="true" /></div>
  </article>;
}
export default function Dashboard() {
  const [snapshot,setSnapshot] = useState<ElectionSnapshot | null>(null);
  const [loading,setLoading] = useState(true), [error,setError] = useState<string | null>(null);
  const [countdown,setCountdown] = useState(15), [paused,setPaused] = useState(false);
  const busy = useRef(false), controller = useRef<AbortController | null>(null), nextUpdate = useRef(0);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true; setLoading(true); controller.current = new AbortController();
    const timeout = window.setTimeout(() => controller.current?.abort(),60_000);
    try {
      const response = await fetch('/api/elections/sc', { cache:'no-store', signal:controller.current.signal });
      if (!response.ok) throw new Error('Atualização indisponível.');
      const data: ElectionSnapshot = await response.json();
      if (!data?.offices || !data?.source || !data?.regionalMunicipalVotes) throw new Error('Resposta inválida.');
      setSnapshot(previous => {
        if (previous?.source.verifiedSignatures && !data.source.verifiedSignatures) return { ...previous,stale:true,checkedAt:data.checkedAt,warnings:data.warnings };
        if (previous && data.updatedAt && previous.updatedAt && data.updatedAt < previous.updatedAt) return previous;
        if (previous) for (const key of ['danielaReinehr','oscarGutz'] as const) {
          const office = key === 'danielaReinehr' ? 'federalDeputy' : 'stateDeputy';
          data.trackedCandidates[key] = data.offices[office].generation === previous.offices[office].generation
            ? { ...data.trackedCandidates[key],voteDelta:previous.trackedCandidates[key].voteDelta,rankDelta:previous.trackedCandidates[key].rankDelta,previousRank:previous.trackedCandidates[key].previousRank }
            : track(data.trackedCandidates[key].candidate,previous.trackedCandidates[key].candidate,data[office]);
        }
        return data;
      }); setError(null);
    } catch (e) {
      setError(e instanceof DOMException && e.name === 'AbortError' ? 'A consulta demorou mais que o esperado. Tentaremos novamente.' : 'Não foi possível atualizar. Os últimos dados recebidos continuam na tela.');
    } finally {
      clearTimeout(timeout); busy.current = false; setLoading(false); nextUpdate.current = Date.now()+15_000; setCountdown(15);
    }
  },[]);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      const hidden = document.hidden; setPaused(hidden);
      if (hidden || busy.current) return;
      const left = Math.max(0, Math.ceil((nextUpdate.current-Date.now())/1000)); setCountdown(left);
      if (left === 0) void refresh();
    },1000);
    return () => clearInterval(timer);
  },[refresh]);
  const waiting = snapshot?.status === 'waiting';
  const warnings = [...(snapshot?.warnings || []), ...(error ? [error] : [])];
  return <>
    <a className="skip-link" href="#main">Ir para os resultados</a>
    <div className="topbar"><div className="container topbar-inner"><span>ELEIÇÕES GERAIS <b>2026</b></span><span>1º TURNO <i /> 04 OUTUBRO</span><a href="https://resultados.tse.jus.br/" target="_blank" rel="noreferrer">Portal oficial do TSE <ExternalLink size={12} /></a></div></div>
    <header className="container masthead"><div className="brand"><div className="sc-mark" aria-hidden="true">SC<span>2026</span></div><div><p className="eyebrow">SANTA CATARINA</p><h1>RESULTADO<br className="mobile-break" /> ELEIÇÕES 2026<span className="title-dot">.</span></h1></div></div><div className="live-block"><span className={`live-badge ${warnings.length ? 'live-warning' : ''}`}><Radio size={15} /> {snapshot?.status === 'finished' ? 'TOTALIZAÇÃO FINAL' : warnings.length ? 'ATUALIZAÇÃO COM AVISO' : 'AO VIVO'}</span><p className="small muted">Dados oficiais. Leitura independente.</p></div></header>
    <main id="main" className="container">
      <section className="progress-panel" aria-labelledby="progress-title"><div className="progress-main"><div className="progress-kicker"><span className="eyebrow" id="progress-title">TOTALIZAÇÃO EM SANTA CATARINA</span><ShieldCheck size={18} className="accent" /></div><div className="progress-value"><strong>{percentage(snapshot?.progress.percentage)}</strong><span className="muted small">das seções totalizadas<br />referência: governador</span></div><div className="progress-track" role="progressbar" aria-label="Seções totalizadas para governador em SC" aria-valuemin={0} aria-valuemax={100} aria-valuenow={snapshot?.progress.percentage ?? undefined}><span style={{width:`${snapshot?.progress.percentage || 0}%`}} /></div><p className="small muted">{snapshot?.progress.totalSections != null ? `${number(snapshot.progress.sections)} de ${number(snapshot.progress.totalSections)} seções` : 'Consultando a fonte oficial'}</p></div>
        <div className="counting-status"><div className="status-icon">{waiting ? <CirclePause size={22} /> : snapshot?.status === 'finished' ? <CheckCheck size={22} /> : <Clock3 size={22} />}</div><div><h2>{waiting ? 'Aguardando início da totalização' : snapshot?.status === 'counting' ? 'A apuração está em andamento' : snapshot?.status === 'finished' ? 'Totalização finalizada' : loading ? 'Consultando dados oficiais' : 'Aguardando disponibilidade do TSE'}</h2><p className="muted small">{waiting ? 'Os votos aparecerão aqui assim que forem divulgados pelo TSE.' : 'Atualização automática a cada 15 segundos.'}</p></div></div>
        <div className="refresh-block"><button className="refresh-button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} />{loading ? 'Atualizando…' : 'Atualizar agora'}</button><p className="small muted">Consulta: <span>{clock(snapshot?.checkedAt || null)}</span></p><p className="small muted">{paused ? 'Pausado em segundo plano' : loading ? 'Buscando atualização' : `Próxima consulta em ${countdown}s`}</p></div>
      </section>
      {warnings.length > 0 && <aside className="warning" role="status"><TriangleAlert size={18} aria-hidden="true" /><div><strong>Atualização com aviso</strong>{warnings.map((w,i) => <p key={`${w}-${i}`}>{w}</p>)}</div></aside>}
      <div className="section-heading"><div><span className="section-tag">PANORAMA ESTADUAL</span><h2>Quem está na frente em SC?</h2></div><span className="muted small">Liderança parcial não significa eleição.</span></div>
      <section className="leaders-grid" aria-label="Lideranças em Santa Catarina"><Leader office="president" candidates={snapshot?.leaders.president ? [snapshot.leaders.president] : []} state={snapshot || undefined} /><Leader office="governor" candidates={snapshot?.leaders.governor ? [snapshot.leaders.governor] : []} state={snapshot || undefined} /><Leader office="senator" candidates={snapshot?.leaders.senator || []} state={snapshot || undefined} /></section>
      <div className="section-heading" id="acompanhamento"><div><span className="section-tag">ACOMPANHAMENTO ESPECIAL</span><h2>Dois nomes. Cada atualização.</h2></div><span className="muted small">Votação nominal e situação oficial separadas.</span></div>
      <section className="two-columns" aria-label="Candidatos acompanhados"><TrackedCard trackKey="danielaReinehr" data={snapshot?.trackedCandidates.danielaReinehr} meta={snapshot?.offices.federalDeputy} /><TrackedCard trackKey="oscarGutz" data={snapshot?.trackedCandidates.oscarGutz} meta={snapshot?.offices.stateDeputy} /></section>
      <p className="proportional-note"><ShieldCheck size={16} aria-hidden="true" /> Deputados são eleitos pelo sistema proporcional. A posição por votos não define a eleição.</p>
      <div className="section-heading" id="regiao"><div><span className="section-tag">OESTE CATARINENSE</span><h2>A votação na nossa região</h2></div><span className="region-counter">9 MUNICÍPIOS</span></div>
      <section className="two-columns regional-grid" aria-label="Votação regional"><RegionalChart trackKey="danielaReinehr" rows={snapshot?.regionalMunicipalVotes.danielaReinehr} candidate={snapshot?.trackedCandidates.danielaReinehr.candidate} /><RegionalChart trackKey="oscarGutz" rows={snapshot?.regionalMunicipalVotes.oscarGutz} candidate={snapshot?.trackedCandidates.oscarGutz.candidate} /></section>
      <div className="section-heading"><div><span className="section-tag">RESULTADOS POR CARGO</span><h2>Os rankings de Santa Catarina</h2></div><a className="text-link small" href="#federalDeputy">Ir para deputados <ArrowUpRight size={14} /></a></div>
      <section className="major-rankings" aria-label="Rankings majoritários">{(['president','governor','senator'] as const).map(office => <Ranking key={office} office={office} candidates={snapshot?.[office]} meta={snapshot?.offices[office]} />)}</section>
      <section className="two-columns deputy-section" aria-label="Rankings de deputados">{(['federalDeputy','stateDeputy'] as const).map(office => <Ranking key={office} office={office} candidates={snapshot?.[office]} meta={snapshot?.offices[office]} />)}</section>
      <section className="source-section" id="fontes"><ShieldCheck size={22} className="accent" /><div><h2>Direto da fonte oficial</h2><p className="muted small">{snapshot?.source.verifiedSignatures ? 'Arquivos oficiais do TSE com assinatura digital verificada.' : 'Os resultados são exibidos somente após a validação da fonte oficial.'} Cada cargo e município pode ter um horário de totalização diferente.</p><details><summary>Consultar arquivos e metodologia</summary><p className="small muted">O progresso do cabeçalho usa as seções totalizadas para governador. Cada ranking mostra o progresso do próprio cargo. Percentuais e situações são os publicados pelo TSE; posições são calculadas por votos nominais, com empates. A primeira comparação aparece após duas atualizações de votação. Ausência de resultado municipal não entra na soma regional.</p><ul>{snapshot?.source.files.map(url => <li key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></li>)}</ul><a className="text-link small" href="https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados" target="_blank" rel="noreferrer">Documentação técnica TSE 2026 <ExternalLink size={12} /></a></details></div></section>
    </main>
    <footer className="container footer"><div><span className="footer-brand">RESULTADO ELEIÇÕES 2026</span><p className="small muted">Santa Catarina · 1º turno</p></div><p>Os dados eleitorais exibidos neste projeto são obtidos a partir das fontes oficiais de divulgação de resultados da Justiça Eleitoral. Este projeto é independente e não possui vínculo oficial com o Tribunal Superior Eleitoral (TSE).</p><a href="https://github.com/VitorRodi/resultado-eleicoes-2026" target="_blank" rel="noreferrer" className="small text-link">Código aberto <ExternalLink size={12} /></a></footer>
  </>;
}
