export const ATEL_MASTER = "master@wmsexpert.com.br";
export const ATEL_TESTE = "teste@wmsexpert.com.br";
export const ATEL_GRUPOS = {
  Cadastros: [["Clientes", "/clientes"], ["Ativos", "/ativos"], ["Técnicos", "/tecnicos"]],
  Relatórios: [["Estoque Técnico", "/relatorios/estoque-tecnico"], ["Patrimônio Cliente", "/relatorios/patrimonio-cliente"]],
  Movimentações: [["Movimentações", "/movimentacoes"], ["Reversa", "/reversa"]],
  Expedições: [["Dashboard", "/expedicoes"], ["Gestão", "/expedicoes/gestao"], ["Ordens de Serviço", "/admin/ordens-servico"], ["OS Adapter", "/expedicoes/os-adapter"], ["Regularização", "/expedicoes/os-adapter/regularizacao"], ["Requisições Técnicas", "/expedicoes/requisicoes-tecnicas"], ["Retornos / Devoluções", "/expedicoes/retornos"], ["Pendências", "/expedicoes/pendencias"]],
  Auditoria: [["Integridade", "/admin/auditoria-integridade"]],
  ERP: [["Integrações", "/integracoes"]],
  Painel: [["Operador Logístico", "/operacao"], ["Ordens de Serviço", "/os"], ["Visão Operacional", "/"], ["Governança Operacional", "/admin/governanca-operacional"]],
  Coletor: [["Início", "/coletor"], ["Recebimento", "/coletor/recebimento"], ["Separação", "/coletor/separacao"], ["Conferência", "/coletor/conferencia"], ["Embarque", "/coletor/embarque"], ["Retornos", "/coletor/retornos"], ["Consulta", "/coletor/consulta"], ["Estoque", "/coletor/estoque"], ["Expedições", "/coletor/expedicoes"], ["Ordens de Serviço", "/coletor/ordens-servico"], ["Jornada OS", "/coletor/jornada-os"]]
} as const;
export const ATEL_ROTAS = Object.values(ATEL_GRUPOS).flatMap(v => v.map(([,url]) => url));
export function rotaLiberada(path:string, regras:Record<string,boolean>) {
  const matches = ATEL_ROTAS.filter(r => path === r || (r !== "/" && path.startsWith(r + "/"))).sort((a,b)=>b.length-a.length);
  if (!matches.length) return true;
  const route = matches[0];
  return regras[route] !== false;
}
