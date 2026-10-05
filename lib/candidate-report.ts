import type { Candidate, Municipality, OfficeMeta } from "../types/election";
import type { MunicipalExportRow } from "./municipal-export";
import { number, percentage } from "./formatting";
import { officeLabel } from "./config";
import type { ReportPersonalization } from "./report-options";
export type RegionCatalog = Record<
  string,
  { uf: string; name: string; regionId: string; regionName: string }
>;
export type CandidateReport = {
  uf: string;
  stateName: string;
  candidate: Candidate;
  meta: OfficeMeta;
  stateStale: boolean;
  generatedAt: string;
  municipalities: Municipality[];
  rows: MunicipalExportRow[];
  regions: RegionCatalog;
  personalization?: ReportPersonalization;
};
export function reportDistribution(report: CandidateReport) {
  const municipalities = new Map(
    report.municipalities.map((city) => [city.code, city]),
  );
  const seen = new Set<string>();
  const cities = report.rows.filter(
    (row) =>
      municipalities.has(row.code) &&
      !seen.has(row.code) &&
      (seen.add(row.code), true),
  );
  const known = cities.filter(
    (row): row is MunicipalExportRow & { votes: number } => row.votes !== null,
  );
  const groups = new Map<
    string,
    {
      id: string;
      name: string;
      votes: number;
      known: number;
      total: number;
      stale: boolean;
    }
  >();
  for (const city of report.municipalities) {
    const region = city.ibgeCode ? report.regions[city.ibgeCode] : undefined;
    if (region?.uf !== report.uf) continue;
    const group = groups.get(region.regionId) || {
      id: region.regionId,
      name: region.regionName,
      votes: 0,
      known: 0,
      total: 0,
      stale: false,
    };
    group.total++;
    groups.set(group.id, group);
  }
  let unmapped = 0;
  for (const row of known) {
    const city = municipalities.get(row.code)!,
      region = city.ibgeCode ? report.regions[city.ibgeCode] : undefined;
    if (region?.uf !== report.uf) {
      unmapped++;
      continue;
    }
    const group = groups.get(region.regionId)!;
    group.votes += row.votes;
    group.known++;
    group.stale ||= row.stale;
  }
  const ordered = [...known].sort(
    (a, b) => b.votes - a.votes || a.name.localeCompare(b.name, "pt-BR"),
  );
  const regions = [...groups.values()]
    .filter((region) => region.known > 0)
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, "pt-BR"));
  const total = known.reduce((sum, row) => sum + row.votes, 0),
    positive = ordered[0]?.votes > 0;
  return {
    cities,
    known: known.length,
    total,
    unmapped,
    complete:
      known.length === report.municipalities.length &&
      !known.some((row) => row.stale),
    ordered,
    regions,
    bestCities: positive
      ? ordered.filter((row) => row.votes === ordered[0].votes)
      : [],
    bestRegions:
      regions[0]?.votes > 0
        ? regions.filter((row) => row.votes === regions[0].votes)
        : [],
  };
}
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "medium",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(value))
    : "Horário indisponível";
