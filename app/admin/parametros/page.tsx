"use client";
import { useEffect, useMemo, useState } from "react";
import { atelSupabase } from "@/lib/atelSupabaseV08";
import styles from "./parametros.module.css";
import { ATEL_GRUPOS, ATEL_MASTER, ATEL_TESTE } from "@/lib/atelPermissoesMenu";

type Entry = { rota: string; liberado: boolean };
const sections = Object.entries(ATEL_GRUPOS).map(([name,links]) => ({name, links}));
const routes = Array.from(new Set(sections.flatMap(g => g.links.map(([,url]) => url))));
export default function ParametrosPage(){
 const [master,setMaster] = useState(false);
 const [uid,setUid] = useState("");
 const [rules,setRules] = useState<Record<string,boolean>>({});
 const [loading,setLoading] = useState(true);
 const [saving,setSaving] = useState(false);
 const [notice,setNotice] = useState("");
 const [filter,setFilter] = useState("Todos");
 useEffect(()=>{let alive=true;const client=atelSupabase();if(!client){setLoading(false);return;}
  void (async()=>{
   const {data:{user}}=await client.auth.getUser();
   if(!alive)return;
   if(user?.email?.toLowerCase()!==ATEL_MASTER){setLoading(false);return;}
   setMaster(true);
   // Busca a identidade do usuário alvo por função restrita ao Master.
   const {data:target,error:targetError}=await client.rpc("atel_uid_homologacao");
   if(!alive)return;
   if(targetError||!target){setNotice("Usuário de homologação não localizado no Supabase.");setLoading(false);return;}
   setUid(String(target));
   const {data,error}=await client.from("atel_menu_permissoes").select("rota,liberado").eq("usuario_id",String(target));
   if(!alive)return;
   if(error){setNotice("Falha ao carregar permissões: "+error.message);setLoading(false);return;}
   setRules(Object.fromEntries((data??[]).map((p:Entry)=>[p.rota,p.liberado])));
   setLoading(false);
  })();return()=>{alive=false};
 },[]);
 const count=useMemo(()=>routes.filter(r=>rules[r]!==false).length,[rules]);
 async function save(){const client=atelSupabase();if(!client||!uid)return;setSaving(true);setNotice("");
  const payload=routes.map(rota=>({usuario_id:uid,rota,liberado:rules[rota]!==false,atualizado_em:new Date().toISOString()}));
  const {error}=await client.from("atel_menu_permissoes").upsert(payload,{onConflict:"usuario_id,rota"});
  setNotice(error?"Erro ao salvar: "+error.message:"Permissões gravadas no Supabase. Atualize a sessão do usuário de teste para aplicar.");setSaving(false);
 }
 if(loading)return <main className={styles.screen}><div className={styles.loading}>Carregando permissões...</div></main>;
 if(!master)return <main className={styles.screen}><div className={styles.loading}>Acesso exclusivo do administrador Master.</div></main>;
 const enabled=(route:string)=>rules[route]!==false;
 const totalOff=routes.length-count;
 const shown=sections.filter(s=>filter==="Todos"||(filter==="Coletor"?s.name==="Coletor":s.name!=="Coletor"));
 return <main className={styles.screen}>
  <div className={styles.container}>
   <header className={styles.hero}>
    <div className={styles.heroTop}><div className={styles.eyebrow}>ADMINISTRAÇÃO <span>/</span> CONTROLE DE ACESSO</div><span className={styles.masterTag}>● PAINEL MASTER</span></div>
    <div className={styles.heroRow}><div><h1>Permissões do Menu</h1><p>Gerencie a visibilidade das rotinas e sub-rotinas do WMS Expert.</p></div><div className={styles.target}><span>USUÁRIO GERENCIADO</span><strong>{ATEL_TESTE}</strong></div></div>
   </header>
   <section className={styles.metrics} aria-label="Resumo das permissões">
    <div className={styles.metric}><span>ROTINAS MAPEADAS</span><strong>{routes.length}</strong><small>Web e coletor</small></div>
    <div className={styles.metric}><span>LIBERADAS</span><strong className={styles.green}>{count}</strong><small>Acesso habilitado</small></div>
    <div className={styles.metric}><span>OCULTAS</span><strong className={styles.orange}>{totalOff}</strong><small>Acesso desabilitado</small></div>
    <div className={styles.metric}><span>COBERTURA</span><strong>{Math.round(count/Math.max(routes.length,1)*100)}%</strong><div className={styles.progress}><div style={{width:`${count/Math.max(routes.length,1)*100}%`}}/></div></div>
   </section>
   <div className={styles.toolbar}><div className={styles.filterGroup}><span className={styles.toolbarLabel}>EXIBIR</span>{["Todos","Web","Coletor"].map(v=><button type="button" key={v} className={`${styles.filterBtn} ${filter===v?styles.filterActive:""}`} onClick={()=>setFilter(v)}>{v==="Todos"?"Todas as rotinas":v}</button>)}</div><button className={styles.save} type="button" onClick={()=>void save()} disabled={saving||!uid}>{saving?"Salvando...":"Salvar permissões"} <span>✓</span></button></div>
   {notice&&<div className={styles.notice} role="status">{notice}</div>}
   <div className={styles.sections}>
    {shown.map(section=>{
     const active=section.links.filter(([,r])=>enabled(r)).length;
     const all=active===section.links.length;
     return <section key={section.name} className={styles.group}>
      <div className={styles.groupHead}><div className={styles.groupTitle}><span className={styles.groupIcon}>{section.name==="Coletor"?"▣":"▦"}</span><div><h2>{section.name}</h2><small>{active} de {section.links.length} sub-rotinas liberadas</small></div></div><label className={styles.groupToggle}><input type="checkbox" checked={all} onChange={e=>setRules(p=>({...p,...Object.fromEntries(section.links.map(([,r])=>[r,e.target.checked]))}))}/><span>Liberar todas</span></label></div>
      <div className={styles.entries}>{section.links.map(([name,route])=><label key={route} className={styles.entry}><div className={styles.entryLeft}><div className={styles.entryGlyph}>↳</div><div className={styles.entryText}><strong>{name}</strong><small>{route}</small></div></div><div className={styles.entryRight}><span className={`${styles.state} ${enabled(route)?styles.stateOn:styles.stateOff}`}>{enabled(route)?"Liberada":"Oculta"}</span><input className={styles.switchInput} type="checkbox" checked={enabled(route)} onChange={e=>setRules(p=>({...p,[route]:e.target.checked}))}/><span className={`${styles.switch} ${enabled(route)?styles.switchOn:""}`} aria-hidden="true"><i/></span></div></label>)}</div>
     </section>
    })}
   </div>
   <footer className={styles.footer}>As alterações serão aplicadas ao usuário de homologação após salvar. A configuração é armazenada no Supabase.</footer>
  </div>
 </main>;
}
