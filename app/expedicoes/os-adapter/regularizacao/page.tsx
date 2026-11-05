"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { carregarOrdensServico, carregarPatrimonioCliente, type OrdemServico, type PatrimonioCliente } from "@/lib/ordensServicoStore";
import s from "./page.module.css";

type Candidato = { os: OrdemServico; codigoProduto: string; produto: string; serial: string; destino: string };
const chave = "wms-expert-patrimonio-cliente";
const evento = "wms-ordens-servico-update";
const chaveOS = "wms-expert-ordens-servico";
function candidatos(ordens: OrdemServico[]): Candidato[] {
  return ordens.filter(o=>o.tipo==="INSTALACAO" && o.status==="FINALIZADA" && o.estadoFSM==="FINALIZADA" && !!o.finalizadoEm)
    .flatMap(os=>os.itens.flatMap(item=>item.seriais.map(serial=>({
      os,codigoProduto:item.codigoProduto,produto:item.produto,serial,destino:item.destino
    }))));
}
export default function Regularizacao() {
 const [ordens,setOrdens]=useState<OrdemServico[]>([]);
 const [patrimonios,setPatrimonios]=useState<PatrimonioCliente[]>([]);
 const [selecionado,setSelecionado]=useState("");
 const [tipo,setTipo]=useState<"COMODATO"|"VENDA">("COMODATO");
 const [confirmacao,setConfirmacao]=useState("");
 const [justificativa,setJustificativa]=useState("");
 const [mensagem,setMensagem]=useState("");
 const [erro,setErro]=useState("");
 const [filtro,setFiltro]=useState("");
 const atualizar=()=>{setOrdens(carregarOrdensServico());setPatrimonios(carregarPatrimonioCliente());};
 useEffect(()=>{atualizar();window.addEventListener(evento,atualizar);return()=>window.removeEventListener(evento,atualizar);},[]);
 const lista=useMemo(()=>candidatos(ordens).filter(x=>[x.os.codigo,x.os.cliente,x.os.codigoCliente,x.codigoProduto,x.serial].join(" ").toLowerCase().includes(filtro.toLowerCase())),[ordens,filtro]);
 const candidato=lista.find(x=>`${x.os.codigo}|${x.codigoProduto}|${x.serial}`===selecionado);
 const ocupado=(serial:string)=>patrimonios.some(p=>p.serial.trim().toUpperCase()===serial.trim().toUpperCase());
 function exportarBackup(){
  const dados={exportadoEm:new Date().toISOString(),origem:"OS_ADAPTER_V0817",ordens:localStorage.getItem(chaveOS),patrimonio:localStorage.getItem(chave)};
  const url=URL.createObjectURL(new Blob([JSON.stringify(dados,null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download=`BACKUP_PATRIMONIO_${Date.now()}.json`;a.click();URL.revokeObjectURL(url);
 }
 function confirmar(){
  setErro("");setMensagem("");
  if(!candidato){setErro("Selecione uma série de uma instalação finalizada.");return;}
  const {os,serial,codigoProduto,produto,destino}=candidato;
  if(!os.codigoCliente.trim() || !os.finalizadoEm || destino!=="CONSUMO"){setErro("OS sem identificação, finalização ou destino histórico esperado.");return;}
  if(confirmacao.trim()!==serial){setErro("Digite o número de série exatamente como exibido.");return;}
  if(justificativa.trim().length<15){setErro("Descreva a evidência da permanência do equipamento no cliente (mínimo 15 caracteres).");return;}
  if(!window.confirm(`Confirma que ${serial} está atualmente no cliente ${os.cliente} como ${tipo}? Esta operação não altera o estoque nem a OS histórica.`))return;
  const atuais=carregarPatrimonioCliente();
  if(atuais.some(p=>p.serial.trim().toUpperCase()===serial.trim().toUpperCase())){setErro("Esta série já possui registro patrimonial. Operação cancelada.");atualizar();return;}
  const registro:PatrimonioCliente={id:`REG-V0817-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,codigoCliente:os.codigoCliente,cliente:os.cliente,ordemServico:os.codigo,codigoProduto,produto,serial,quantidade:1,tipo,tecnico:os.tecnico,codigoTecnico:os.codigoTecnico,instaladoEm:os.finalizadoEm,status:tipo==="COMODATO"?"INSTALADO":"VENDIDO"};
  // Histórico de conciliação separado: a OS original e seu destino CONSUMO são preservados.
  const auditKey="wms-expert-patrimonio-regularizacoes";
  const auditoria=JSON.parse(localStorage.getItem(auditKey)||"[]") as unknown[];
  try {
   localStorage.setItem(chave,JSON.stringify([...atuais,registro]));
   localStorage.setItem(auditKey,JSON.stringify([...auditoria,{registroId:registro.id,os:os.codigo,serial,justificativa:justificativa.trim(),tipo,regularizadoEm:new Date().toISOString(),origem:"OS_ADAPTER_V0817"}]));
   window.dispatchEvent(new CustomEvent(evento));atualizar();setSelecionado("");setConfirmacao("");setJustificativa("");
   setMensagem(`Série ${serial} conciliada. A OS histórica foi preservada.`);
  }catch(e){setErro(`Não foi possível concluir o registro: ${String(e)}. Verifique o armazenamento antes de tentar novamente.`);}
 }
 return <main className={s.root}>
  <header className={s.header}><div><small>EXPEDIÇÕES / OS ADAPTER</small><h1>Conciliação patrimonial assistida</h1><p>Recupere o vínculo de equipamentos instalados com evidência. Sem modificar o estoque ou reescrever OS antigas.</p></div><Link href="/expedicoes/os-adapter">Voltar ao gerador</Link></header>
  <section className={s.stats}><div><small>Instalações finalizadas com séries</small><strong>{candidatos(ordens).length}</strong></div><div><small>Patrimônios cadastrados</small><strong>{patrimonios.length}</strong></div><div><small>Sem registro patrimonial</small><strong>{candidatos(ordens).filter(x=>!ocupado(x.serial)).length}</strong></div></section>
  <section className={s.panel}><h2>1. Localizar série de instalação finalizada</h2><p>Somente instalações finalizadas com número de série aparecem como candidatas. Trocas, retiradas e OS em andamento exigem análise separada.</p>
   <label>Buscar OS, cliente, produto ou série<input value={filtro} onChange={e=>setFiltro(e.target.value)} placeholder="Ex.: TEL0004, OS-2600024, Caucaia"/></label>
   <div className={s.results}>{lista.length===0?<p>Nenhuma série elegível encontrada.</p>:lista.map(x=>{const key=`${x.os.codigo}|${x.codigoProduto}|${x.serial}`;const usada=ocupado(x.serial);return <button type="button" disabled={usada||x.destino!=="CONSUMO"} className={selecionado===key?s.active:""} key={key} onClick={()=>{setSelecionado(key);setConfirmacao("");setErro("");}}>
    <b>{x.serial}</b><span>{x.codigoProduto} · {x.produto}</span><span>{x.os.cliente} ({x.os.codigoCliente}) · {x.os.codigo}</span><em>{usada?"JÁ REGISTRADO":x.destino!=="CONSUMO"?"DESTINO DIFERENTE":"AGUARDA CONCILIAÇÃO"}</em></button>})}</div>
  </section>
  <section className={s.panel}><h2>2. Confirmar vínculo com o cliente</h2>
   {candidato?<><p><b>{candidato.os.cliente}</b> — {candidato.os.codigoCliente} · {candidato.os.codigo}</p><p>Produto: {candidato.codigoProduto} · Série: <b>{candidato.serial}</b></p>
    <label>Destino patrimonial confirmado<select value={tipo} onChange={e=>setTipo(e.target.value as "COMODATO"|"VENDA")}><option value="COMODATO">Comodato — permanece instalado no cliente</option><option value="VENDA">Venda — patrimônio vendido ao cliente</option></select></label>
    <label>Evidência / justificativa da regularização<textarea value={justificativa} onChange={e=>setJustificativa(e.target.value)} placeholder="Ex.: confirmado por termo de instalação e conferência com cliente" rows={3}/></label>
    <label>Digite a série para confirmar<input value={confirmacao} onChange={e=>setConfirmacao(e.target.value)} placeholder={candidato.serial}/></label>
   </>:<p>Selecione uma série acima. Não serão criados patrimônios automaticamente.</p>}
   {erro&&<div className={s.error}>{erro}</div>}{mensagem&&<div className={s.success}>{mensagem}</div>}
   <div className={s.actions}><button type="button" onClick={exportarBackup}>Exportar backup JSON antes de conciliar</button><button type="button" className={s.primary} disabled={!candidato} onClick={confirmar}>Confirmar regularização</button></div>
   <p className={s.warning}>Atenção: registros históricos com destino CONSUMO não são alterados. Confirme documentalmente o equipamento antes de criar o vínculo. Séries de trocas não são regularizadas por esta tela.</p>
  </section>
 </main>;
}
