// Checagem lexical e de escopo, sem banco e sem escrita. NAO e compilador SQL/PLpgSQL.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const raiz = new URL('./', import.meta.url);
const ler = nome => readFileSync(new URL(nome, raiz), 'utf8');
const contrato = ler('contrato-proposto.sql');

function lexical(texto, nome) {
  let nivel = 0;
  for (let i = 0; i < texto.length;) {
    if (texto.startsWith('--', i)) { const fim = texto.indexOf('\n', i); i = fim < 0 ? texto.length : fim + 1; continue; }
    if (texto[i] === "'" || texto[i] === '"') {
      const aspa = texto[i++]; let fechou = false;
      while (i < texto.length) {
        if (texto[i++] === aspa) { if (texto[i] === aspa) i++; else { fechou = true; break; } }
      }
      assert(fechou, `${nome}: literal/identificador nao fechado`); continue;
    }
    const dollar = texto.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/)?.[0];
    if (dollar) {
      const fim = texto.indexOf(dollar, i + dollar.length);
      assert(fim >= 0, `${nome}: dollar quote nao fechado`);
      lexical(texto.slice(i + dollar.length, fim), `${nome}:corpo`);
      i = fim + dollar.length; continue;
    }
    assert(texto[i] !== '$', `${nome}: delimitador dollar inesperado`);
    if (texto[i] === '(') nivel++;
    if (texto[i] === ')') { nivel--; assert(nivel >= 0, `${nome}: parenteses excedente`); }
    i++;
  }
  assert.equal(nivel, 0, `${nome}: parenteses nao fechado`);
}

for (const nome of readdirSync(fileURLToPath(raiz)).filter(n => n.endsWith('.sql'))) lexical(ler(nome), nome);
const funcoes = [...contrato.matchAll(/create function ([a-z_]+)\.([a-z_]+)\([^]*?\)\s*\nreturns ([^]*?)as \$\$([^]*?)\$\$;/gi)];
assert.equal(funcoes.length, 14, 'Esperadas 14 funcoes propostas');
for (const [, schema, nome, atributos] of funcoes) {
  assert(/set search_path=pg_catalog,pg_temp/.test(atributos), `${nome}: search_path`);
  if (schema === 'public') assert(/language sql security invoker/.test(atributos), `${nome}: wrapper deve ser INVOKER`);
}
const semComentarios = contrato.replace(/--[^\n]*/g, '');
for (const [, , schema, tabela] of semComentarios.matchAll(/\b(insert\s+into|update|delete\s+from|truncate(?:\s+table)?)\s+([a-z_]+)\.([a-z_]+)/gi)) {
  assert.equal(schema, 'atel_devolucao_admin', `Escrita fora do agregado administrativo: ${schema}.${tabela}`);
  assert(['cd_principal', 'requisicoes', 'itens', 'eventos'].includes(tabela), `Tabela inesperada: ${tabela}`);
}
assert(!/\bexecute\s+(?:format\s*\(|')/i.test(semComentarios), 'SQL dinamico no contrato');
assert(!/\bpublic\.(?:saldos_estoque|movimentacoes_estoque|atel_rets_ped_v3730|devolucoes|devolucao_itens|atel_pedidos_saida_v36)\b/i.test(semComentarios), 'Referencia fisica inesperada no contrato administrativo');
assert(!/\batel_(?:v35_|v3730_|receber_estoque|abastecimento)/i.test(semComentarios), 'Chamada de operacao fisica inesperada');
assert(/octet_length\(p_itens::text\)/.test(contrato), 'Limite textual de entrada ausente');
assert(!/pg_column_size/.test(contrato), 'Limite comprimido ainda presente');
assert(/transaction_isolation/.test(contrato) && /read committed/.test(contrato), 'Isolamento nao declarado');
assert(/eventos_somente_acrescimo before update or delete or truncate/.test(contrato), 'Auditoria mutavel');
assert(/check_function_bodies = on/.test(contrato), 'Check de corpos desativado');
assert.equal((contrato.match(/enable row level security/g) ?? []).length, 4, 'RLS das quatro tabelas');
console.log('OK: delimitadores/literais/parenteses dos SQLs; 14 funcoes; wrappers INVOKER; escopo administrativo de escrita; RLS e guardas estaticas.');
console.log('NAO verifica compilacao, tipos/nomes no PostgreSQL, permissao efetiva nem concorrencia real. Nenhum SQL foi executado.');
