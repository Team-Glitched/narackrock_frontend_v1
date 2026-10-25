"use client";
import { useCallback, useEffect, useRef } from "react";
import { NavigationHistory } from "@/features/navigation/browser-history";
export function useNavigationHistory<T>(snapshot:T,key:string,onRestore:(value:T)=>void,validate:(value:unknown)=>value is T){
  const controller=useRef<NavigationHistory<T>|null>(null);
  const restore=useRef(onRestore);
  useEffect(()=>{restore.current=onRestore;},[onRestore]);
  useEffect(()=>{
    const state=new NavigationHistory<T>(window.history,validate);controller.current=state;
    const saved=state.initialize(snapshot,key);if(saved!==null)restore.current(saved);
    const pop=(event:PopStateEvent)=>{const saved=state.restore(event.state);if(saved!==null)restore.current(saved);};
    window.addEventListener("popstate",pop);
    return()=>{window.removeEventListener("popstate",pop);controller.current=null;};
    // Capture the initial snapshot once. Subsequent renders are synchronized below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(()=>{controller.current?.sync(snapshot,key);},[snapshot,key]);
  return useCallback((fallback:()=>void,options?:{logical?:boolean})=>{if(options?.logical){controller.current?.replaceNext();fallback();}else if(controller.current?.canGoBack())window.history.back();else fallback();},[]);
}
