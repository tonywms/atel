"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { carregarOrdensServico, ouvirOrdensServico, carregarPatrimonioCliente, type PatrimonioCliente, type OrdemServico, type MaterialPrevistoOS, type TipoOrdemServico } from "@/lib/ordensServicoStore";
import { stock0 } from "@/lib/data";
import { carregarEstoqueTecnico, ouvirEstoqueTecnico } from "@/lib/estoqueTecnicoStore";
import styles from "./page.module.css";

type Linha = { codigoProduto: string; produto: string; unidade: string; quantidade: string; serialObrigatorio: boolean; seriais: string };
const vazia = (): Linha => ({ codigoProduto: "", produto: "", unidade: "UN", quantidade: "1", serialObrigatorio: false, seriais: "" });
const tipos: TipoOrdemServico[] = ["INSTALACAO", "MANUTENCAO", "TROCA", "RETIRADA"];
const chave = "wms-expert-ordens-servico";
const evento = "wms-ordens-servico-update";
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const normalizar = (v: string) => v.trim();
const serializar = (v: string) => [...new Set(v.split(/[\n,;]+/).map(normalizar).filter(Boolean))];

export default function GeradorOSAdapter() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [patrimonios, setPatrimonios] = useState<PatrimonioCliente[]>([]);
  const [patrimonioSelecionado, setPatrimonioSelecionado] = useState<string[]>([]);
  const [pesquisaPatrimonio, setPesquisaPatrimonio] = useState("");
  const [filtroPatrimonio, setFiltroPatrimonio] = useState<"TODOS"|"ELEGIVEIS">("ELEGIVEIS");
  const [modoDemo, setModoDemo] = useState(false);
  const [tipo, setTipo] = useState<TipoOrdemServico>("INSTALACAO");
  const [codigoTecnico, setCodigoTecnico] = useState("");
  const [tecnico, setTecnico] = useState("");
  const [base, setBase] = useState("");
  const [codigoCliente, setCodigoCliente] = useState("");
  const [cliente, setCliente] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [dataPrevista, setDataPrevista] = useState(hoje);
  const [observacao, setObservacao] = useState("");
  const [materiais, setMateriais] = useState<Linha[]>([vazia()]);
  const [busca, setBusca] = useState("");
  const [catalogoBusca, setCatalogoBusca] = useState<Record<number,string>>({});
  const [estoqueTecnicos, setEstoqueTecnicos] = useState<ReturnType<typeof carregarEstoqueTecnico>>([]);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  useEffect(() => { const atualizar = () => {setOrdens(carregarOrdensServico());setPatrimonios(carregarPatrimonioCliente());}; atualizar(); return ouvirOrdensServico(atualizar); }, []);
  useEffect(() => { const atualizar = () => setEstoqueTecnicos(carregarEstoqueTecnico()); atualizar(); return ouvirEstoqueTecnico(atualizar); }, []);
  const patrimonioCliente = useMemo(() => patrimonios.filter(p=>p.codigoCliente.trim().toUpperCase()===codigoCliente.trim().toUpperCase() && p.status === "INSTALADO"),[patrimonios,codigoCliente]);
  const selecionaveis = useMemo(()=>patrimonioCliente.filter(p=>tipo!=="RETIRADA" || p.tipo==="COMODATO"),[patrimonioCliente,tipo]);
  const patrimonioglobal = useMemo(() => {
    const termo = pesquisaPatrimonio.trim().toLocaleLowerCase("pt-BR");
    return patrimonios.filter(p => {
      const elegivel = p.status === "INSTALADO" && (tipo !== "RETIRADA" || p.tipo === "COMODATO");
      if (filtroPatrimonio === "ELEGIVEIS" && !elegivel) return false;
      return !termo || [p.codigoCliente,p.cliente,p.serial,p.codigoProduto,p.produto,p.ordemServico].some(v=>String(v??"").toLocaleLowerCase("pt-BR").includes(termo));
    }).sort((a,b)=>a.cliente.localeCompare(b.cliente)).slice(0,120);
  },[patrimonios,pesquisaPatrimonio,tipo,filtroPatrimonio]);
  const selecionarPatrimonioGlobal = (p:PatrimonioCliente) => {
    if(p.status !== "INSTALADO" || (tipo === "RETIRADA" && p.tipo !== "COMODATO")) {
      setErro("Este patrimônio não está elegível para este tipo de atendimento."); return;
    }
    const clienteMudou = codigoCliente !== p.codigoCliente;
    const clienteOS = ordens.find(o=>o.codigoCliente===p.codigoCliente);
    setCodigoCliente(p.codigoCliente);setCliente(p.cliente);
    if(clienteOS){setEndereco(clienteOS.endereco);setCidade(clienteOS.cidade);}
    setPatrimonioSelecionado(ant=>clienteMudou?[p.id]:ant.includes(p.id)?ant:[...ant,p.id]);
    setErro("");
  };

  useEffect(()=>{setPatrimonioSelecionado([]);},[tipo]);
  const catalogo = useMemo(() => {
    const mapa = new Map<string,{codigo:string;nome:string;unidade:string;origens:Set<string>}>();
    const incluir = (codigo:string,nome:string,unidade:string,origem:string) => {
      const c = (codigo ?? "").trim().toUpperCase(); if(!c) return;
      const atual = mapa.get(c);
      if(atual){ if(!atual.nome && nome) atual.nome=nome; if(!atual.unidade && unidade) atual.unidade=unidade; atual.origens.add(origem); }
      else mapa.set(c,{codigo:c,nome:nome?.trim() ?? "",unidade:unidade?.trim() || "UN",origens:new Set([origem])});
    };
    stock0.forEach(p=>incluir(p.sku,p.name,p.unit,"Catálogo base"));
    ordens.forEach(o=>o.materiaisPrevistos.forEach(p=>incluir(p.codigoProduto,p.produto,p.unidade,"Ordens de serviço")));
    estoqueTecnicos.forEach(p=>incluir(p.codigoProduto,p.produto,p.unidade,"Estoque técnico"));
    return [...mapa.values()].sort((a,b)=>a.codigo.localeCompare(b.codigo));
  },[ordens,estoqueTecnicos]);
  const selecionarProduto = (i:number,codigo:string) => { const p=catalogo.find(x=>x.codigo===codigo);if(!p)return;setMateriais(ant=>ant.map((m,j)=>j===i?{...m,codigoProduto:p.codigo,produto:p.nome,unidade:p.unidade}:m));setCatalogoBusca(ant=>({...ant,[i]:""})); };
  const tecnicos = useMemo(() => [...new Map(ordens.filter(o => o.codigoTecnico).map(o => [o.codigoTecnico, {codigo:o.codigoTecnico,nome:o.tecnico,base:o.base}])).values()].sort((a,b)=>a.nome.localeCompare(b.nome)), [ordens]);
  const clientes = useMemo(() => [...new Map(ordens.filter(o => o.codigoCliente).map(o => [o.codigoCliente, {codigo:o.codigoCliente,nome:o.cliente,endereco:o.endereco,cidade:o.cidade}])).values()].sort((a,b)=>a.nome.localeCompare(b.nome)), [ordens]);
  const geradas = useMemo(() => ordens.filter(o => (o.observacao ?? "").includes("[OS ADAPTER]") && `${o.codigo} ${o.cliente} ${o.tecnico}`.toLowerCase().includes(busca.toLowerCase())).sort((a,b)=>b.id-a.id), [ordens,busca]);
  const alterarMaterial = (i:number, campo:keyof Linha, valor:string|boolean) => setMateriais(ant => ant.map((m,j)=>j===i?{...m,[campo]:valor}:m));
  const selecionarTecnico = (codigo:string) => {setCodigoTecnico(codigo); const t=tecnicos.find(t=>t.codigo===codigo);if(t){setTecnico(t.nome);setBase(t.base);}};
  const selecionarCliente = (codigo:string) => {setPatrimonioSelecionado([]);setCodigoCliente(codigo);const c=clientes.find(c=>c.codigo===codigo);if(c){setCliente(c.nome);setEndereco(c.endereco);setCidade(c.cidade);}};
  function gerar() {
    setErro(""); setMensagem("");
    try {
      if (![codigoTecnico,tecnico,base,codigoCliente,cliente,endereco,cidade,dataPrevista].every(v=>v.trim())) throw new Error("Preencha todos os campos obrigatórios do técnico, cliente, endereço e agendamento.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPrevista) || Number.isNaN(new Date(`${dataPrevista}T12:00:00`).getTime())) throw new Error("Data prevista inválida.");
      const linhas = materiais.filter(m=>m.codigoProduto.trim() || m.produto.trim() || m.seriais.trim()).map(m=>({...m}));
      if (tipo === "INSTALACAO" && linhas.some(m=>!m.codigoProduto.trim() || !m.produto.trim() || !m.unidade.trim() || !Number.isInteger(Number(m.quantidade)) || Number(m.quantidade)<=0)) throw new Error("Confira código, descrição, unidade e quantidade inteira positiva dos materiais.");
      if(tipo === "INSTALACAO") for(const m of linhas){const ss=serializar(m.seriais);if(ss.length && ss.length!==Number(m.quantidade)) throw new Error(`Produto ${m.codigoProduto}: informe um serial diferente por unidade ou deixe os seriais previstos vazios.`);if(ss.length!==m.seriais.split(/[\n,;]+/).map(normalizar).filter(Boolean).length) throw new Error(`Há seriais repetidos em ${m.codigoProduto}.`);}
      if (tipo !== "INSTALACAO") {
        if (!patrimonioSelecionado.length) throw new Error("Selecione pelo menos um equipamento instalado neste cliente, identificado pelo número de série.");
        const selecionados = patrimonioSelecionado.map(id=>selecionaveis.find(p=>p.id===id));
        if (selecionados.some(p=>!p || !p.serial?.trim())) throw new Error("O patrimônio selecionado precisa possuir número de série válido.");
        const ids = new Set(patrimonioSelecionado);
        if(ids.size!==patrimonioSelecionado.length) throw new Error("Patrimônio selecionado em duplicidade.");
        // Materiais previstos espelham exatamente o patrimônio escolhido.
        linhas.splice(0,linhas.length,...selecionados.map(p=>({codigoProduto:p!.codigoProduto,produto:p!.produto,unidade:"UN",quantidade:String(p!.quantidade || 1),serialObrigatorio:true,seriais:p!.serial})));
      }
      if (tipo === "INSTALACAO" && modoDemo) {
        linhas.forEach((m,i)=>{if(!m.seriais.trim()) {const q=Number(m.quantidade);if(q>100)throw new Error("Limite de 100 séries de demonstração por item.");m.seriais=Array.from({length:q},(_,n)=>`DEMO-${Date.now()}-${i+1}-${n+1}`).join(", ");m.serialObrigatorio=true;}});
      }
      // Ler novamente imediatamente antes de gravar evita sobrescrever mudanças feitas por outras telas na mesma aba.
      const atuais = carregarOrdensServico();
      const maior = atuais.reduce((n,o)=>Math.max(n,Number(o.id)||0),2600000);
      const id = maior+1;
      const previstos:MaterialPrevistoOS[] = linhas.map((m,i)=>({id:id*100+i+1,codigoProduto:normalizar(m.codigoProduto).toUpperCase(),produto:normalizar(m.produto),unidade:normalizar(m.unidade).toUpperCase(),quantidade:Number(m.quantidade),serialObrigatorio:m.serialObrigatorio,seriaisPrevistos:serializar(m.seriais),statusConferencia:"PENDENTE"}));
      const nova:OrdemServico = {id,codigo:`OS-${id}`,tipo,status:"PENDENTE",codigoTecnico:normalizar(codigoTecnico),tecnico:normalizar(tecnico),base:normalizar(base),codigoCliente:normalizar(codigoCliente),cliente:normalizar(cliente),endereco:normalizar(endereco),cidade:normalizar(cidade),dataPrevista,observacao:`[OS ADAPTER]${tipo!=="INSTALACAO"?` [PATRIMONIOS: ${patrimonioSelecionado.join(", ")}]`:""}${tipo==="INSTALACAO" && modoDemo?" [SERIAIS DEMO - NAO FISICOS]":""}${observacao.trim()?` ${observacao.trim()}`:""}`,materiaisPrevistos:previstos,itens:[],estadoFSM:"PENDENTE",historicoFSM:[]};
      const bruto=localStorage.getItem(chave);
      if(bruto){const persistidas=JSON.parse(bruto);if(!Array.isArray(persistidas))throw new Error("O armazenamento de OS está inconsistente; criação interrompida.");if(persistidas.some((o:OrdemServico)=>o.id===id || o.codigo===nova.codigo))throw new Error("Conflito de numeração. Atualize a página e tente novamente.");}
      localStorage.setItem(chave,JSON.stringify([...atuais,nova]));
      window.dispatchEvent(new CustomEvent(evento));
      setOrdens(carregarOrdensServico());setMensagem(`${nova.codigo} criada com sucesso. Disponível na Gestão OS e no coletor do técnico.`);
      setMateriais([vazia()]);setObservacao("");setPatrimonioSelecionado([]);
    } catch(e){setErro(e instanceof Error?e.message:"Não foi possível criar a ordem de serviço.");}
  }
  return <div className={styles.root}>
    <header className={styles.header}><div><span className={styles.eyebrow}>EXPEDIÇÕES / OS ADAPTER</span><h1>Gerador OS Adapter</h1><p>Geração manual de ordens de serviço integradas ao fluxo operacional existente.</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Link className={styles.secondary} href="/expedicoes/os-adapter/regularizacao">Conciliar patrimônio</Link><Link className={styles.secondary} href="/admin/ordens-servico">Abrir Gestão OS</Link></div></header>
    <div className={styles.metrics}><div><small>OS existentes</small><strong>{ordens.length}</strong></div><div><small>Geradas pelo Adapter</small><strong>{ordens.filter(o=>(o.observacao??"").includes("[OS ADAPTER]")).length}</strong></div><div><small>OS pendentes</small><strong>{ordens.filter(o=>o.status==="PENDENTE").length}</strong></div></div>
    <section className={styles.panel}><div className={styles.panelTitle}><strong>Nova ordem de serviço</strong><span>Campos marcados com * são obrigatórios</span></div>
      <div className={styles.grid}><label>Tipo da OS *<select value={tipo} onChange={e=>setTipo(e.target.value as TipoOrdemServico)}>{tipos.map(t=><option key={t} value={t}>{t}</option>)}</select></label><label>Status inicial<input value="PENDENTE" disabled /></label><label>Data prevista *<input type="date" value={dataPrevista} onChange={e=>setDataPrevista(e.target.value)}/></label></div>
      <h2>Técnico responsável</h2><div className={styles.grid}><label>Selecionar técnico existente<select value={tecnicos.some(t=>t.codigo===codigoTecnico)?codigoTecnico:""} onChange={e=>selecionarTecnico(e.target.value)}><option value="">Informar manualmente</option>{tecnicos.map(t=><option key={t.codigo} value={t.codigo}>{t.codigo} — {t.nome}</option>)}</select></label><label>Código técnico *<input value={codigoTecnico} onChange={e=>setCodigoTecnico(e.target.value)} placeholder="TEC-060"/></label><label>Nome do técnico *<input value={tecnico} onChange={e=>setTecnico(e.target.value)}/></label><label>Base *<input value={base} onChange={e=>setBase(e.target.value)}/></label></div>
      <h2>Cliente e local do atendimento</h2><div className={styles.grid}><label>Selecionar cliente existente<select value={clientes.some(c=>c.codigo===codigoCliente)?codigoCliente:""} onChange={e=>selecionarCliente(e.target.value)}><option value="">Informar manualmente</option>{clientes.map(c=><option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nome}</option>)}</select></label><label>Código do cliente *<input value={codigoCliente} onChange={e=>{setPatrimonioSelecionado([]);setCodigoCliente(e.target.value);}}/></label><label>Nome do cliente *<input value={cliente} onChange={e=>setCliente(e.target.value)}/></label><label>Endereço *<input value={endereco} onChange={e=>setEndereco(e.target.value)}/></label><label>Cidade / UF *<input value={cidade} onChange={e=>setCidade(e.target.value)}/></label></div>
      {tipo !== "INSTALACAO" && <section className={styles.discovery}>
        <div className={styles.discoveryHeader}><div><span className={styles.discoveryEyebrow}>LOCALIZADOR PATRIMONIAL</span><h2>Encontrar equipamento antes de preencher a OS</h2><p>Pesquise em todos os clientes por série, produto, cliente ou OS de origem. Ao selecionar, os dados do cliente serão vinculados automaticamente.</p></div><span className={styles.discoveryCount}>{patrimonios.length} registros no patrimônio</span></div>
        <div className={styles.discoveryControls}><label>Pesquisar em todos os clientes<input aria-label="Pesquisar patrimônio por série cliente produto ou OS" value={pesquisaPatrimonio} onChange={e=>setPesquisaPatrimonio(e.target.value)} placeholder="Ex.: TEL0004, serial, nome do cliente, OS-2600001..."/></label><label>Exibir<select value={filtroPatrimonio} onChange={e=>setFiltroPatrimonio(e.target.value as "TODOS"|"ELEGIVEIS")}><option value="ELEGIVEIS">Somente elegíveis</option><option value="TODOS">Todos os registros</option></select></label></div>
        {patrimonioglobal.length ? <div className={styles.discoveryList}>{patrimonioglobal.map(p=>{const elegivel=p.status==="INSTALADO"&&(tipo!=="RETIRADA"||p.tipo==="COMODATO");const marcado=patrimonioSelecionado.includes(p.id);return <div key={p.id} className={styles.discoveryRow}><div className={styles.discoveryDetails}><strong>{p.serial || "Sem número de série"}</strong><span>{p.codigoProduto} · {p.produto}</span><small>{p.cliente} ({p.codigoCliente}) · {p.tipo} · {p.status} · Origem: {p.ordemServico}</small></div><button type="button" className={marcado?styles.discoverySelected:styles.discoveryPick} disabled={!elegivel} onClick={()=>selecionarPatrimonioGlobal(p)}>{marcado?"Selecionado":elegivel?"Selecionar":"Indisponível"}</button></div>})}</div>:<div className={styles.traceEmpty}>{patrimonios.length===0?"Nenhum patrimônio registrado nesta base do navegador. Conclua uma instalação com série real e confirme o registro patrimonial para habilitar manutenção, troca e retirada.":"Nenhum equipamento encontrado com estes filtros. Experimente pesquisar outro cliente, série ou mostrar todos os registros."}</div>}
        <p className={styles.discoveryFoot}>A pesquisa usa o patrimônio registrado neste navegador. Não cria séries ou equipamentos inexistentes. Para retirada, somente comodatos instalados são elegíveis.</p>
      </section>}
      {tipo !== "INSTALACAO" && <section className={styles.traceBox}><div className={styles.traceTitle}><strong>Equipamentos vinculados ao cliente</strong><span>{selecionaveis.length} patrimônio(s) elegível(is)</span></div><p>Selecione o número de série que será atendido. Para retirada, somente comodatos instalados podem ser selecionados. O técnico fará a conferência física no coletor.</p>{selecionaveis.length ? <div className={styles.traceList}>{selecionaveis.map(p=><label className={styles.traceItem} key={p.id}><input type="checkbox" checked={patrimonioSelecionado.includes(p.id)} onChange={e=>setPatrimonioSelecionado(a=>e.target.checked?[...a,p.id]:a.filter(id=>id!==p.id))}/><span><b>{p.serial || "SEM SÉRIE"}</b><small>{p.codigoProduto} · {p.produto} · {p.tipo} · OS origem: {p.ordemServico}</small></span></label>)}</div>:<div className={styles.traceEmpty}>Não há patrimônio instalado elegível para este cliente. Conclua uma instalação com patrimônio registrado ou selecione outro cliente. Não será possível emitir esta OS sem vínculo.</div>}</section>}
      {tipo === "INSTALACAO" && <section className={styles.traceBox}><div className={styles.traceTitle}><strong>Números de série da instalação</strong><span>Identificação do equipamento</span></div><p>Informe os números de série reais nos materiais abaixo. Para testar o fluxo, habilite séries fictícias explicitamente.</p><label className={styles.traceItem}><input type="checkbox" checked={modoDemo} onChange={e=>setModoDemo(e.target.checked)}/><span><b>Gerar séries fictícias (somente demonstração)</b><small>Identificadas com prefixo DEMO; não representam estoque físico e não devem ser usadas em operação real.</small></span></label></section>}
      <h2>Materiais previstos <span className={styles.note}>Não movimentam estoque na criação da OS</span></h2>
      {tipo !== "INSTALACAO" && <p className={styles.note}>Para manutenção, troca e retirada, os materiais previstos são definidos automaticamente pelos patrimônios selecionados acima; os campos manuais abaixo não serão utilizados.</p>}
      {tipo === "INSTALACAO" && materiais.map((m,i)=><div className={styles.material} key={i}><div className={styles.materialHead}><strong>Material {i+1}</strong><button type="button" className={styles.link} onClick={()=>setMateriais(a=>a.length===1?[vazia()]:a.filter((_,j)=>j!==i))}>Remover</button></div><div className={styles.catalogoBox}><div className={styles.catalogoTop}><div><strong>Selecionar material cadastrado</strong><small>{catalogo.length} produtos disponíveis · código, descrição e unidade preenchidos automaticamente</small></div><span className={styles.catalogoTag}>CATÁLOGO</span></div><input aria-label={`Pesquisar material ${i+1}`} placeholder="Pesquisar por código ou descrição do produto..." value={catalogoBusca[i] ?? ""} onChange={e=>setCatalogoBusca(a=>({...a,[i]:e.target.value}))}/><select aria-label={`Selecionar material ${i+1}`} value="" onChange={e=>selecionarProduto(i,e.target.value)}><option value="">Selecione um produto da lista</option>{catalogo.filter(p=>`${p.codigo} ${p.nome}`.toLowerCase().includes((catalogoBusca[i]??"").toLowerCase())).map(p=><option key={p.codigo} value={p.codigo}>{p.codigo} — {p.nome || "Sem descrição"} ({p.unidade})</option>)}</select><small>Não encontrou? Preencha manualmente os campos abaixo.</small></div><div className={styles.grid}><label>Código do produto<input value={m.codigoProduto} onChange={e=>alterarMaterial(i,"codigoProduto",e.target.value)} placeholder="TEL0004"/></label><label>Descrição<input value={m.produto} onChange={e=>alterarMaterial(i,"produto",e.target.value)}/></label><label>Unidade<input value={m.unidade} onChange={e=>alterarMaterial(i,"unidade",e.target.value)}/></label><label>Quantidade<input type="number" min="1" step="1" value={m.quantidade} onChange={e=>alterarMaterial(i,"quantidade",e.target.value)}/></label></div><label className={styles.check}><input type="checkbox" checked={m.serialObrigatorio} onChange={e=>alterarMaterial(i,"serialObrigatorio",e.target.checked)}/> Exigir serial na execução</label><label>Seriais previstos (opcional, separados por vírgula ou linha)<textarea rows={2} value={m.seriais} onChange={e=>alterarMaterial(i,"seriais",e.target.value)}/></label></div>)}
      {tipo === "INSTALACAO" && <button type="button" className={styles.secondary} onClick={()=>setMateriais(a=>[...a,vazia()])}>+ Adicionar material</button>}
      <h2>Observações</h2><textarea rows={3} value={observacao} onChange={e=>setObservacao(e.target.value)} placeholder="Orientações para o atendimento"/>
      <p className={styles.note}>A OS será criada como PENDENTE. Estoque, consumo, comodato, venda e patrimônio só serão processados no atendimento e na finalização pelo fluxo existente.</p>
      {erro && <div role="alert" className={styles.error}>{erro}</div>}{mensagem && <div role="status" className={styles.success}>{mensagem}</div>}
      <div className={styles.actions}><button className={styles.primary} type="button" onClick={gerar}>Gerar ordem de serviço</button></div>
    </section>
    <section className={styles.panel}><div className={styles.panelTitle}><strong>Ordens geradas pelo Adapter</strong><input aria-label="Pesquisar ordens geradas" placeholder="Buscar OS, cliente ou técnico" value={busca} onChange={e=>setBusca(e.target.value)}/></div><div className={styles.tableWrap}><table><thead><tr><th>Ordem</th><th>Cliente</th><th>Técnico</th><th>Tipo</th><th>Status</th><th>Materiais</th></tr></thead><tbody>{geradas.map(o=><tr key={o.id}><td><strong>{o.codigo}</strong></td><td>{o.cliente}</td><td>{o.tecnico}</td><td>{o.tipo}</td><td>{o.status}</td><td>{o.materiaisPrevistos.length}</td></tr>)}{!geradas.length&&<tr><td colSpan={6} className={styles.empty}>Nenhuma OS gerada pelo Adapter.</td></tr>}</tbody></table></div></section>
  </div>;
}
