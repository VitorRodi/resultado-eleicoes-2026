'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {Contrast,Type} from 'lucide-react';
const DisplayContext=createContext({largeText:false,mapPatterns:false});
export const useDisplaySettings=()=>useContext(DisplayContext);
export function DisplaySettingsProvider({children}:{children:ReactNode}){
  const [settings,setSettings]=useState({largeText:false,mapPatterns:false});
  useEffect(()=>{void Promise.resolve().then(()=>{try{const saved=JSON.parse(localStorage.getItem('eleicoes-2026:display:v1')||'{}');setSettings({largeText:saved.largeText===true,mapPatterns:saved.mapPatterns===true});}catch{/* Use readable defaults. */}});},[]);
  function toggle(key:'largeText'|'mapPatterns'){
    const next={...settings,[key]:!settings[key]};setSettings(next);
    try{localStorage.setItem('eleicoes-2026:display:v1',JSON.stringify(next));}catch{/* Settings remain active during this visit. */}
  }
  return <DisplayContext value={settings}><div className="display-root" data-large-text={settings.largeText||undefined}>
    <div className="display-settings" role="group" aria-label="Opções de acessibilidade"><button aria-pressed={settings.largeText} onClick={()=>toggle('largeText')}><Type size={15}/>Texto maior</button><button aria-pressed={settings.mapPatterns} onClick={()=>toggle('mapPatterns')}><Contrast size={15}/>Padrões no mapa</button></div>{children}
  </div></DisplayContext>;
}
