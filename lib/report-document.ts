import { candidateReportHtml, type CandidateReport } from "./candidate-report";
import type { HistoricalCandidate } from "./historical-election";
import { voteChange } from "./historical-election";
import { groupAssociationRows } from "./sc-associations";
import { number, percentage } from "./formatting";
import { officeLabel } from "./config";
import {
  reportComparisonTotals,
  type ReportType,
  type ReportPersonalization,
} from "./report-options";

export type PreparedReport = CandidateReport & {
  type: ReportType;
  personalization: ReportPersonalization;
  historical?: HistoricalCandidate;
  separateAssociations?: boolean;
};
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const signed = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${number(value)}`;
const relative = (before: number | null, now: number | null) => {
  const change = voteChange(before, now);
  return change.relative === null
    ? before === 0 && now !== null
      ? "Base zero"
      : "—"
    : `${change.relative > 0 ? "+" : ""}${percentage(change.relative * 100)}`;
};
export function preparedReportHtml(
  report: PreparedReport,
  toolbar = false,
  display?: { largeText: boolean; highContrast: boolean },
): string {
  if (report.type === "state")
    return candidateReportHtml(report, toolbar, display);
  if (report.uf === "sc" && report.separateAssociations) {
    const documents = groupAssociationRows(report.rows).map(group => preparedReportHtml({
      ...report,
      separateAssociations: false,
      rows: group.rows,
      personalization: { ...report.personalization, title: [report.personalization.title, `${group.id} · ${group.name}`].filter(Boolean).join(" / ") },
    }, false, display));
    const sections = documents.map(html => html.match(/<main>[\s\S]*<\/main>/)![0].replace("<main>", '<main class="region-report">')).join("");
    return documents[0].replace(/<main>[\s\S]*<\/main>/, sections).replace("</style>", ".region-report + .region-report{break-before:page}</style>");
  }
  const history = report.historical;
  const known = report.rows.filter((row) => row.votes !== null);
  const totals = history ? reportComparisonTotals(report.rows, history) : null;
  const sum = known.length
    ? known.reduce((total, row) => total + row.votes!, 0)
    : null;
  const cities = [...report.rows].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  const top = [...known].sort((a, b) => b.votes! - a.votes!).slice(0, 10);
  const max = Math.max(1, ...top.map((row) => row.votes!));
  const person = report.personalization;
  const partial =
    known.length < report.rows.length ||
    report.rows.some((row) => row.stale) ||
    (totals && totals.paired < report.rows.length);
  const date = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(report.generatedAt));
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(report.candidate.name)} · Relatório municipal</title><style>
  *{box-sizing:border-box}body{margin:0;background:#eef2f1;color:#1b2c32;font:15px/1.6 Arial,sans-serif}main{max-width:1000px;margin:20px auto;background:white;padding:40px 48px;border-top:6px solid #17655c}a{color:#17655c}h1{font:38px/1.15 Georgia,serif;margin:12px 0}h2{font:25px/1.3 Georgia,serif}.edition{display:flex;justify-content:space-between;gap:16px;font-size:12px;border-bottom:1px solid #c9d4ce;padding-bottom:16px}.identity,.muted{color:#53656b}.personal{border-left:3px solid #17655c;padding-left:14px}.metrics{display:grid;grid-template-columns:repeat(${history ? 4 : 2},1fr);gap:20px;padding:24px 0;border-block:1px solid #c9d4ce}.metrics dt{font-size:12px;color:#53656b}.metrics dd{margin:6px 0 0;font-size:28px;font-weight:bold}.notice{background:#fff9ed;border-left:3px solid #ad7b2d;padding:14px 18px}.chart{break-inside:avoid}.chart svg{width:100%;height:auto}.table-scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:13px}caption{text-align:left;font:25px Georgia,serif;margin:30px 0 16px}th{text-align:left;color:#53656b;border-bottom:2px solid #17655c}td,th{padding:12px 8px;border-bottom:1px solid #e1e7e3}td:not(:first-child),th:not(:first-child){text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}tbody tr:nth-child(even){background:#f0f5f2}td small{display:block;color:#53656b}footer{border-top:2px solid #17655c;margin-top:30px;padding-top:18px;font-size:12px}button{font:inherit;background:#17655c;color:white;padding:12px 18px;border:0}.toolbar{max-width:1000px;margin:20px auto}.report-large{font-size:18px}.report-large table{font-size:16px}.report-contrast .muted,.report-contrast .identity,.report-contrast th,.report-contrast dt,.report-contrast small{color:#263c42}@media(max-width:620px){main{padding:24px 20px;margin:0}h1{font-size:30px}.metrics{grid-template-columns:1fr 1fr}.edition{flex-wrap:wrap}td:first-child{min-width:160px}}@page{size:A4;margin:13mm}@media print{body{background:white;font-size:11px}main{padding:10px 0;margin:0;max-width:none}.toolbar{display:none}h1{font-size:30px}.metrics dd{font-size:23px}table,.report-large table{font-size:10px}td,th{padding:7px}thead{display:table-header-group}tr,footer{break-inside:avoid}.table-scroll{overflow:visible}}
  </style></head><body class="${display?.largeText ? "report-large" : ""} ${display?.highContrast ? "report-contrast" : ""}">${toolbar ? '<div class="toolbar"><button onclick="window.print()">Imprimir / salvar PDF</button></div>' : ""}<main><header><div class="edition"><strong>RESULTADO ELEIÇÕES 2026</strong><span>${escape(report.stateName)} · 1º turno</span></div><p class="muted">${history ? "Comparação 2022 e 2026" : "Votos por município · 2026"}</p>${person.title ? `<h2>${escape(person.title)}</h2>` : ""}<h1>${escape(report.candidate.name)}</h1><p class="identity">${escape(officeLabel(report.candidate.office, report.uf))} · ${escape(report.candidate.number)} · ${escape(report.candidate.party)}</p>${person.name ? `<p class="personal">${escape(person.label)}<br><strong>${escape(person.name)}</strong></p>` : ""}${history ? `<p class="identity">Candidatura de 2022: ${escape(history.name)} · ${escape(history.number)} · ${escape(history.party)} · ${escape(officeLabel(history.office, report.uf))}</p>` : ""}</header><dl class="metrics">${history ? `<div><dt>Votos de 2022</dt><dd>${number(totals!.previous)}</dd></div><div><dt>Votos de 2026</dt><dd>${number(totals!.current)}</dd></div><div><dt>Diferença de votos</dt><dd>${signed(totals!.difference)}</dd></div><div><dt>Variação</dt><dd>${relative(totals!.previous, totals!.current)}</dd></div>` : `<div><dt>Votos nas cidades escolhidas</dt><dd>${number(sum)}</dd></div><div><dt>Cidades com votos</dt><dd>${known.length} de ${report.rows.length}</dd></div>`}</dl>${history ? `<p class="muted">Totais comparados em ${totals!.paired} de ${report.rows.length} cidades com dados nos dois anos.</p>` : ""}<p class="${partial ? "notice" : "muted"}">${partial ? "Consulta parcial. Confira as cidades sem dados ou com valores anteriores." : "Votos disponíveis em todas as cidades selecionadas."} Resultados de 2026 registram esta consulta e podem mudar.</p>${person.includeCharts && top.length ? `<section class="chart"><h2>Maiores votações de 2026 neste conjunto</h2><svg viewBox="0 0 740 ${top.length * 55}" role="img" aria-label="Votos de 2026 nas cidades com maior votação"><title>${escape(top.map((row) => `${row.name}: ${number(row.votes)} votos`).join("; "))}</title>${top.map((row, i) => `<text x="0" y="${i * 55 + 18}" fill="#34464c" font-size="15">${escape(row.name)}</text><rect x="0" y="${i * 55 + 28}" width="${(600 * row.votes!) / max}" height="12" rx="3" fill="#17655c"/><text x="735" y="${i * 55 + 38}" text-anchor="end" fill="#1b2c32" font-size="17">${number(row.votes)}</text>`).join("")}</svg></section>` : ""}<div class="table-scroll"><table><caption>${history ? "Comparação nas cidades escolhidas" : "Votos nas cidades escolhidas"}</caption><thead><tr><th>Município</th>${history ? "<th>2022</th>" : ""}<th>2026</th>${history ? "<th>Diferença</th><th>Variação</th>" : ""}</tr></thead><tbody>${cities
    .map((row) => {
      const before = history ? (history.votes[row.code] ?? null) : null;
      return `<tr><td>${escape(row.name)}${row.stale ? "<small>Último valor disponível</small>" : ""}</td>${history ? `<td>${number(before)}</td>` : ""}<td>${number(row.votes)}</td>${history ? `<td>${signed(voteChange(before, row.votes).difference)}</td><td>${relative(before, row.votes)}</td>` : ""}</tr>`;
    })
    .join(
      "",
    )}</tbody></table></div><p class="muted">${history ? "Diferença = 2026 − 2022. Variação = diferença ÷ votos de 2022 × 100. Quando a base de 2022 é zero, não há percentual de crescimento. " : ""}Zero é votação divulgada; “—” indica ausência de dados.</p><footer><p>Gerado em ${escape(date)} (Brasília) · Dados oficiais do TSE · Projeto independente.</p><p>Feito por <strong>Vitor Rodi</strong> · <a href="https://br.linkedin.com/in/vitor-rodi">linkedin.com/in/vitor-rodi</a><br><a href="https://resultado-eleicoes-2026.vercel.app/">resultado-eleicoes-2026.vercel.app</a></p></footer></main></body></html>`;
}
