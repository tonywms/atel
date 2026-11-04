"use client";
import React,{createContext,useContext,useState} from "react"; import {req0,stock0,os0,assets0} from "@/lib/data";
const C=createContext<any>(null); const tm=()=>new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
export function Demo({children}:{children:React.ReactNode}){const[persona,setPersona]=useState("GESTOR"),[reqs,setReqs]=useState<any[]>([req0]),[stock,setStock]=useState<any[]>(stock0),[orders,setOrders]=useState<any[]>([os0]),[assets,setAssets]=useState<any[]>(assets0),[events,setEvents]=useState<any[]>([{time:"08:32",title:"API → WMS",detail:"REQ-45872 recebida para abastecimento do técnico Tony."}]);
const ev=(title:string,detail:string)=>setEvents(v=>[{time:tm(),title,detail},...v]);
const api=()=>{let n=45873+reqs.length;setReqs(v=>[{...req0,id:Date.now(),code:`REQ-${n}`,external:`API-${n}`,priority:"ALTA",items:[{sku:"ROT-001",name:"Roteador Mesh AX",qty:2,unit:"UN"},{sku:"CAB-001",name:"Cabo Drop Fibra",qty:50,unit:"M"}]},...v]);ev("Nova demanda via API",`REQ-${n} criada automaticamente no WMS.`)};
const next:any={RECEBIDA:"EM_SEPARACAO",EM_SEPARACAO:"SEPARADA",SEPARADA:"CONFERIDA",CONFERIDA:"AGUARDANDO_ACEITE"};
const advance=(id:number)=>setReqs(v=>v.map(r=>{if(r.id!==id)return r;let n=next[r.status]||r.status;if(n!==r.status)ev(n==="AGUARDANDO_ACEITE"?"Embarque concluído":"Operação CD",`${r.code}: ${r.status} → ${n}`);return{...r,status:n}}));
const accept=(id:number)=>setReqs(v=>v.map(r=>{if(r.id!==id||r.status!=="AGUARDANDO_ACEITE")return r;ev("Carga aceita",`${r.code}: TRÂNSITO → TEC-060 / Tony.`);return{...r,status:"RECEBIDA_TECNICO"}}));
const start=(id:number)=>{setOrders(v=>v.map(o=>o.id===id?{...o,status:"EM_ATENDIMENTO"}:o));ev("OS iniciada","OS-90001 em atendimento.")};
const finish=(id:number)=>{setOrders(v=>v.map(o=>o.id===id?{...o,status:"FINALIZADA",items:o.items.map((i:any)=>({...i,used:i.sku==="CAB-001"?18:i.sku==="CON-001"?3:1,reserved:0}))}:o));setStock(v=>v.map(s=>{let u=s.sku==="ONT-001"?1:s.sku==="CAB-001"?18:s.sku==="CON-001"?3:0;return{...s,physical:s.physical-u,reserved:0}}));setAssets(v=>v.map(a=>a.serial==="SN93829"?{...a,status:"INSTALADO",location:"Cliente • Maria Silva",contract:"CTR-10001",customer:"Maria Silva"}:a));ev("OS finalizada","SN93829 → COMODATO; 18m cabo + 3 conectores → CONSUMO.")};
const reverse=(serial:string)=>{setAssets(v=>v.map(a=>a.serial===serial?{...a,status:"EM_TRANSITO",location:"Retorno → CD Fortaleza",contract:"",customer:""}:a));ev("Logística reversa",`${serial} recolhido e enviado ao CD.`)};
const reset=()=>{setReqs([req0]);setStock(stock0);setOrders([os0]);setAssets(assets0);setEvents([]);setPersona("GESTOR")};
return <C.Provider value={{persona,setPersona,reqs,stock,orders,assets,events,api,advance,accept,start,finish,reverse,reset}}>{children}</C.Provider>}
export const useDemo=()=>useContext(C);
