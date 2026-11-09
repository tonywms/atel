"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { atelSupabase } from "../../../lib/atelSupabaseV08";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";

const ORG = "6ea04673-4deb-42cf-a001-dbb027120103";
type Candidate = {
 material_id:string; idempresa:number; idproduto:number; estado:string;
 sku_atel:string; descricao_atel:string; codigo_erp:string|null; descricao_erp:string;
 classificacao:string; unidade_compativel:boolean; rastreio_compativel:boolean;
 motivo_pendencia:string|null; evidencia:Record<string,unknown>;
};
const styleInput:React.CSSProperties={padding:11,border:"1px solid #b7cad9",borderRadius:9,width:"100%",color:"#17324a",background:"#fff"};
export default function HomologacaoERPPage(){
 const [rows,setRows]=useState<Candidate[]>([]);
 const [selected,setSelected]=useState<string>("");
 const [reason,setReason]=useState("");
 const [identity,setIdentity]=useState(false);
 const [serial,setSerial]=useState(false);
 const [unit,setUnit]=useState(false);
 const [meter,setMeter]=useState(false);
 const [loading,setLoading]=useState(false);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState("");
 const [filter,setFilter]=useState("");
 const [error,setError]=useState("");
 const client=useMemo(()=>atelSupabase(),[]);
 const refresh=useCallback(async()=>{
  if(!client){setError("Conexão Supabase indisponível: confira URL e chave publicável usadas por lib/atelSupabaseV08.ts. Nenhuma homologação foi alterada.");return;}
  setLoading(true);setError("");
  try{
   const {data:auth,error:authError}=await client.auth.getUser();
   if(authError)throw new Error(`Falha na autenticação Supabase: ${authError.message}`);
   if(!auth.user)throw new Error("Sessão Supabase ausente: o login visual do ATEL não substitui uma sessão Supabase autenticada.");
   const {data,error:rpcError}=await client.rpc("atel_v59_listar_homologacoes",{p_organizacao_id:ORG});
   if(rpcError)throw new Error(`Supabase RPC ${rpcError.code || "SEM_CODIGO"}: ${rpcError.message}${rpcError.details ? " | " + rpcError.details : ""}`);
   if(!Array.isArray(data))throw new Error("Resposta de homologação inválida.");
   setRows(data as Candidate[]);
  }catch(e){const x=e as {message?:string;code?:string;details?:string};setRows([]);setError([x?.code,x?.message,x?.details].filter(Boolean).join(" | ") || "Falha desconhecida na consulta. Verifique o console do navegador.");}
  finally{setLoading(false);}
 },[client]);
 useEffect(()=>{void refresh();},[refresh]);
 const current=rows.find(r=>`${r.material_id}:${r.idproduto}`===selected);
 const filtered=rows.filter(r=>[r.sku_atel,r.descricao_atel,r.codigo_erp||"",r.descricao_erp,r.estado].join(" ").toLowerCase().includes(filter.toLowerCase()));
 const needSerial=!!current&&!current.rastreio_compativel;
 const needUnit=!!current&&!current.unidade_compativel;
 const needMeter=current?.evidencia?.rastreio_atel==="metragem";
 const canApprove=!!current&&current.estado==="PENDENTE"&&reason.trim().length>=20&&identity&&(!needSerial||serial)&&(!needUnit||unit)&&(!needMeter||meter)&&!saving;
 function choose(r:Candidate){setSelected(`${r.material_id}:${r.idproduto}`);setReason("");setIdentity(false);setSerial(false);setUnit(false);setMeter(false);setMessage("");}
 async function approve(){
  if(!client||!current||!canApprove)return;
  if(!window.confirm(`Confirmar APROVAÇÃO INDIVIDUAL do material ${current.sku_atel} para o produto ERP ${current.idproduto}? Esta ação criará o vínculo efetivo.`))return;
  setSaving(true);setError("");setMessage("");
  try{
   const {data,error:rpcError}=await client.rpc("atel_v58_homologar_produto",{
    p_organizacao_id:ORG,p_material_id:current.material_id,p_idempresa:current.idempresa,p_idproduto:current.idproduto,
    p_justificativa:reason.trim(),p_confirmar_identidade:true,p_aceitar_serial:serial,p_aceitar_unidade:unit,p_aceitar_metragem:meter
   });
   if(rpcError)throw new Error(`Supabase RPC ${rpcError.code || "SEM_CODIGO"}: ${rpcError.message}${rpcError.details ? " | " + rpcError.details : ""}`);
   setMessage(`Homologação registrada: ${JSON.stringify(data)}`);
   setSelected("");setReason("");setIdentity(false);setSerial(false);setUnit(false);setMeter(false);
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Erro ao aprovar");}
  finally{setSaving(false);}
 }
 return <main className="hv-root">
  <style>{` 
   .hv-root{--ink:#142d43;--muted:#6d8090;--line:#dae5ec;--blue:#116d95;--navy:#103b56;--bg:#f2f6f9;color:var(--ink);background:transparent;padding:4px 0 30px;font-family:inherit}
   .hv-root *{box-sizing:border-box}.hv-wrap{max-width:1580px;margin:auto}.hv-hero{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:16px 22px;border-radius:14px;background:linear-gradient(110deg,#123b55,#0c6585);color:white;box-shadow:0 8px 25px #103d551a}.hv-eyebrow{font-size:10px;font-weight:800;letter-spacing:2px;color:#9edbe9;text-transform:uppercase}.hv-hero h1{font-size:22px;font-weight:800;margin:5px 0 3px}.hv-hero p{font-size:12px;color:#d6e9f1;margin:0}.hv-refresh{border:1px solid #a4d3e3;border-radius:9px;padding:9px 14px;color:#fff;background:#ffffff17;font-weight:700;cursor:pointer}.hv-refresh:disabled{opacity:.5}.hv-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin:14px 0}.hv-stat{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 16px;min-height:72px;box-shadow:0 3px 12px #20425b09}.hv-stat span{font-size:11px;color:var(--muted);font-weight:700}.hv-stat strong{display:block;font-size:25px;line-height:1.35;font-weight:800;color:#173c54}.hv-main{display:grid;grid-template-columns:minmax(400px,1.13fr) minmax(400px,.87fr);gap:14px;align-items:start}.hv-panel{border:1px solid var(--line);border-radius:13px;background:white;overflow:hidden;box-shadow:0 3px 14px #15364d0a}.hv-panelhead{padding:15px 17px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px}.hv-panelhead h2{font-size:14px;font-weight:800;margin:0}.hv-panelhead small{font-size:11px;color:var(--muted)}.hv-filter{width:100%;padding:10px 12px;border:1px solid #cbdce6;border-radius:9px;background:#f8fbfd;color:var(--ink);outline:none;font-size:12px}.hv-filter:focus,.hv-textarea:focus{border-color:#1384ad;box-shadow:0 0 0 3px #1384ad20}.hv-tablewrap{overflow:auto;max-height:620px}.hv-table{width:100%;border-collapse:collapse;text-align:left;font-size:12px}.hv-table th{position:sticky;top:0;z-index:1;background:#f4f8fb;color:#627d8d;font-size:10px;letter-spacing:.6px;text-transform:uppercase;padding:11px 13px;border-bottom:1px solid var(--line)}.hv-table td{padding:11px 13px;border-bottom:1px solid #eaf0f4;vertical-align:middle}.hv-table tbody tr{cursor:pointer}.hv-table tbody tr:hover{background:#f2f9fc}.hv-table tbody tr.hv-selected{background:#eaf5fa;box-shadow:inset 3px 0 #087ca6}.hv-name{font-weight:800;color:#1b4159;font-size:12px}.hv-sub{color:#7a8b9b;font-size:10px;margin-top:3px}.hv-chip{display:inline-flex;align-items:center;padding:4px 7px;border-radius:5px;background:#eef5f9;color:#315c72;font-weight:800;font-size:10px;white-space:nowrap}.hv-chip.warn{background:#fff3dc;color:#94600b}.hv-chip.ok{background:#e4f6ed;color:#18734d}.hv-detail{padding:17px}.hv-empty{padding:52px 20px;text-align:center;color:#7b90a1;font-size:13px}.hv-label{font-size:10px;color:#70899a;font-weight:800;letter-spacing:1px;text-transform:uppercase}.hv-product{border:1px solid #e1eaf0;border-radius:10px;padding:12px;margin:9px 0;background:#fafcfe}.hv-product strong{display:block;font-size:13px;margin-top:5px}.hv-product small{display:block;color:#6d8191;margin-top:5px}.hv-pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}.hv-alert{padding:11px 12px;border-radius:9px;background:#fff7e9;border:1px solid #f4dfb4;color:#87591b;font-size:11px;margin:13px 0}.hv-check{display:flex;align-items:flex-start;gap:9px;padding:10px 11px;border:1px solid #e1eaf0;border-radius:8px;font-size:12px;line-height:1.5;cursor:pointer;margin-top:8px}.hv-check input{accent-color:#0d799d;margin-top:3px}.hv-textarea{width:100%;padding:11px;border:1px solid #cbdce6;border-radius:9px;resize:vertical;font:inherit;font-size:12px;margin-top:7px;min-height:95px}.hv-approve{width:100%;padding:12px;border:0;border-radius:9px;background:#0b7b78;color:white;font-weight:800;cursor:pointer;margin-top:13px}.hv-approve:disabled{background:#bdcbd2;cursor:not-allowed}.hv-note{font-size:10px;color:#718595;line-height:1.5;margin-top:10px}.hv-error{background:#fff0ee;color:#9d2921;padding:13px;border-radius:9px;margin:13px 0}.hv-success{background:#e6f8ef;color:#146c4a;padding:13px;border-radius:9px;margin:13px 0}
   @media(max-width:1050px){.hv-main{grid-template-columns:1fr}.hv-tablewrap{max-height:400px}}@media(max-width:640px){.hv-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.hv-pair{grid-template-columns:1fr}.hv-hero{padding:15px}.hv-hero h1{font-size:19px}.hv-table th:nth-child(3),.hv-table td:nth-child(3){display:none}}
  `}</style>
  <div className="hv-wrap">
   <header className="hv-hero">
    <div><div className="hv-eyebrow">WMS EXPERT / ERP · GOVERNANÇA DE CADASTRO</div><h1>Homologação de produtos</h1><p>Conciliação ATEL × ERP · Aprovação controlada e rastreável</p></div>
    <button type="button" className="hv-refresh" onClick={()=>void refresh()} disabled={loading||saving}><RefreshCw size={14} style={{display:"inline",verticalAlign:"middle",marginRight:6}}/>{loading?"Atualizando...":"Atualizar dados"}</button>
   </header>
   <section className="hv-stats">
    <div className="hv-stat"><span>CANDIDATOS</span><strong>{error?"—":rows.length}</strong></div>
    <div className="hv-stat"><span>PENDENTES</span><strong>{error?"—":rows.filter(r=>r.estado==="PENDENTE").length}</strong></div>
    <div className="hv-stat"><span>APROVADOS</span><strong>{error?"—":rows.filter(r=>r.estado==="APROVADO").length}</strong></div>
    <div className="hv-stat"><span>COM DIVERGÊNCIAS</span><strong>{error?"—":rows.filter(r=>!r.unidade_compativel||!r.rastreio_compativel||r.evidencia?.rastreio_atel==="metragem").length}</strong></div>
   </section>
   {error&&<div role="alert" className="hv-error"><AlertTriangle size={15} style={{display:"inline",marginRight:7}}/>{error}</div>}
   {message&&<div role="status" className="hv-success"><CheckCircle2 size={15} style={{display:"inline",marginRight:7}}/>{message}</div>}
   <div className="hv-main">
    <section className="hv-panel">
     <div className="hv-panelhead"><h2>Produtos para homologação</h2><small>{filtered.length} registros</small></div>
     <div style={{padding:"12px 14px"}}><input aria-label="Pesquisar candidato" className="hv-filter" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Pesquisar SKU, descrição, código ERP ou situação..."/></div>
     <div className="hv-tablewrap"><table className="hv-table"><thead><tr><th>Material ATEL</th><th>Produto ERP</th><th>Conferência</th></tr></thead><tbody>
      {filtered.map(r=><tr key={`${r.material_id}:${r.idproduto}`} tabIndex={0} role="button" aria-label={`Analisar ${r.sku_atel}`} className={selected===`${r.material_id}:${r.idproduto}`?"hv-selected":""} onClick={()=>choose(r)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choose(r);}}}>
       <td><div className="hv-name">{r.sku_atel} · {r.descricao_atel}</div><div className="hv-sub">SKU ATEL · {r.classificacao.replaceAll("_"," ")}</div></td>
       <td><div className="hv-name">{r.codigo_erp??"—"} · {r.descricao_erp}</div><div className="hv-sub">ID ERP {r.idproduto}</div></td>
       <td><span className={`hv-chip ${r.estado==="APROVADO"?"ok":(!r.unidade_compativel||!r.rastreio_compativel||r.evidencia?.rastreio_atel==="metragem")?"warn":""}`}>{r.estado==="APROVADO"?"Aprovado":(!r.unidade_compativel||!r.rastreio_compativel||r.evidencia?.rastreio_atel==="metragem")?"Revisar":"Pendente"}</span></td>
      </tr>)}
     </tbody></table>{!loading&&!error&&filtered.length===0&&<div className="hv-empty">Nenhum candidato encontrado para o filtro.</div>}</div>
    </section>
    <section className="hv-panel">
     <div className="hv-panelhead"><h2>Análise e decisão</h2><span className="hv-chip">Homologação individual</span></div>
     {!current?<div className="hv-empty"><ShieldCheck size={32} style={{margin:"0 auto 12px",opacity:.45}}/><div>Selecione um produto na tabela para examinar a correspondência e as divergências.</div></div>:<div className="hv-detail">
      <div className="hv-pair"><div className="hv-product"><span className="hv-label">Cadastro ATEL</span><strong>{current.descricao_atel}</strong><small>SKU {current.sku_atel} · {String(current.evidencia?.unidade_atel??"—")} · {String(current.evidencia?.rastreio_atel??"—")}</small></div><div className="hv-product"><span className="hv-label">Cadastro ERP</span><strong>{current.descricao_erp}</strong><small>Código {current.codigo_erp??"—"} · ID {current.idproduto} · {String(current.evidencia?.unidade_erp??"—")}</small></div></div>
      <div className="hv-alert"><strong>Auditoria de compatibilidade</strong><div style={{marginTop:5}}>Unidade: {current.unidade_compativel?"Compatível":"Divergente"} · Rastreio serial: {current.rastreio_compativel?"Sem divergência identificada":"Divergente"}</div><div style={{marginTop:5}}>{current.motivo_pendencia||"Nenhuma divergência registrada."}</div></div>
      <div className="hv-label" style={{marginTop:17}}>Declarações obrigatórias</div>
      <label className="hv-check"><input type="checkbox" checked={identity} onChange={e=>setIdentity(e.target.checked)} disabled={current.estado!=="PENDENTE"}/>Confirmo que conferi a identidade comercial deste produto.</label>
      {needSerial&&<label className="hv-check"><input type="checkbox" checked={serial} onChange={e=>setSerial(e.target.checked)} disabled={current.estado!=="PENDENTE"}/>Reconheço a divergência de controle serial entre ATEL e ERP.</label>}
      {needUnit&&<label className="hv-check"><input type="checkbox" checked={unit} onChange={e=>setUnit(e.target.checked)} disabled={current.estado!=="PENDENTE"}/>Validei a divergência de unidade e a necessidade de regra de conversão.</label>}
      {needMeter&&<label className="hv-check"><input type="checkbox" checked={meter} onChange={e=>setMeter(e.target.checked)} disabled={current.estado!=="PENDENTE"}/>Validei a regra operacional de metragem para este material.</label>}
      <label htmlFor="hv-reason" className="hv-label" style={{display:"block",marginTop:18}}>Justificativa formal da aprovação</label>
      <textarea id="hv-reason" className="hv-textarea" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Descreva as evidências da conferência e a decisão (mínimo de 20 caracteres)." disabled={current.estado!=="PENDENTE"}/>
      <button type="button" className="hv-approve" disabled={!canApprove} onClick={()=>void approve()}>{saving?"Registrando decisão...":"Confirmar homologação individual"}</button>
      <div className="hv-note">A decisão será registrada no Supabase com o usuário responsável. A homologação não executa movimentações de estoque. Divergências operacionais exigem tratamento próprio.</div>
     </div>}
    </section>
   </div>
  </div>
 </main>;
}