function bars(title: string, rows: { name: string; votes: number }[]) {
  const max = Math.max(1, ...rows.map((row) => row.votes));
  return `<section class="chart"><h2>${escape(title)}</h2>${rows.length ? `<svg viewBox="0 0 740 ${rows.length * 55}" role="img" aria-label="${escape(title)}"><title>${escape(title)} — ${escape(rows.map((row) => `${row.name}: ${number(row.votes)} votos`).join("; "))}</title>${rows.map((row, i) => `<text x="0" y="${i * 55 + 18}" fill="#34464c" font-size="15">${escape(row.name)}</text><rect x="0" y="${i * 55 + 28}" width="${(600 * row.votes) / max}" height="12" rx="3" fill="#17655c"/><text x="735" y="${i * 55 + 38}" text-anchor="end" fill="#1b2c32" font-size="17" font-weight="bold">${number(row.votes)}</text>`).join("")}</svg>` : "<p>Sem votos municipais disponíveis.</p>"}</section>`;
}
export function candidateReportHtml(
  report: CandidateReport,
  toolbar = true,
  display?: { largeText: boolean; highContrast: boolean },
) {
  const d = reportDistribution(report),
    c = report.candidate,
    active =
      c.rank !== null && ["counting", "finished"].includes(report.meta.status),
    elected = active && c.officialElected;
  const status = !active
    ? "Aguardando divulgação"
    : elected
      ? "Eleito · confirmação oficial"
      : c.officialStatus || "Eleição ainda não confirmada";
  const cityLeader =
    d.bestCities.map((city) => city.name).join(", ") || "Ainda não disponível";
  const regionLeader =
    d.bestRegions.map((region) => region.name).join(", ") ||
    "Ainda não disponível";
  const times = d.cities
    .filter((row) => row.votes !== null && row.updatedAt)
    .map((row) => row.updatedAt!)
    .sort();
  const summary = active
    ? `${escape(c.name)} recebeu ${number(c.votes)} votos em ${escape(report.stateName)}, ocupa a ${c.rank}ª posição por votos e tem a situação oficial “${escape(c.officialStatus || "ainda não informada")}”.`
    : "O TSE ainda não divulgou votação válida para esta candidatura.";
  const allCities = [...d.cities].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório · ${escape(c.name)} · Eleições 2026</title><style>
  *{box-sizing:border-box}body{margin:0;background:#eef2f1;color:#1b2c32;font:15px/1.6 Arial,sans-serif}a{color:#17655c}button{font:inherit;background:#17655c;color:#fff;border:0;padding:12px 20px;border-radius:5px;cursor:pointer}.toolbar{max-width:1000px;margin:20px auto;padding:0 28px;display:flex;gap:20px;align-items:center}main{background:white;max-width:1000px;margin:20px auto;padding:48px 56px;border-top:7px solid #17655c}.edition{display:flex;justify-content:space-between;border-bottom:1px solid #c9d4ce;padding-bottom:18px;font-size:12px;letter-spacing:.06em}.eyebrow{color:#53656b;font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin-top:32px}h1{font:42px/1.12 Georgia,serif;margin:8px 0 14px}h2{font:25px/1.25 Georgia,serif;margin:0 0 18px}h3{font-size:15px;margin:0}.identity{color:#53656b}.status{display:inline-block;background:${elected ? "#e8f3ee" : "#f0f3f4"};padding:5px 12px;margin-top:12px;border-left:3px solid #17655c;font-weight:bold}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin:28px 0;border-top:1px solid #c9d4ce;border-bottom:1px solid #c9d4ce;padding:25px 0}.metrics dt{font-size:12px;color:#53656b}.metrics dd{font-size:29px;font-weight:bold;margin:6px 0 0;font-variant-numeric:tabular-nums}.reading{font-size:17px}.notice{padding:15px 18px;border-left:3px solid #ad7b2d;background:#fff9ed;font-size:13px;margin:22px 0}.highlights{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin:28px 0}.highlights p{font:24px/1.3 Georgia,serif;margin:7px 0}.highlights small{color:#53656b}.chart{margin:35px 0;break-inside:avoid}.chart svg{display:block;width:100%;height:auto}.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}caption{text-align:left;font:25px Georgia,serif;padding:25px 0 15px}th{text-align:left;color:#53656b;font-size:12px;border-bottom:2px solid #17655c;padding:10px 6px}td{padding:9px 6px;border-bottom:1px solid #e1e7e3}td:nth-child(2),th:nth-child(2){text-align:right;font-variant-numeric:tabular-nums}.details{font-size:12px;color:#53656b;border-top:1px solid #c9d4ce;margin-top:30px;padding-top:20px}footer{display:flex;justify-content:space-between;gap:20px;border-top:2px solid #17655c;margin-top:35px;padding-top:20px;font-size:13px}footer p{margin:0}.region-caption{font-size:12px;color:#53656b}.muted{color:#53656b}@media(max-width:620px){main{margin:0;padding:28px 20px}h1{font-size:32px}.metrics{grid-template-columns:1fr 1fr}.highlights{grid-template-columns:1fr}.edition,footer{flex-wrap:wrap}.toolbar{padding:0 20px}td,th{min-width:100px}td:first-child{min-width:160px}}@page{size:A4;margin:13mm}@media print{body{background:#fff;font-size:11px}.toolbar{display:none}main{margin:0;max-width:none;padding:12px 0;border-top-width:4px}h1{font-size:32px}.metrics dd{font-size:23px}.chart{break-inside:avoid}table{font-size:10px}thead{display:table-header-group}tr{break-inside:avoid}td{padding:5px 6px}th{padding:8px 6px}.reading{font-size:14px}.notice{margin:14px 0}.highlights{margin:20px 0}.highlights p{font-size:20px}.chart{margin:24px 0}footer{break-inside:avoid}a{color:#17655c;text-decoration:none}}
  .report-large{font-size:18px}.report-large table{font-size:16px}.report-large th,.report-large .details,.report-large .region-caption,.report-large footer,.report-large .notice{font-size:15px}.report-contrast{color:#102027}.report-contrast .muted,.report-contrast .identity,.report-contrast .details,.report-contrast small,.report-contrast .eyebrow,.report-contrast th,.report-contrast .region-caption,.report-contrast dt{color:#263c42}.report-contrast a{color:#064a42}@media print{.report-large{font-size:11px}.report-large table{font-size:10px}}
  </style></head><body class="${display?.largeText ? "report-large" : ""} ${display?.highContrast ? "report-contrast" : ""}">${toolbar ? '<div class="toolbar"><button onclick="window.print()">Imprimir / salvar como PDF</button><span>Relatório de uma consulta · resultados podem mudar</span></div>' : ""}<main><header><div class="edition"><strong>RESULTADO ELEIÇÕES 2026</strong><span>${escape(report.stateName)} · 1º turno</span></div><p class="eyebrow">Relatório de candidatura</p>${report.personalization?.title ? `<h2>${escape(report.personalization.title)}</h2>` : ""}<h1>${escape(c.name)}</h1><p class="identity">${escape(c.fullName)}<br>${escape(officeLabel(c.office, report.uf))} · ${escape(c.number)} · ${escape(c.party)}${c.federation ? ` · ${escape(c.federation)}` : ""}</p><span class="status">${escape(status)}</span>${report.personalization?.name ? `<p>${escape(report.personalization.label)}<br><strong>${escape(report.personalization.name)}</strong></p>` : ""}</header><dl class="metrics"><div><dt>Votos no estado</dt><dd>${number(active ? c.votes : null)}</dd></div><div><dt>Votação nominal</dt><dd>${percentage(active ? c.percentage : null)}</dd></div><div><dt>${report.meta.status === "finished" ? "Posição final por votos" : "Posição por votos"}</dt><dd>${active ? `${c.rank}º` : "—"}</dd></div><div><dt>Vagas neste cargo</dt><dd>${number(report.meta.seats)}</dd></div></dl><p class="reading">${summary}</p><p class="muted">${["stateDeputy", "federalDeputy"].includes(c.office) ? "A posição nominal não define a eleição no sistema proporcional. A situação acima vem da confirmação oficial do TSE." : "A posição nesta consulta não substitui a situação oficial publicada pelo TSE."}</p>${report.stateStale ? '<p class="notice">O resultado estadual foi preservado após falha de atualização. O horário abaixo identifica a última divulgação disponível.</p>' : ""}<p class="notice">${d.known} de ${report.municipalities.length} municípios com votos disponíveis. ${d.complete ? "Consulta municipal concluída." : "Distribuição municipal parcial ou com valores preservados em falha."} ${report.meta.status === "finished" ? "" : "A apuração de 2026 ainda pode estar em andamento."} As cidades são consultadas em momentos diferentes; sua soma pode diferir do total estadual.</p><section class="highlights"><div><h3>Maior votação municipal${d.complete ? "" : " entre os dados disponíveis"}</h3><p>${escape(cityLeader)}</p><small>${d.bestCities.length ? `${number(d.bestCities[0].votes)} votos${d.bestCities.length > 1 ? " em cada cidade empatada" : ""}` : "Sem quantidade disponível"}</small></div><div><h3>Região com mais votos${d.complete ? "" : " entre os dados disponíveis"}</h3><p>${escape(regionLeader)}</p><small>${d.bestRegions.length ? `${number(d.bestRegions[0].votes)} votos${d.bestRegions.length > 1 ? " em cada região empatada" : ""}` : "Sem quantidade disponível"}</small></div></section>${report.personalization?.includeCharts === false ? "" : bars("As 10 cidades com mais votos", d.ordered.slice(0, 10)) + bars("As 10 regiões com mais votos", d.regions.slice(0, 10))}<p class="region-caption">Regiões geográficas imediatas do <a href="https://servicodados.ibge.gov.br/api/docs/localidades">IBGE</a>, associadas pelo código IBGE do catálogo municipal do TSE. Valores somam apenas os municípios consultados com votos disponíveis.${d.unmapped ? ` ${d.unmapped} municípios com votos não tiveram região identificada e ficaram fora do gráfico regional.` : ""}</p><div class="table-scroll"><table><caption>Cobertura de cada região</caption><thead><tr><th>Região imediata</th><th>Votos disponíveis</th><th>Municípios com votos</th></tr></thead><tbody>${d.regions.map((r) => `<tr><td>${escape(r.name)}</td><td>${number(r.votes)}</td><td>${r.known} de ${r.total}${r.stale ? " · valores preservados" : ""}</td></tr>`).join("")}</tbody></table><table><caption>Votos em todos os municípios</caption><thead><tr><th>Município</th><th>Votos</th><th>Condição da consulta</th></tr></thead><tbody>${allCities.map((row) => `<tr><td>${escape(row.name)}</td><td>${number(row.votes)}</td><td>${row.votes === null ? "Indisponível / não consultado" : row.stale ? "Último valor disponível" : "Votos disponíveis"}</td></tr>`).join("")}</tbody></table></div><section class="details"><p>Resultado estadual: ${escape(date(report.meta.updatedAt))} (Brasília). Consulta do relatório: ${escape(date(report.generatedAt))} (Brasília).</p><p>Resultados municipais: ${escape(date(times[0] || null))} até ${escape(date(times.at(-1) || null))}. Zero é uma quantidade divulgada; “—” indica ausência de votos disponíveis.</p><p>Fonte dos votos e situação: <a href="https://resultados.tse.jus.br/">Tribunal Superior Eleitoral</a>. Projeto independente, sem vínculo com o TSE. O documento registra os dados desta consulta e não atualiza após o download.</p></section><footer><p>Feito por <strong>Vitor Rodi</strong><br><a href="https://br.linkedin.com/in/vitor-rodi">linkedin.com/in/vitor-rodi</a></p><p><a href="https://resultado-eleicoes-2026.vercel.app/">resultado-eleicoes-2026.vercel.app</a></p></footer></main></body></html>`;
}
