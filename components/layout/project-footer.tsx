'use client';
import { useState } from 'react';
import { Check, Copy, ExternalLink, Heart } from 'lucide-react';
const PIX='VITORRODI12@GMAIL.COM';
export default function ProjectFooter(){
  const [copied,setCopied]=useState(false),[failed,setFailed]=useState(false);
  async function copyPix(){try{await navigator.clipboard.writeText(PIX);setCopied(true);setFailed(false);}catch{setFailed(true);setCopied(false);}}
  return <footer className="container project-footer">
    <div className="footer-info"><div><span className="footer-brand">RESULTADO ELEIÇÕES 2026</span><p className="small muted">Santa Catarina · 1º turno</p></div><p className="footer-disclaimer">Os dados eleitorais exibidos neste projeto são obtidos a partir das fontes oficiais de divulgação de resultados da Justiça Eleitoral. Este projeto é independente e não possui vínculo oficial com o Tribunal Superior Eleitoral (TSE).</p></div>
    <div className="creator-bar"><div><span className="section-tag">UM PROJETO INDEPENDENTE</span><p className="creator-credit">Feito por <strong>Vitor Rodi</strong></p></div><div className="creator-links"><a className="linkedin-button" href="https://br.linkedin.com/in/vitor-rodi" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">in</span> Meu LinkedIn <ExternalLink size={14}/></a><a className="text-link small" href="https://github.com/VitorRodi/resultado-eleicoes-2026" target="_blank" rel="noopener noreferrer">Código no GitHub <ExternalLink size={13}/></a></div></div>
    <div className="support-bar"><div><h3><Heart size={16} aria-hidden="true"/> Apoiar o projeto</h3><p className="small muted">Se este painel foi útil para você, pode contribuir via Pix.</p></div><div className="pix-controls"><code>{PIX}</code><button className="secondary-button" onClick={()=>void copyPix()}>{copied?<Check size={15}/>:<Copy size={15}/>} {copied?'Pix copiado':'Copiar Pix'}</button></div><p role="status" className="pix-status small">{failed?'Não foi possível copiar automaticamente. Selecione a chave acima para copiar.':copied?'Chave Pix copiada. Obrigado pelo apoio!':''}</p></div>
  </footer>;
}
