'use client';
import {useState} from 'react';
import {Link,Copy,X} from 'lucide-react';
import {sharedPanelLink} from '@/lib/live-features';
import type {WatchPreferences} from '@/types/election';
export default function SharePanel({uf,preferences}:{uf:string;preferences:WatchPreferences}){
  const [link,setLink]=useState(''),[status,setStatus]=useState('');
  function open(){try{setLink(sharedPanelLink(window.location.origin,uf,preferences));setStatus('');}catch(e){setStatus(e instanceof Error?e.message:'Não foi possível gerar o link.');}}
  async function copy(){try{await navigator.clipboard.writeText(link);setStatus('Link copiado. Quem abrir verá os candidatos e cidades deste painel.');}catch{setStatus('Selecione o link abaixo e copie para compartilhar.');}}
  return <><button className="secondary-button" onClick={open}><Link size={15}/>Compartilhar meu painel</button>{link&&<div className="share-panel-box panel"><div><h3>Compartilhe seus candidatos e cidades</h3><button className="icon-button" aria-label="Fechar link do painel" onClick={()=>setLink('')}><X size={16}/></button></div><p className="small muted">O link abre uma prévia. Quem receber escolhe se quer salvar esses favoritos no próprio navegador.</p><input aria-label="Link do painel compartilhado" readOnly value={link} onFocus={e=>e.currentTarget.select()}/><button className="secondary-button" onClick={()=>void copy()}><Copy size={15}/>Copiar link do painel</button></div>}{status&&<p className="small accent" role="status">{status}</p>}</>;
}
