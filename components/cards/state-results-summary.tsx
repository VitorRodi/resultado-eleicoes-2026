"use client";

import { useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import Avatar from "./avatar";
import { confirmedElected } from "@/lib/elected";
import { leadingPositions } from "@/lib/ranking";
import { number, percentage } from "@/lib/formatting";
import type { Candidate, ElectionSnapshot, Office, OfficeMeta } from "@/types/election";

const stateOffices = ["governor", "senator", "federalDeputy", "stateDeputy"] as const;
type StateOffice = typeof stateOffices[number];

function CandidateRows({ candidates }: { candidates: Candidate[] }) {
  return <ol className="state-summary-list">
    {candidates.map(candidate => <li key={candidate.id}>
      <span className="state-summary-rank">{candidate.rank}º</span>
      <Avatar name={candidate.name} url={candidate.photoUrl} />
      <div className="state-summary-identity">
        <h4>{candidate.name}</h4>
        <p className="small muted">{candidate.party} · {candidate.number}</p>
        {candidate.officialElected ? <span className="state-summary-elected"><ShieldCheck size={13} aria-hidden="true" /> {candidate.officialStatus || "Eleito"}</span>
          : candidate.officialStatus && <span className="small muted">{candidate.officialStatus}</span>}
      </div>
      <div className="state-summary-votes"><strong>{number(candidate.votes)}</strong><span className="small muted">votos · {percentage(candidate.percentage)}</span></div>
    </li>)}
  </ol>;
}

function OfficeSummary({ office, title, candidates, meta, verified }: {
  office: StateOffice; title: string; candidates: Candidate[]; meta?: OfficeMeta; verified: boolean;
}) {
  const [choice, setChoice] = useState<"votes" | "elected" | null>(null);
  const active = verified && (meta?.status === "counting" || meta?.status === "finished");
  const elected = active ? confirmedElected(candidates) : [];
  const mode = choice || (elected.length ? "elected" : "votes");
  const leading = active ? leadingPositions(candidates, office === "governor" ? 2 : meta?.seats) : [];
  const rows = mode === "elected" ? elected : leading;
  const proportional = office === "federalDeputy" || office === "stateDeputy";
  return <article className="state-office-summary panel" aria-labelledby={`summary-${office}`}>
    <header><div><h3 id={`summary-${office}`}>{title}</h3><p className="small muted">{meta?.seats ? `${meta.seats} ${meta.seats === 1 ? "vaga" : "vagas"} · ` : ""}{percentage(meta?.percentage)} apurado</p></div><span className="state-summary-count"><ShieldCheck size={14} aria-hidden="true" /> {active ? elected.length : "—"} {elected.length === 1 ? "eleito" : "eleitos"}</span></header>
    <div className="position-switch" role="group" aria-label={`Visualização do resumo de ${title}`}>
      <button aria-pressed={mode === "votes"} onClick={() => setChoice("votes")}>Mais votados</button>
      <button aria-pressed={mode === "elected"} onClick={() => setChoice("elected")}>Eleitos confirmados</button>
    </div>
    {rows.length ? <div className="state-summary-scroll" tabIndex={0} role="region" aria-label={`${mode === "elected" ? "Eleitos confirmados" : "Mais votados"} · ${title}`}><CandidateRows candidates={rows} /></div>
      : <p className="state-summary-empty small muted">{!active ? meta?.status === "waiting" ? "Aguardando o início da apuração deste cargo." : "Aguardando dados oficiais deste cargo." : mode === "elected" ? "Nenhum eleito confirmado pelo TSE até o momento." : "Aguardando a votação dos candidatos."}</p>}
    <footer className="small muted">{mode === "elected" ? "Situação de eleição confirmada pelo TSE." : proportional ? "Posição por votos nominais. A eleição depende também do partido ou da federação." : office === "governor" ? "Os dois mais votados. A situação informa eleição ou segundo turno." : "Mais votados nas primeiras posições. A eleição é confirmada pelo TSE."}{meta?.stale && " Último resultado válido; atualização indisponível."}</footer>
  </article>;
}

export default function StateResultsSummary({ uf, stateName, snapshot, onSeeResults }: {
  uf: string; stateName: string; snapshot: ElectionSnapshot | null; onSeeResults: () => void;
}) {
  const verified = !!snapshot?.source.verifiedSignatures;
  const presidentMeta = snapshot?.offices.president;
  const presidentActive = verified && (presidentMeta?.status === "counting" || presidentMeta?.status === "finished");
  const presidents = presidentActive ? leadingPositions(snapshot?.president || [], 2) : [];
  const titles: Record<Office, string> = { president: "Presidente", governor: "Governador", senator: "Senadores", federalDeputy: "Deputados federais", stateDeputy: uf === "df" ? "Deputados distritais" : "Deputados estaduais" };
  return <section className="state-results-summary" aria-labelledby="state-summary-title">
    <div className="section-heading"><div><span className="section-tag">Resultado estadual · {uf.toUpperCase()}</span><h2 id="state-summary-title">Mais votados e eleitos em {stateName}</h2><p className="section-description muted">Votação na própria UF e confirmação de eleitos por cargo.</p></div></div>
    <article className="state-office-summary state-president-summary panel" aria-labelledby="summary-president">
      <header><div><h3 id="summary-president">Presidente em {stateName}</h3><p className="small muted">Os dois mais votados no estado · {percentage(presidentMeta?.percentage)} apurado</p></div></header>
      {presidents.length ? <CandidateRows candidates={presidents} /> : <p className="state-summary-empty small muted">Aguardando a votação presidencial deste estado.</p>}
      <footer className="small muted">Os votos acima são de {stateName}. A eleição presidencial é definida pela votação nacional.{presidentMeta?.stale && " Último resultado válido; atualização indisponível."}</footer>
    </article>
    <div className="state-office-summary-grid">{stateOffices.map(office => <OfficeSummary key={office} office={office} title={titles[office]} candidates={snapshot?.[office] || []} meta={snapshot?.offices[office]} verified={verified} />)}</div>
    <button className="text-link" onClick={onSeeResults}>Consultar o ranking completo por cargo <ArrowRight size={16} aria-hidden="true" /></button>
  </section>;
}
