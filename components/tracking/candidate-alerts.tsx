'use client';
import {Bell} from 'lucide-react';
import {clock} from '@/lib/formatting';
import {officeLabel} from '@/lib/config';
import type {Office} from '@/types/election';
import type {CandidateAlert} from '@/lib/live-features';
export default function CandidateAlerts({alerts,enabled,onToggle,onClear,uf}:{alerts:CandidateAlert[];enabled:boolean;onToggle:()=>void;onClear:()=>void;uf:string}){
  return <section className="candidate-alerts panel" aria-labelledby="alerts-title"><header><div><h2 id="alerts-title"><Bell size={17}/>Avisos do seu acompanhamento</h2><p className="small muted">Mudanças recebidas enquanto o painel está aberto.</p></div><div className="tool-actions"><button className="secondary-button" aria-pressed={enabled} onClick={onToggle}>{enabled?'Avisos ativados':'Ativar avisos'}</button>{!!alerts.length&&<button className="text-link small" onClick={onClear}>Limpar avisos</button>}</div></header><div aria-live="polite" aria-atomic="false">{alerts.length?<ul>{alerts.map(a=><li key={a.id}><b>{a.name}</b><span>{a.kind==='elected'?'Eleição confirmada pelo TSE':`Subiu de ${a.from}º para ${a.to}º por votos`}</span><small>{officeLabel(a.office as Office,uf)} · {clock(a.at)} · Brasília</small></li>)}</ul>:<p className="small muted alerts-empty">{enabled?'Os avisos aparecerão após uma nova atualização de um candidato acompanhado.':'Avisos pausados. Ative para acompanhar as próximas mudanças.'}</p>}</div></section>;
}
