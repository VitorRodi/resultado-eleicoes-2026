import { CONFIG_URL, TSE_ORIGIN, fetchOfficial } from './client';
import { configurationSchema, municipalitySchema, type TseConfiguration } from './types';
import { parseResult } from './parser';
import { normalizeResult } from './normalize';
import { canonical, MUNICIPALITIES, OFFICE_CONFIG, TRACKED } from '../../lib/config';
import { SnapshotCache } from '../../lib/cache';
import { findCandidate, track } from '../../lib/tracking';
import { OFFICES, type ElectionSnapshot, type Office, type OfficeMeta, type MunicipalVote, type TrackedKey } from '../../types/election';

type Context = { config: TseConfiguration; cycle: string; pleito: string; elections: Record<Office,string>; municipalities: { name: string; code: string }[]; sources: string[] };
function directory(ctx: Omit<Context,'municipalities'|'sources'>, type: string, office: Office): string {
  const template = ctx.config.arq.find(a => a.tp === type)?.dir;
  if (!template) throw new Error(`Diretório ${type} ausente no TSE.`);
  const replacements: Record<string,string> = { base: TSE_ORIGIN, ambiente: 'oficial', ciclo: ctx.cycle,
    cd_eleicao: ctx.elections[office], cd_pleito: ctx.pleito, uf: type === 'ft' && office === 'president' ? 'br' : 'sc' };
  const result = template.replace(/<([^>]+)>/g, (_, token) => {
    if (!(token in replacements)) throw new Error(`Token TSE desconhecido: ${token}`);
    return replacements[token];
  });
  if (!result.startsWith(`${TSE_ORIGIN}/oficial/`)) throw new Error('Diretório TSE inválido.');
  return result.replace(/\/$/,'');
}
export function resultUrl(ctx: Context, office: Office, municipality?: string) {
  return `${directory(ctx,'u',office)}/sc${municipality || ''}-c${String(OFFICE_CONFIG[office].code).padStart(4,'0')}-e${ctx.elections[office].padStart(6,'0')}-u.jws`;
}
const contextCache = new SnapshotCache<Context | null>(300_000, (last) => last || null);
async function getContext(): Promise<Context> {
  const ctx = await contextCache.get(async () => {
    const config = configurationSchema.parse(await fetchOfficial(CONFIG_URL, 300_000));
    const pleito = config.pl.find(p => p.dt === '04/10/2026');
    if (!pleito || pleito.c !== 'ele2026') throw new Error('Pleito de 2026 não encontrado na configuração oficial.');
    const elections = {} as Record<Office,string>;
    for (const office of OFFICES) {
      const election = pleito.e.find(e => e.t === '1' && Number(e.tp) === OFFICE_CONFIG[office].type &&
        e.abr.some(a => ['sc','br'].includes(a.cd.toLowerCase()) && a.cp.some(c => Number(c.cd) === OFFICE_CONFIG[office].code)));
      if (!election) throw new Error(`Cargo ${office} não disponível para 2026.`);
      elections[office] = String(election.cd);
    }
    const partial = { config, cycle: pleito.c, pleito: String(pleito.cd), elections };
    const municipalityUrl = `${directory(partial,'cm','stateDeputy')}/mun-e${elections.stateDeputy.padStart(6,'0')}-cm.jws`;
    const municipalityConfig = municipalitySchema.parse(await fetchOfficial(municipalityUrl, 300_000));
    const sc = municipalityConfig.abr.find(a => a.cd.toLowerCase() === 'sc');
    if (!sc) throw new Error('SC ausente na configuração municipal.');
    const municipalities = MUNICIPALITIES.map(name => {
      const matches = sc.mu.filter(m => canonical(m.nm) === canonical(name));
      if (matches.length !== 1) throw new Error(`Código de ${name} não validado.`);
      const code = String(matches[0].cd).padStart(5,'0');
      if (!/^\d{5}$/.test(code)) throw new Error('Código municipal inválido.');
      return { name, code };
    });
    if (new Set(municipalities.map(m => m.code)).size !== 9) throw new Error('Municípios duplicados.');
    return { ...partial, municipalities, sources: [CONFIG_URL, municipalityUrl] };
  });
  if (!ctx) throw new Error('Configuração oficial indisponível.');
  return ctx;
}
export function emptySnapshot(): ElectionSnapshot {
  const emptyOffice: OfficeMeta = { status: 'unavailable', percentage: null, sections: null, totalSections: null, updatedAt: null, generation: null, seats: null };
  const emptyTracking = { candidate: null, voteDelta: null, rankDelta: null, previousRank: null, gapAbove: null };
  const rows = (): MunicipalVote[] => MUNICIPALITIES.map(name => ({ name, code: null, votes: null, percentage: null, status: 'unavailable', updatedAt: null }));
  return {
    status: 'unavailable', updatedAt: null, checkedAt: new Date().toISOString(), stale: false, warnings: [],
    progress: { percentage: null, sections: null, totalSections: null, office: 'governor' },
    president: [], governor: [], senator: [], federalDeputy: [], stateDeputy: [],
    leaders: { president: null, governor: null, senator: [] },
    offices: Object.fromEntries(OFFICES.map(o => [o, { ...emptyOffice }])) as Record<Office,OfficeMeta>,
    trackedCandidates: { danielaReinehr: { ...emptyTracking }, oscarGutz: { ...emptyTracking } },
    regionalMunicipalVotes: { danielaReinehr: rows(), oscarGutz: rows() },
    source: { name: 'TSE / Justiça Eleitoral', url: TSE_ORIGIN, verifiedSignatures: false, files: [CONFIG_URL] },
  };
}
async function mapLimited<T,R>(items: T[], fn: (item:T) => Promise<R>, concurrency = 6): Promise<R[]> {
  const output = new Array<R>(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(items.length,concurrency) }, async () => {
    while (next < items.length) { const i = next++; output[i] = await fn(items[i]); }
  }));
  return output;
}
async function loadSnapshot(previous: ElectionSnapshot | undefined): Promise<ElectionSnapshot> {
  const ctx = await getContext();
  const snapshot = emptySnapshot();
  snapshot.source.files = [...ctx.sources];
  let available = 0;
  await mapLimited([...OFFICES], async office => {
    const url = resultUrl(ctx,office); snapshot.source.files.push(url);
    try {
      const raw = await fetchOfficial(url);
      const result = parseResult(raw,office,ctx.elections[office]);
      const normalized = normalizeResult(result,office,directory(ctx,'ft',office));
      // A delayed CDN response must not roll a cargo back to an older generation.
      const prior = previous?.offices[office];
      if (prior?.updatedAt && normalized.meta.updatedAt && normalized.meta.updatedAt < prior.updatedAt)
        throw new Error('Geração anterior recebida.');
      snapshot[office] = normalized.candidates; snapshot.offices[office] = normalized.meta;
      available++;
      if (result.dv !== 's') snapshot.warnings.push(`${OFFICE_CONFIG[office].label}: divulgação suspensa pelo TSE.`);
    } catch {
      snapshot.stale = true;
      if (previous?.offices[office].generation) {
        snapshot[office] = previous[office]; snapshot.offices[office] = previous.offices[office];
      }
      snapshot.warnings.push(`${OFFICE_CONFIG[office].label}: atualização indisponível${previous?.offices[office].generation ? '; dados anteriores preservados' : ''}.`);
    }
  });
  if (!available) throw new Error('Resultados oficiais indisponíveis.');
  for (const key of Object.keys(TRACKED) as TrackedKey[]) {
    const config = TRACKED[key];
    const candidate = findCandidate(snapshot[config.office],config.name);
    snapshot.trackedCandidates[key] = track(candidate,previous?.trackedCandidates[key].candidate || null,snapshot[config.office]);
    if (!candidate) snapshot.warnings.push(`${config.name}: identificação oficial ainda indisponível.`);
  }
  const regionalTasks = (Object.keys(TRACKED) as TrackedKey[]).flatMap(key => ctx.municipalities.map(municipality => ({ key, municipality })));
  let regionalFailures = 0;
  const regional = await mapLimited(regionalTasks, async ({ key, municipality }) => {
    const office = TRACKED[key].office, url = resultUrl(ctx,office,municipality.code);
    snapshot.source.files.push(url);
    let row: MunicipalVote = { ...municipality, votes: null, percentage: null, status: 'waiting', updatedAt: null };
    try {
      const result = parseResult(await fetchOfficial(url),office,ctx.elections[office],municipality.code);
      const normalized = normalizeResult(result,office,directory(ctx,'ft',office));
      const candidateId = snapshot.trackedCandidates[key].candidate?.id;
      const candidate = normalized.candidates.find(c => c.id === candidateId);
      const prior = previous?.regionalMunicipalVotes[key].find(r => r.code === municipality.code);
      if (prior?.updatedAt && normalized.meta.updatedAt && normalized.meta.updatedAt < prior.updatedAt)
        throw new Error('Geração municipal anterior recebida.');
      row = { ...row, percentage: normalized.meta.percentage, status: normalized.meta.status, updatedAt: normalized.meta.updatedAt,
        votes: normalized.meta.status !== 'waiting' && candidate ? candidate.votes : null };
      if (['counting','finished'].includes(normalized.meta.status) && !candidate) row.status = 'unavailable';
    } catch {
      regionalFailures++;
      const previousRow = previous?.regionalMunicipalVotes[key].find(r => r.code === municipality.code);
      row = previousRow || { ...row, status: 'unavailable' };
    }
    return { key, row };
  });
  for (const key of Object.keys(TRACKED) as TrackedKey[])
    snapshot.regionalMunicipalVotes[key] = regional.filter(r => r.key === key).map(r => r.row);
  if (regionalFailures) {
    snapshot.stale = true;
    snapshot.warnings.push('Parte dos resultados municipais não atualizou. Valores anteriores, quando disponíveis, foram preservados.');
  }
  const metas = Object.values(snapshot.offices);
  snapshot.status = metas.every(m => m.status === 'finished') ? 'finished' : metas.some(m => ['counting','finished'].includes(m.status)) ? 'counting' : metas.some(m => m.status === 'waiting') ? 'waiting' : 'unavailable';
  const governor = snapshot.offices.governor;
  snapshot.progress = { percentage: governor.percentage, sections: governor.sections, totalSections: governor.totalSections, office: 'governor' };
  snapshot.updatedAt = metas.map(m => m.updatedAt).filter((d): d is string => !!d).sort().at(-1) || null;
  for (const office of ['president','governor'] as const) {
    const list = snapshot[office];
    snapshot.leaders[office] = list[0]?.rank && (!list[1] || list[0].votes > list[1].votes) ? list[0] : null;
  }
  snapshot.leaders.senator = snapshot.senator.filter(c => c.rank !== null).slice(0,2);
  snapshot.source.verifiedSignatures = true;
  snapshot.source.files.sort();
  return snapshot;
}
const snapshotCache = new SnapshotCache<ElectionSnapshot>(12_000, (last) => {
  const base = last || emptySnapshot();
  return { ...base, stale: true, checkedAt: new Date().toISOString(), warnings: ['Não foi possível atualizar o TSE. ' + (last ? 'Último resultado válido preservado.' : 'Aguardando disponibilidade da fonte oficial.')] };
});
export const getElectionSnapshot = () => snapshotCache.get(loadSnapshot);
