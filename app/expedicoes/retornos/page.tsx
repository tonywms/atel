"use client";

import { useEffect, useMemo, useState } from "react";
import { atelSupabase } from "@/lib/atelSupabaseV08";

import {
  alterarStatusRetorno,
  carregarRetornos,
  ouvirRetornos,
  RetornoDevolucao,
  StatusRetorno,
} from "@/lib/retornosStore";

type DevServidorV106 = {id:string;codigo:string;ret_codigo:string;status:string;itens:RetServidorItem[];criado_em:string};
function mapearDevV106(d:DevServidorV106,origem?:RetornoDevolucao):RetornoDevolucao {
 return {id:numeroRetServidor(d.id),codigo:d.codigo,tipo:"DEVOLUCAO",origem:"REQUISICAO",status:d.status==="CONFERIDO"?"FINALIZADO":"AGUARDANDO_CONFERENCIA",documentoOrigem:d.ret_codigo,tecnico:origem?.tecnico??"Centro de Distribuição",codigoTecnico:origem?.codigoTecnico??"CD",base:origem?.base??"CD Principal",origemFisica:origem?.destinoFisico??"Retorno do técnico",destinoFisico:"Endereço físico do CD",criadoEm:d.criado_em,atualizadoEm:d.criado_em,observacao:`DEV vinculada ao ${d.ret_codigo}. Conferência física exclusiva no coletor de Devolução CD.`,itens:(d.itens||[]).map((i,n)=>({id:n+1,codigoProduto:i.sku,produto:i.produto,unidade:"UN",quantidade:Number(i.recusado),quantidadeEsperada:i.esperado==null?undefined:Number(i.esperado),quantidadeRecebida:i.recebido==null?undefined:Number(i.recebido),quantidadeAceita:i.aceito==null?undefined:Number(i.aceito),motivo:i.motivo,observacao:i.observacao,seriais:i.seriais||[]}))};
}
type RetServidorItem = {chave:string;sku:string;produto:string;esperado:number;recebido:number;aceito:number;recusado:number;motivo?:string;observacao?:string;seriais?:string[]};
type RetServidor = {id:string;codigo:string;pedido_codigo:string;origem_id:string;destino_id:string;status:"AGUARDANDO_RETORNO"|"EM_TRANSITO_CD"|"AGUARDANDO_CONFERENCIA"|"FINALIZADO";itens:RetServidorItem[];criado_em:string;atualizado_em:string};
function numeroRetServidor(id:string){let h=2166136261;for(const c of id){h=Math.imul(h^c.charCodeAt(0),16777619)}return -(h>>>0)-1;}
function mapearRetServidor(r:RetServidor):RetornoDevolucao {
 return {id:numeroRetServidor(r.id),codigo:r.codigo,tipo:"RECUSA_PARCIAL",origem:"REQUISICAO",status:r.status,documentoOrigem:r.pedido_codigo,tecnico:"Mini CD",codigoTecnico:"RECEBIMENTO",base:"Mini CD",origemFisica:"Mini CD • destino do pedido",destinoFisico:"CD • origem do pedido",criadoEm:r.criado_em,atualizadoEm:r.atualizado_em,observacao:"RET sincronizado pelo Supabase",itens:r.itens.map((i,n)=>({id:n+1,codigoProduto:i.sku,produto:i.produto,unidade:"UN",quantidade:Number(i.recusado),quantidadeEsperada:i.esperado==null?undefined:Number(i.esperado),quantidadeRecebida:i.recebido==null?undefined:Number(i.recebido),quantidadeAceita:i.aceito==null?undefined:Number(i.aceito),motivo:i.motivo,observacao:i.observacao,seriais:i.seriais||[]}))};
}

/* =========================================================
   STATUS
========================================================= */

const statusNome: Record<StatusRetorno, string> = {
  AGUARDANDO_RETORNO: "Aguardando retorno",
  COM_TECNICO: "Com técnico",
  EM_TRANSITO_CD: "Em trânsito p/ CD",
  AGUARDANDO_CONFERENCIA: "Aguardando conferência",
  EM_CONFERENCIA: "Em conferência",
  RECEBIDO: "Recebido",
  FINALIZADO: "Finalizado",
};

const tipoNome: Record<string, string> = {
  RECUSA_TOTAL: "Recusa total",
  RECUSA_PARCIAL: "Recusa parcial",
  TROCA: "Troca",
  AVARIA: "Avaria",
  CANCELAMENTO: "Cancelamento",
  DEVOLUCAO: "Devolução",
};

/* =========================================================
   PAGE
========================================================= */

