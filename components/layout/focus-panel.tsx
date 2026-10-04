'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Maximize,Minimize} from 'lucide-react';
export default function FocusPanel({children,label,actions}:{children:ReactNode;label:string;actions?:ReactNode}){
  const element=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const [native,setNative]=useState(false),[fallback,setFallback]=useState(false);
  const focused=native||fallback;
  useEffect(()=>{
    const onChange=()=>setNative(document.fullscreenElement===element.current);
    document.addEventListener('fullscreenchange',onChange);return()=>document.removeEventListener('fullscreenchange',onChange);
  },[]);
  useEffect(()=>{
    if(!fallback)return;
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){setFallback(false);trigger.current?.focus();}};
    document.addEventListener('keydown',onKey);
    return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',onKey);};
  },[fallback]);
  async function toggle(){
    if(document.fullscreenElement===element.current){await document.exitFullscreen();trigger.current?.focus();return;}
    if(fallback){setFallback(false);trigger.current?.focus();return;}
    try{if(!element.current?.requestFullscreen)throw new Error('Unavailable');await element.current.requestFullscreen();}
    catch{setFallback(true);}
  }
  return <div ref={element} className={`focus-panel ${fallback?'focus-fallback':''}`}><div className="focus-controls"><span className="small muted">{label}</span><div className="tool-actions">{actions}<button ref={trigger} className="secondary-button" onClick={()=>void toggle()} aria-pressed={focused} aria-label={`${focused?'Sair da tela cheia':'Tela cheia'}: ${label}`}>{focused?<Minimize size={15}/>:<Maximize size={15}/>} {focused?'Sair da tela cheia':'Tela cheia'}</button></div></div>{children}</div>;
}