export default function RetornosPage() {
  const [retornos, setRetornos] = useState<RetornoDevolucao[]>([]);
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [servidor, setServidor] = useState<Record<number,RetServidor>>({});
  const [autoMiniCD, setAutoMiniCD] = useState<RetServidor[]>([]);
  const [erroServidor, setErroServidor] = useState("");
  const [operando, setOperando] = useState(false);
  async function atualizar() {
    const locais = carregarRetornos();
    const db = atelSupabase();
    let remotos:RetServidor[] = [];
    if (db) {
      const {data,error}=await db.rpc("atel_v3730_listar_rets");
      if (error) setErroServidor("RET Supabase: "+error.message);
      else {remotos=Array.isArray(data)?data as RetServidor[]:[];setErroServidor("");}
    } else setErroServidor("Supabase indisponível para consultar RETs sincronizados.");
    let automaticos:RetServidor[] = [];
    if (db) {
      const {data:autoData,error:autoError}=await db.rpc("atel_v45_listar_rets_mini_cd");
      if(autoError) setErroServidor(prev=>[prev,"Mini-CD: "+autoError.message].filter(Boolean).join(" | "));
      else automaticos=Array.isArray(autoData)?autoData as RetServidor[]:[];
    }
    // V106.2: publicar somente retornos locais elegiveis; sem movimento de estoque.
    if(db){
      for(const ret of locais.filter(r=>r.codigo.startsWith("RET-") && ["EM_TRANSITO_CD","AGUARDANDO_CONFERENCIA","EM_CONFERENCIA","RECEBIDO","FINALIZADO"].includes(r.status))){
        const {error:syncError}=await db.rpc("atel_v106_publicar_ret_local",{p_retorno:ret});
        if(syncError)setErroServidor(prev=>[prev,`Sincronização ${ret.codigo}: ${syncError.message}`].filter(Boolean).join(" | "));
      }
    }
    let devs:DevServidorV106[]=[];
    if(db){const {data:devData,error:devError}=await db.rpc("atel_v105_listar_devs");
      if(devError)setErroServidor(prev=>[prev,"DEV: "+devError.message].filter(Boolean).join(" | "));
      else devs=Array.isArray(devData)?devData as DevServidorV106[]:[];
    }
    if(db){
      const {data:devLocais,error:erroDevLocal}=await db.rpc("atel_v106_listar_devs");
      if(erroDevLocal)setErroServidor(prev=>[prev,"DEV local: "+erroDevLocal.message].filter(Boolean).join(" | "));
      else if(Array.isArray(devLocais)) devs=[...devs,...devLocais as DevServidorV106[]];
    }
    setAutoMiniCD(automaticos);
    const mapa:Record<number,RetServidor>={};
    for (const r of remotos) mapa[numeroRetServidor(r.id)]=r;
    setServidor(mapa);
    const codigos=new Set([...remotos,...automaticos].map(r=>r.pedido_codigo));
    const dados=[...automaticos.map(mapearRetServidor),...remotos.filter(r=>!automaticos.some(a=>a.id===r.id)).map(mapearRetServidor),...locais.filter(l=>!codigos.has(l.documentoOrigem))];
    // A DEV é um documento próprio. Nunca gera estoque nem modifica a RET nesta visualização.
    const devDocumentos=devs.map(d=>mapearDevV106(d,dados.find(r=>r.codigo===d.ret_codigo)));
    const documentos=[...dados,...devDocumentos].sort((a,b)=>{
      const raiz=(s:string)=>s.replace(/^(RET|DEV)-/,"");
      const ka=raiz(a.codigo),kb=raiz(b.codigo);
      if(ka===kb)return a.codigo.startsWith("RET-")?-1:1;
      return b.criadoEm.localeCompare(a.criadoEm);
    });
    setRetornos(documentos);
    setSelecionadoId((atual)=>atual!==null&&documentos.some(r=>r.id===atual)?atual:(documentos[0]?.id??null));
  }
  async function transicionarRet(r:RetServidor,novo:"EM_TRANSITO_CD"|"AGUARDANDO_CONFERENCIA") {
    const db=atelSupabase();if(!db){setErroServidor("Supabase indisponível");return;}
    setOperando(true);setErroServidor("");
    try {
      const {error}=await db.rpc("atel_v3730_transicionar_ret",{p_id:r.id,p_status:novo,p_conferencia:null});
      if(error)throw Error(error.message);
      await atualizar();
    } catch(e){setErroServidor(e instanceof Error?e.message:"Falha ao atualizar RET");}
    finally{setOperando(false);}
  }

  useEffect(() => {
    void atualizar();
    const parar=ouvirRetornos(()=>{void atualizar();});
    const intervalo=window.setInterval(()=>{if(document.visibilityState==="visible")void atualizar();},15000);
    const visibilidade=()=>{if(document.visibilityState==="visible")void atualizar();};
    document.addEventListener("visibilitychange",visibilidade);
    return ()=>{parar();window.clearInterval(intervalo);document.removeEventListener("visibilitychange",visibilidade);};
  }, []);

  /* =========================================================
     FILTRO
  ========================================================= */

  const filtrados = useMemo(() => {
    const texto = busca.trim().toLowerCase();

    if (!texto) {
      return retornos;
    }

    return retornos.filter((retorno) => {
      const conteudo = [
        retorno.codigo,
        retorno.documentoOrigem,
        retorno.tecnico,
        retorno.codigoTecnico,
        retorno.base,
        retorno.tipo,
        retorno.status,
      ]
        .join(" ")
        .toLowerCase();

      return conteudo.includes(texto);
    });
  }, [retornos, busca]);

  const selecionado =
    retornos.find((r) => r.id === selecionadoId) ??
    filtrados[0] ??
    null;

  /* =========================================================
     KPIS
  ========================================================= */

  const totalRetornos = retornos.filter(r=>!r.codigo.startsWith("DEV-")).length;

  const totalAguardando = retornos.filter((r) => !r.codigo.startsWith("DEV-") &&
    ["AGUARDANDO_RETORNO", "COM_TECNICO"].includes(r.status)
  ).length;

  const totalTransito = retornos.filter(
    (r) => !r.codigo.startsWith("DEV-") && r.status === "EM_TRANSITO_CD"
  ).length;

  const totalConferencia = retornos.filter((r) => !r.codigo.startsWith("DEV-") &&
    ["AGUARDANDO_CONFERENCIA", "EM_CONFERENCIA"].includes(r.status)
  ).length;

  const totalRecebidos = retornos.filter((r) => !r.codigo.startsWith("DEV-") &&
    ["RECEBIDO", "FINALIZADO"].includes(r.status)
  ).length;

  /* =========================================================
     CONFIRMAR ENVIO
  ========================================================= */

  function confirmarEnvioAoCD(retorno: RetornoDevolucao) {
    if (
      retorno.status !== "AGUARDANDO_RETORNO" &&
      retorno.status !== "COM_TECNICO"
    ) {
      return;
    }

    const remoto=servidor[retorno.id];
    if (remoto) {setErroServidor("Envio do RET-PED exclusivo no coletor do Mini-CD.");return;}
    alterarStatusRetorno(retorno.id, "EM_TRANSITO_CD");

    atualizar();
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="ret-page">
      {/* =====================================================
          KPIS
      ===================================================== */}

      {erroServidor && <div role="alert" style={{background:"#fff4e7",color:"#8b3d06",padding:"9px 14px",borderRadius:10,border:"1px solid #f2c48c",marginBottom:8,fontSize:12}}>{erroServidor}</div>}
      <div className="ret-kpis">
        <KpiCard
          titulo="Retornos"
          valor={totalRetornos}
          descricao="documentos RET gerados"
          cor="#4d95ae"
        />

        <KpiCard
          titulo="Aguardando"
          valor={totalAguardando}
          descricao="aguardando envio"
          cor="#7fa884"
        />

        <KpiCard
          titulo="Em trânsito"
          valor={totalTransito}
          descricao="retornando ao CD"
          cor="#e99900"
        />

        <KpiCard
          titulo="Conferência"
          valor={totalConferencia}
          descricao="aguardando conferência"
          cor="#86b1bf"
        />

        <KpiCard
          titulo="Recebidos"
          valor={totalRecebidos}
          descricao="recebidos no CD"
          cor="#39a58f"
        />
      </div>

      {/* =====================================================
          CABEÇALHO
      ===================================================== */}

      <div className="ret-header">
        <div className="ret-title">
          <span className="ret-title-icon">↩</span>
          <span>Retornos / Devoluções</span>
        </div>

        <div className="ret-header-actions">
          
          <div className="ret-search">
            <span>⌕</span>

            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar RET / REQ / técnico"
            />
          </div>

          <button
            type="button"
            className="ret-header-icon"
            title="Visualização"
          >
            ≡
          </button>

          <button
            type="button"
            className="ret-header-icon"
            title="Atualizar"
            onClick={atualizar}
          >
            ◉
          </button>

          <button
            type="button"
            className="ret-header-icon"
            title="Configurações"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* =====================================================
          CONTEÚDO
      ===================================================== */}

      

      
      <div className="ret-content">
        {/* ===================================================
            LISTA DE RETORNOS
        =================================================== */}

        <section className="ret-list-panel">
          <div className="ret-panel-title">
            <span>Retornos / Devoluções</span>
            <strong>{filtrados.length}</strong>
          </div>

          <div className="ret-list">
            {filtrados.length === 0 && (
              <div className="ret-empty-list">
                Nenhum documento encontrado.
              </div>
            )}

            {filtrados.map((retorno) => {
              const cardSelecionado = retorno.id === selecionadoId;

              return (
                <button
                  type="button"
                  key={retorno.id}
                  className={
                    cardSelecionado
                      ? "ret-card selected"
                      : "ret-card"
                  }
                  onClick={() => setSelecionadoId(retorno.id)}
                >
                  {/* =========================================
                      DOCUMENTO RET
                  ========================================= */}

                  <div className="ret-card-top">
                    <div className="ret-card-document">
                      <span className="ret-card-label">
                        {retorno.codigo.startsWith("DEV-")?"DEVOLUÇÃO CD":"RETORNO"}
                      </span>

                      <strong className="ret-card-code">
                        {retorno.codigo}
                      </strong>
                    </div>

                    <TipoBadge tipo={retorno.tipo} />
                  </div>

                  {/* =========================================
                      DOCUMENTO DE ORIGEM
                  ========================================= */}

                  <div className="ret-card-origin-box">
                    <span>DOCUMENTO ORIGEM</span>

                    <strong>{retorno.documentoOrigem}</strong>
                  </div>

                  {/* =========================================
                      TÉCNICO
                  ========================================= */}

                  <div className="ret-card-tech">
                    {retorno.tecnico}
                  </div>

                  <div className="ret-card-tech-code">
                    {retorno.codigoTecnico}
                    {" • "}
                    {retorno.base}
                  </div>

                  {/* =========================================
                      INFORMAÇÕES
                  ========================================= */}

                  <div className="ret-card-info">
                    <div>
                      <span>OPERAÇÃO</span>
                      <strong>{retorno.origem}</strong>
                    </div>

                    <div>
                      <span>SKUs</span>
                      <strong>{retorno.itens.length}</strong>
                    </div>
                  </div>

                  {/* =========================================
                      STATUS
                  ========================================= */}

                  <div className="ret-card-footer">
                    <StatusBadge status={retorno.status} />

                    <span className="ret-card-arrow">›</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ===================================================
            DETALHE
        =================================================== */}

        <section className="ret-detail-panel">
          {!selecionado && (
            <div className="ret-empty-detail">
              <div className="ret-empty-icon">↩</div>

              <strong>Selecione um retorno</strong>

              <span>
                Os detalhes do documento RET aparecerão aqui.
              </span>
            </div>
          )}

          {selecionado && (
            <>
              {/* =============================================
                  IDENTIFICAÇÃO DOS DOCUMENTOS
              ============================================= */}

              <div className="ret-detail-header">
                <div className="ret-detail-documents">
                  <div className="ret-detail-main-document">
                    <span>{selecionado.codigo.startsWith("DEV-")?"DOCUMENTO DE DEVOLUÇÃO CD":"DOCUMENTO DE RETORNO"}</span>

                    <strong>{selecionado.codigo}</strong>

                    <small>
                      {tipoNome[selecionado.tipo] ?? selecionado.tipo}
                    </small>
                  </div>

                  <div className="ret-document-link">
                    <span className="ret-document-link-arrow">←</span>

                    <div>
                      <span>{selecionado.codigo.startsWith("DEV-")?"VINCULADA AO RETORNO":"ORIGINADO DA REQUISIÇÃO"}</span>

                      <strong>{selecionado.documentoOrigem}</strong>
                    </div>
                  </div>
                </div>

                <StatusBadge status={selecionado.status} />
              </div>

              {/* =============================================
                  INFORMAÇÕES OPERACIONAIS
              ============================================= */}

              <div className="ret-info-grid">
                <Info
                  titulo="TÉCNICO RESPONSÁVEL"
                  valor={`${selecionado.tecnico} • ${selecionado.codigoTecnico}`}
                />

                <Info
                  titulo="BASE"
                  valor={selecionado.base}
                />

                <Info
                  titulo="ORIGEM FÍSICA DO RETORNO"
                  valor={selecionado.origemFisica}
                />

                <Info
                  titulo="DESTINO FÍSICO"
                  valor={selecionado.destinoFisico}
                />
              </div>

              {/* =============================================
                  EXPLICAÇÃO DO VÍNCULO
              ============================================= */}

              <div className="ret-relation">
                <div className="ret-relation-icon">↩</div>

                <div>
                  <strong>
                    {selecionado.codigo}
                  </strong>

                  <span>
                    é o documento de retorno criado a partir da{" "}
                    <b>{selecionado.documentoOrigem}</b>.
                  </span>
                </div>
              </div>

              {/* =============================================
                  MATERIAIS DO RET
              ============================================= */}

              <div className="ret-products">
                <div className="ret-products-title">
                  <div>
                    <strong>
                      Materiais do {selecionado.codigo}
                    </strong>

                    <span>
                      {selecionado.itens.length} SKU(s)
                    </span>
                  </div>
                </div>

                <div className="ret-table-wrapper">
                  <table className="ret-table">
                    <thead>
                      <tr>
                        <th>CÓDIGO</th>
                        <th>PRODUTO</th>
                        <th>UND</th>
                        <th>SOLICITADO NA REQ</th>
                        <th>RECEBIDO TÉCNICO</th>
                        <th>ACEITO TÉCNICO</th>
                        <th>RETORNANDO AO CD</th>
                        <th>MOTIVO</th>
                        <th>SERIAIS DO RETORNO</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selecionado.itens.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.codigoProduto}</strong>
                          </td>

                          <td className="ret-product-name">
                            {item.produto}
                          </td>

                          <td>{item.unidade}</td>

                          <td>
                            {item.quantidadeEsperada ?? "-"}
                          </td>

                          <td>
                            {item.quantidadeRecebida ?? "-"}
                          </td>

                          <td>
                            {item.quantidadeAceita ?? "-"}
                          </td>

                          <td>
                            <strong className="ret-return-qty">
                              {item.quantidade}
                            </strong>
                          </td>

                          <td>
                            {item.motivo
                              ? String(item.motivo).replaceAll("_", " ")
                              : "-"}
                          </td>

                          <td>
                            {item.seriais?.length
                              ? item.seriais.join(", ")
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* =============================================
                  TIMELINE
              ============================================= */}

              <div className="ret-timeline-area">
                <div className="ret-timeline-title">
                  Acompanhamento do {selecionado.codigo}
                </div>

                <div className="ret-timeline">
                  <TimelineStep
                    numero="✓"
                    titulo="RET Gerado"
                    subtitulo={`Origem ${selecionado.documentoOrigem}`}
                    estado="concluido"
                  />

                  <TimelineLine
                    ativo={nivelStatus(selecionado.status) >= 2}
                  />

                  <TimelineStep
                    numero="2"
                    titulo="Aguardando Envio"
                    subtitulo={`Com ${selecionado.tecnico}`}
                    estado={
                      nivelStatus(selecionado.status) === 2
                        ? "atual"
                        : "concluido"
                    }
                  />

                  <TimelineLine
                    ativo={nivelStatus(selecionado.status) >= 3}
                  />

                  <TimelineStep
                    numero="3"
                    titulo="Em Trânsito"
                    subtitulo="Técnico → CD"
                    estado={
                      nivelStatus(selecionado.status) === 3
                        ? "atual"
                        : nivelStatus(selecionado.status) > 3
                        ? "concluido"
                        : "pendente"
                    }
                  />

                  <TimelineLine
                    ativo={nivelStatus(selecionado.status) >= 4}
                  />

                  <TimelineStep
                    numero="4"
                    titulo="Recebimento CD"
                    subtitulo="Conferir material"
                    estado={
                      nivelStatus(selecionado.status) === 4
                        ? "atual"
                        : nivelStatus(selecionado.status) > 4
                        ? "concluido"
                        : "pendente"
                    }
                  />

                  <TimelineLine
                    ativo={nivelStatus(selecionado.status) >= 5}
                  />

                  <TimelineStep
                    numero="5"
                    titulo="Finalizado"
                    subtitulo="Destino do estoque definido"
                    estado={
                      nivelStatus(selecionado.status) >= 5
                        ? "concluido"
                        : "pendente"
                    }
                  />
                </div>
              </div>

              {/* =============================================
                  AÇÕES
              ============================================= */}

              <div className="ret-actions">
                <div className="ret-status-info">
                  <span>ETAPA ATUAL DO RETORNO</span>

                  <strong>
                    {textoEtapaAtual(selecionado.status)}
                  </strong>

                  <small>
                    {descricaoEtapaAtual(selecionado)}
                  </small>
                </div>

                {!selecionado.codigo.startsWith("DEV-") && (selecionado.status === "AGUARDANDO_RETORNO" ||
                  selecionado.status === "COM_TECNICO") && (
                  selecionado.codigo.startsWith("RET-PED-") ? (
                    <div className="ret-action-message blue">ENVIO EXCLUSIVO PELO COLETOR DO MINI-CD. ACOMPANHE AQUI APÓS A CONFIRMAÇÃO.</div>
                  ) : (
                    <button type="button" className="ret-action-button" onClick={() => confirmarEnvioAoCD(selecionado)}>
                      CONFIRMAR ENVIO DO {selecionado.codigo} AO CD
                    </button>
                  )
                )}

                {!selecionado.codigo.startsWith("DEV-") && selecionado.status === "EM_TRANSITO_CD" && (
                  servidor[selecionado.id] ? <button className="ret-action-button" type="button" disabled={operando} onClick={()=>void transicionarRet(servidor[selecionado.id],"AGUARDANDO_CONFERENCIA")}>CONFIRMAR CHEGADA FÍSICA AO CD</button> :
                  <div className="ret-action-message blue">AGUARDANDO RECEBIMENTO FÍSICO NO CD</div>
                )}

                {!selecionado.codigo.startsWith("DEV-") && (selecionado.status === "AGUARDANDO_CONFERENCIA" ||
                  selecionado.status === "EM_CONFERENCIA") && (
                  servidor[selecionado.id] ? <button className="ret-action-button" type="button" disabled={operando} onClick={() => window.location.assign("/coletor/devolucao-cd?ret=" + encodeURIComponent(servidor[selecionado.id].codigo))}>CONFERIR DEV NO COLETOR</button> :
                  <div className="ret-action-message yellow">RECEBIMENTO / CONFERÊNCIA PELO COLETOR</div>
                )}

                {!selecionado.codigo.startsWith("DEV-") && (selecionado.status === "RECEBIDO" ||
                  selecionado.status === "FINALIZADO") && (
                  <div className="ret-action-message green">
                    ✓ {selecionado.codigo} FINALIZADO
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {/* =====================================================
          CSS
      ===================================================== */}

      <style jsx>{`
        .ret-page {
          padding: 18px;
          min-height: 100%;
          box-sizing: border-box;
        }

        /* ===================================================
           KPI
        =================================================== */

        .ret-kpis {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 16px;
        }

        /* ===================================================
           HEADER
        =================================================== */

        .ret-header {
          height: 54px;
          padding: 0 12px;

          border: 1.5px solid #009ee2;
          border-radius: 28px;

          background: #ffffff !important;

          display: flex;
          align-items: center;
          justify-content: space-between;

          margin-bottom: 8px;
        }

        .ret-title {
          display: flex;
          align-items: center;
          gap: 8px;

          color: #007cae !important;
          font-size: 21px;
          font-weight: 800;
        }

        .ret-title-icon {
          width: 24px;
          height: 24px;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          color: #007cae !important;
          font-size: 21px;
          font-weight: 900;
        }

        .ret-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ret-search {
          width: 300px;
          height: 38px;

          padding: 0 13px;

          background: #f2f4f6;
          border-radius: 22px;

          display: flex;
          align-items: center;
          gap: 8px;

          color: #7c8a95;
        }

        .ret-search input {
          width: 100%;

          border: none;
          outline: none;

          background: transparent;

          color: #65727e;
          font-size: 15px;
        }

        .ret-header-icon {
          width: 30px;
          height: 30px;

          border: none;
          background: transparent;

          color: #006f9e;
          font-size: 18px;

          cursor: pointer;
        }

        /* ===================================================
           CONTENT
        =================================================== */

        .ret-content {
          display: grid;
          grid-template-columns: clamp(265px, 24vw, 315px) minmax(0, 1fr);
          gap: 14px;

          min-height: 595px;
        }

        .ret-list-panel,
        .ret-detail-panel {
          background: #ffffff;

          border: 1.5px solid #00a0e3;
          border-radius: 15px;

          overflow: hidden;
        }

        /* ===================================================
           LISTA
        =================================================== */

        .ret-panel-title {
          height: 48px;
          padding: 0 16px;

          background: #1593b7;
          color: #ffffff;

          display: flex;
          align-items: center;
          justify-content: space-between;

          font-size: 16px;
          font-weight: 800;
        }

        .ret-list {
          padding: 10px;
          max-height: 680px;
          overflow-y: auto;
        }

        .ret-empty-list {
          padding: 36px 10px;

          text-align: center;

          color: #667085;
          font-size: 13px;
        }

        /* ===================================================
           CARD
        =================================================== */

        .ret-card {
          width: 100%;

          margin-bottom: 9px;
          padding: 12px;

          border: 1px solid #cbd7dd;
          border-radius: 11px;

          background: #ffffff;

          text-align: left;
          cursor: pointer;

          transition: 0.15s;
        }

        .ret-card:hover {
          border-color: #00a0e3;
          background: #f8fdff;
        }

        .ret-card.selected {
          border: 2px solid #009ee2;
          background: #effaff;
        }

        .ret-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }

        .ret-card-document {
          display: flex;
          flex-direction: column;
        }

        .ret-card-label {
          margin-bottom: 2px;

          color: #82909c;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.35px;
        }

        .ret-card-code {
          color: #007ba9;
          font-size: 16px;
          font-weight: 900;
        }

        /*
         * Agora a REQ não fica solta abaixo do RET.
         * Ela possui uma caixa própria e um rótulo explícito.
         */
        .ret-card-origin-box {
          margin-top: 9px;
          padding: 7px 9px;

          background: #ffffff;

          border: 1px solid #d9e3e8;
          border-left: 3px solid #7a9eae;
          border-radius: 6px;

          display: flex;
          flex-direction: column;
        }

        .ret-card-origin-box span {
          color: #82909c;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.3px;
        }

        .ret-card-origin-box strong {
          margin-top: 2px;

          color: #344054;
          font-size: 11px;
          font-weight: 900;
        }

        .ret-card-tech {
          margin-top: 9px;

          color: #1d2939;
          font-size: 13px;
          font-weight: 800;
        }

        .ret-card-tech-code {
          margin-top: 2px;

          color: #667085;
          font-size: 10px;
        }

        .ret-card-info {
          display: grid;
          grid-template-columns: 1fr 70px;
          gap: 8px;

          margin-top: 10px;
          padding: 8px;

          background: #f5f8fa;
          border-radius: 6px;
        }

        .ret-card-info div {
          display: flex;
          flex-direction: column;
        }

        .ret-card-info span {
          color: #84919b;
          font-size: 8px;
          font-weight: 800;
        }

        .ret-card-info strong {
          margin-top: 2px;

          color: #344054;
          font-size: 10px;
        }

        .ret-card-footer {
          margin-top: 10px;

          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ret-card-arrow {
          color: #008ec3;
          font-size: 22px;
          font-weight: 700;
        }

        /* ===================================================
           EMPTY DETAIL
        =================================================== */

        .ret-empty-detail {
          height: 100%;

          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;

          color: #667085;
        }

        .ret-empty-icon {
          margin-bottom: 8px;

          color: #1593b7;
          font-size: 35px;
        }

        .ret-empty-detail strong {
          color: #344054;
          font-size: 16px;
        }

        .ret-empty-detail span {
          margin-top: 4px;
          font-size: 11px;
        }

        /* ===================================================
           DETAIL HEADER
        =================================================== */

        .ret-detail-header {
          min-height: 88px;
          padding: 14px 16px;

          border-bottom: 1px solid #dce4e8;

          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
        }

        .ret-detail-documents {
          display: flex;
          align-items: center;
          gap: 22px;
        }

        .ret-detail-main-document {
          display: flex;
          flex-direction: column;

          padding-right: 22px;
          border-right: 1px solid #dce4e8;
        }

        .ret-detail-main-document > span {
          color: #82909c;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.35px;
        }

        .ret-detail-main-document > strong {
          margin-top: 2px;

          color: #007cae;
          font-size: 21px;
          font-weight: 900;
        }

        .ret-detail-main-document > small {
          margin-top: 3px;

          color: #667085;
          font-size: 10px;
          font-weight: 700;
        }

        .ret-document-link {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .ret-document-link-arrow {
          color: #7a9eae;
          font-size: 23px;
          font-weight: 900;
        }

        .ret-document-link > div {
          display: flex;
          flex-direction: column;
        }

        .ret-document-link span:not(.ret-document-link-arrow) {
          color: #82909c;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.35px;
        }

        .ret-document-link strong {
          margin-top: 2px;

          color: #344054;
          font-size: 14px;
          font-weight: 900;
        }

        /* ===================================================
           INFO
        =================================================== */

        .ret-info-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 2fr 2fr;
          gap: 12px;

          margin: 12px 16px;
          padding: 12px;

          background: #f5f8fa;
          border-radius: 7px;
        }

        /* ===================================================
           RELAÇÃO RET / REQ
        =================================================== */

        .ret-relation {
          margin: 0 16px 12px;
          padding: 9px 12px;

          border: 1px solid #c9e6f0;
          border-radius: 7px;

          background: #f1fbfe;

          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ret-relation-icon {
          width: 28px;
          height: 28px;

          flex: 0 0 28px;

          border-radius: 50%;

          background: #1593b7;
          color: #ffffff;

          display: flex;
          align-items: center;
          justify-content: center;

          font-size: 16px;
          font-weight: 900;
        }

        .ret-relation > div:last-child {
          display: flex;
          align-items: baseline;
          gap: 5px;
          flex-wrap: wrap;
        }

        .ret-relation strong {
          color: #007cae;
          font-size: 11px;
          font-weight: 900;
        }

        .ret-relation span {
          color: #667085;
          font-size: 10px;
        }

        .ret-relation b {
          color: #344054;
        }

        /* ===================================================
           PRODUCTS
        =================================================== */

        .ret-products {
          margin-top: 4px;
        }

        .ret-products-title {
          padding: 8px 16px;

          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ret-products-title div {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ret-products-title strong {
          color: #076f92;
          font-size: 14px;
        }

        .ret-products-title span {
          color: #7b8791;
          font-size: 10px;
        }

        .ret-table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .ret-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }

        .ret-table thead {
          background: #edf2f5;
        }

        .ret-table th {
          padding: 10px 8px;

          border-top: 1px solid #dce4e8;
          border-bottom: 1px solid #dce4e8;

          color: #596773;

          font-size: 8px;
          font-weight: 900;

          text-align: left;
          white-space: nowrap;
        }

        .ret-table td {
          padding: 11px 8px;

          border-bottom: 1px solid #e6ebee;

          color: #344054;

          white-space: nowrap;
        }

        .ret-product-name {
          min-width: 210px;
          white-space: normal !important;
          font-weight: 700;
        }

        .ret-return-qty {
          color: #b42318;
          font-size: 12px;
        }

        /* ===================================================
           TIMELINE
        =================================================== */

        .ret-timeline-area {
          margin: 22px 16px 0;
          padding-top: 14px;

          border-top: 1px solid #e3e8eb;
        }

        .ret-timeline-title {
          margin-bottom: 16px;

          color: #076f92;
          font-size: 12px;
          font-weight: 900;
        }

        .ret-timeline {
          display: flex;
          align-items: flex-start;

          padding: 0 4px 18px;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        /* ===================================================
           ACTIONS
        =================================================== */

        .ret-actions {
          margin: 0 16px 18px;
          padding-top: 12px;

          border-top: 1px solid #e3e8eb;

          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .ret-status-info {
          display: flex;
          flex-direction: column;
        }

        .ret-status-info > span {
          color: #7d8994;
          font-size: 8px;
          font-weight: 800;
        }

        .ret-status-info > strong {
          margin-top: 3px;

          color: #344054;
          font-size: 11px;
        }

        .ret-status-info small {
          margin-top: 4px;

          max-width: 620px;

          color: #667085;
          font-size: 9px;
          line-height: 1.4;
        }

        .ret-action-button {
          padding: 11px 18px;

          border: none;
          border-radius: 5px;

          background: #0b8db8;
          color: #ffffff;

          font-size: 10px;
          font-weight: 900;

          cursor: pointer;
          white-space: nowrap;
        }

        .ret-action-button:hover {
          background: #087da4;
        }

        .ret-action-message {
          padding: 9px 13px;

          border-radius: 6px;

          font-size: 9px;
          font-weight: 900;

          white-space: nowrap;
        }

        .ret-action-message.blue {
          background: #eef7fb;
          border: 1px solid #b9dce9;
          color: #087ca4;
        }

        .ret-action-message.yellow {
          background: #fff7df;
          border: 1px solid #ead28b;
          color: #946200;
        }

        .ret-action-message.green {
          background: #e7f7ef;
          border: 1px solid #b9e4cd;
          color: #067647;
        }

        /* ===================================================
           RESPONSIVO
        =================================================== */

        @media (max-width: 1200px) {
          .ret-kpis {
            grid-template-columns: repeat(3, 1fr);
          }

          .ret-content {
            grid-template-columns: 265px minmax(0, 1fr);
          }

          .ret-detail-documents {
            gap: 12px;
          }
        }

        /* ATEL V37.25 - encaixe responsivo sem cortar a timeline */
        /* V37.27: lista ocupa toda a altura real do painel, sem espaco vazio */
        @media (min-width: 981px) {
          .ret-content { align-items: stretch; }
          .ret-list-panel { position: relative; min-height: 0; }
          .ret-list-panel > .ret-list {
            position: absolute;
            top: 48px;
            bottom: 0;
            left: 0;
            right: 0;
            height: auto;
            max-height: none;
            overflow-y: auto;
            overscroll-behavior: contain;
          }
        }

        .ret-detail-panel { min-width: 0; }
        .ret-timeline-area { min-width: 0; margin-left: 12px; margin-right: 12px; }
        .ret-timeline-title { margin-bottom: 12px; }
        .ret-list { max-height: min(680px, calc(100vh - 280px)); }
        @media (max-width: 980px) {
          .ret-content { grid-template-columns: minmax(0, 1fr); }
          .ret-list { max-height: 320px; }
          .ret-header { height: auto; min-height: 54px; flex-wrap: wrap; gap: 8px; padding: 8px 12px; }
          .ret-search { width: min(300px, 55vw); }
        }
        @media (max-width: 600px) {
          .ret-page { padding: 10px; }
          .ret-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ret-timeline-area { margin-left: 6px; margin-right: 6px; }
          .ret-detail-documents { flex-wrap: wrap; }
          .ret-info-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
    </div>
  );
}

/* =========================================================
   KPI
========================================================= */

function KpiCard({
  titulo,
  valor,
  descricao,
  cor,
}: {
  titulo: string;
  valor: number;
  descricao: string;
  cor: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #b9cad4",
        borderRadius: 13,
        overflow: "hidden",
        minHeight: 98,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: cor,
          height: 28,
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          color: "#fff",
          fontSize: 12,
          fontWeight: 800,
          boxSizing: "border-box",
        }}
      >
        {titulo}
      </div>

      <div
        style={{
          padding: "9px 12px 8px",
        }}
      >
        <strong
          style={{
            display: "block",
            color: "#07111d",
            fontSize: 24,
            fontWeight: 500,
            lineHeight: 1,
          }}
        >
          {valor}
        </strong>

        <span
          style={{
            display: "block",
            marginTop: 10,
            color: "#82909c",
            fontSize: 10,
          }}
        >
          {descricao}
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   INFO
========================================================= */

function Info({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div>
      <div
        style={{
          color: "#7d8994",
          fontSize: 8,
          fontWeight: 900,
        }}
      >
        {titulo}
      </div>

      <div
        style={{
          marginTop: 4,
          color: "#344054",
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        {valor}
      </div>
    </div>
  );
}

/* =========================================================
   TIPO
========================================================= */

function TipoBadge({
  tipo,
}: {
  tipo: string;
}) {
  let background = "#fff0bf";
  let color = "#946200";

  if (tipo === "RECUSA_TOTAL") {
    background = "#fee4e2";
    color = "#b42318";
  } else if (tipo === "TROCA") {
    background = "#dff4fb";
    color = "#087ca4";
  } else if (tipo === "CANCELAMENTO") {
    background = "#edf0f2";
    color = "#667085";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 23,
        padding: "0 9px",
        borderRadius: 13,
        fontSize: 9,
        fontWeight: 900,
        whiteSpace: "nowrap",
        background,
        color,
      }}
    >
      {tipoNome[tipo] ?? tipo}
    </span>
  );
}

/* =========================================================
   STATUS
========================================================= */

function StatusBadge({
  status,
}: {
  status: StatusRetorno;
}) {
  let background = "#fff0bf";
  let color = "#946200";

  if (
    [
      "EM_TRANSITO_CD",
      "AGUARDANDO_CONFERENCIA",
      "EM_CONFERENCIA",
    ].includes(status)
  ) {
    background = "#dff4fb";
    color = "#087ca4";
  }

  if (
    ["RECEBIDO", "FINALIZADO"].includes(status)
  ) {
    background = "#dcf4e8";
    color = "#067647";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 23,
        padding: "0 10px",
        borderRadius: 13,
        fontSize: 9,
        fontWeight: 900,
        whiteSpace: "nowrap",
        background,
        color,
      }}
    >
      {statusNome[status]}
    </span>
  );
}

/* =========================================================
   TIMELINE
========================================================= */

function TimelineStep({
  numero,
  titulo,
  subtitulo,
  estado,
}: {
  numero: string;
  titulo: string;
  subtitulo: string;
  estado: "concluido" | "atual" | "pendente";
}) {
  const concluido = estado === "concluido";
  const atual = estado === "atual";

  const background = concluido
    ? "#27a36a"
    : atual
    ? "#1593b7"
    : "#d5dde1";

  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background,
          color: concluido || atual ? "#fff" : "#8a959e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 900,
          boxShadow: atual
            ? "0 0 0 4px #e2f5fb"
            : concluido
            ? "0 0 0 3px #e8f7ef"
            : "none",
        }}
      >
        {numero}
      </div>

      <div
        style={{
          marginTop: 7,
          color: concluido
            ? "#067647"
            : atual
            ? "#087ca4"
            : "#8a959e",
          fontSize: 10,
          fontWeight: 900,
          whiteSpace: "normal",
          overflowWrap: "anywhere",
          padding: "0 2px",
          lineHeight: 1.2,
        }}
      >
        {titulo}
      </div>

      <div
        style={{
          marginTop: 3,
          color: atual ? "#475467" : "#98a2b3",
          fontSize: 8,
          fontWeight: atual ? 700 : 500,
          lineHeight: 1.25,
          minHeight: 20,
        }}
      >
        {subtitulo}
      </div>

      {atual && (
        <div
          style={{
            marginTop: 5,
            padding: "3px 7px",
            borderRadius: 10,
            background: "#e2f5fb",
            color: "#087ca4",
            fontSize: 7,
            fontWeight: 900,
          }}
        >
          ETAPA ATUAL
        </div>
      )}
    </div>
  );
}

function TimelineLine({
  ativo,
}: {
  ativo: boolean;
}) {
  return (
    <div
      style={{
        height: 2,
        flex: 1,
        minWidth: 5,
        maxWidth: 22,
        marginTop: 15,
        background: ativo ? "#27a36a" : "#d5dde1",
      }}
    />
  );
}

/* =========================================================
   STATUS / ETAPA
========================================================= */

function nivelStatus(
  status: StatusRetorno
) {
  switch (status) {
    case "AGUARDANDO_RETORNO":
    case "COM_TECNICO":
      return 2;

    case "EM_TRANSITO_CD":
      return 3;

    case "AGUARDANDO_CONFERENCIA":
    case "EM_CONFERENCIA":
      return 4;

    case "RECEBIDO":
    case "FINALIZADO":
      return 5;

    default:
      return 2;
  }
}

function textoEtapaAtual(
  status: StatusRetorno
) {
  switch (status) {
    case "AGUARDANDO_RETORNO":
    case "COM_TECNICO":
      return "Aguardando envio ao CD";

    case "EM_TRANSITO_CD":
      return "Material em trânsito para o CD";

    case "AGUARDANDO_CONFERENCIA":
      return "Aguardando recebimento no CD";

    case "EM_CONFERENCIA":
      return "Conferência do retorno em andamento";

    case "RECEBIDO":
    case "FINALIZADO":
      return "Retorno finalizado";

    default:
      return statusNome[status];
  }
}

function descricaoEtapaAtual(
  retorno: RetornoDevolucao
) {
  switch (retorno.status) {
    case "AGUARDANDO_RETORNO":
    case "COM_TECNICO":
      return `${retorno.codigo} permanece sob custódia de ${retorno.tecnico}. Este retorno foi originado pela ${retorno.documentoOrigem}. Confirme o envio somente quando o material for efetivamente despachado para ${retorno.destinoFisico}.`;

    case "EM_TRANSITO_CD":
      return `${retorno.codigo}, originado pela ${retorno.documentoOrigem}, está retornando para ${retorno.destinoFisico}. O próximo passo é o recebimento físico pelo coletor.`;

    case "AGUARDANDO_CONFERENCIA":
      return `${retorno.codigo} chegou ao CD e aguarda leitura e conferência física pelo coletor.`;

    case "EM_CONFERENCIA":
      return `O CD está conferindo quantidade, serial e condição dos materiais do ${retorno.codigo}.`;

    case "RECEBIDO":
    case "FINALIZADO":
      return `${retorno.codigo} foi recebido e o destino do estoque foi definido conforme a conferência.`;

    default:
      return "";
  }
}
