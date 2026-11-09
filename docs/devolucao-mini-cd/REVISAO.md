# Persistência administrativa Mini-CD → CD Principal

**Proposta pendente de revisão e aplicação. Nenhum SQL deste diretório foi executado no Supabase.**
O formulário continua bloqueado; não existe integração fictícia ou fallback local.

## Inspeção real, somente leitura — 08/11/2026

Projeto `wms-atel`, ref `ssunettwxzliiwkwvymg`, PostgreSQL 17. A referência corresponde à URL local.

| Estrutura | Evidência / consequência |
| --- | --- |
| `organizacoes` | `id`, `ativo`; ATEL `6ea04673-4deb-42cf-a001-dbb027120103`, ativa. |
| `usuarios_organizacao` | Vínculo único por organização/usuário, `ativo`, perfis `admin`, `gestor`, `operador`, `tecnico`, `auditor`. ATEL possui um admin e um técnico ativos. |
| `locais_estoque` | UUID e FK composta `(id, organizacao_id)`; tipos `cd`, `ponto_apoio`, `estoque_tecnico`, `transito`; responsável opcional. Não há marcador de CD Principal. |
| CD Principal ATEL | `9e67798f-f40b-4f65-bd91-2454a484c623`, `cd`, ativo. O SQL propõe sua designação explícita em uma tabela nova; não o descobre pelo nome em tempo de execução. |
| Mini-CD-For | `e608eddf-a7a8-484f-8d40-ff669abad637`, `ponto_apoio`, ativo, sem responsável. Nenhum responsável será cadastrado automaticamente. |
| `materiais` | FK composta `(id, organizacao_id)`; `rastreio`: `quantidade`, `metragem`, `serial`, `mac`; unidades `UN`, `M`, `CX`, `KIT`. |
| `ativos_rastreados` | UUID, organização, material, serial/MAC, local, `estado`. Não existe coluna `status`. O contrato verifica identidade, custódia e estado sem atualizar o ativo. |
| `atel_menu_permissoes` | Por usuário/rota, sem organização própria. Nenhuma regra exata de `/expedicoes` ou `/expedicoes/retornos` foi encontrada para os vínculos ATEL na inspeção. O contrato combina vínculo/perfil com a negação explícita mais específica da rota. |
| RLS existente | Usa `app_private.tem_acesso`, que exige usuário, vínculo ativo e organização ativa. As novas funções repetem esse escopo explicitamente e não usam email ou `user_metadata` como autorização. |
| RETs existentes | `atel_rets_ped_v3730`: pedido obrigatório, itens e conferência JSONB. `atel_v3730_transicionar_ret` declara retorno `estoque_movimentado=false`. Não será modificada. |
| Devoluções existentes | `devolucoes`/`devolucao_itens` têm estados físicos e possíveis vínculos com OS. Não serão convertidas em requisições administrativas. |
| Transferência existente | `atel_v35_criar` baixa saldo na criação. Não será reutilizada. |
| Contrato administrativo | Não existem RPCs `atel_devolucao_admin_*` no banco inspecionado. |

## SQL para revisão

Arquivo completo: [contrato-proposto.sql](contrato-proposto.sql).

Aplicação integral em uma transação, primeiro em homologação, sob `postgres`.
O script falha se o schema novo já existir; não substitui funções existentes e não é uma migration já aplicada.
Não altera `saldos_estoque`, `movimentacoes_estoque`, `ativos_rastreados`, pedidos, devoluções físicas, RETs ou auditorias históricas.

São criadas quatro tabelas no schema **não exposto** `atel_devolucao_admin`:

- `cd_principal`: um local designado por organização, com FK composta para a mesma organização.
- `requisicoes`: UUID próprio, origem, destino resolvido pelo servidor, solicitante, entrada canônica, revisão e decisão.
- `itens`: UUID próprio, UUID de material, quantidade e snapshots de unidade/rastreio; UUIDs reais dos ativos resolvidos no cadastro.
- `eventos`: auditoria da solicitação/decisão e resultado de idempotência; snapshots completos antes/depois. Trigger recusa UPDATE, DELETE e TRUNCATE, inclusive em tentativas acidentais do executor privilegiado. Clientes não recebem privilégios de tabela.

Não há cadastro duplicado de pedido ou RET. A requisição é um agregado administrativo novo. Futuro atendimento físico deverá referenciá-la; esta etapa não cria essa entidade física.

### RPCs públicas propostas

Todas retornam JSONB com `contrato_versao: 1`. UUIDs permanecem strings UUID, nunca hashes ou números derivados.

| RPC | Parâmetros |
| --- | --- |
| `atel_devolucao_admin_consultar_cd_principal` | `p_organizacao_id uuid` |
| `atel_devolucao_admin_solicitar` | `p_organizacao_id uuid`, `p_origem_id uuid`, `p_motivo text`, `p_itens jsonb`, `p_chave_idempotencia uuid` |
| `atel_devolucao_admin_listar` | Organização, status opcional, limite 1–100, cursor opcional `p_antes_em` + `p_antes_id` |
| `atel_devolucao_admin_aprovar` | Organização, UUID da requisição, revisão esperada, justificativa, UUID de idempotência |
| `atel_devolucao_admin_rejeitar` | Mesmos parâmetros da aprovação |

`p_itens` aceita somente este formato; `seriais` e `macs` são opcionais:

```json
[
  {
    "material_id": "UUID real de materiais.id",
    "quantidade": 2,
    "seriais": [],
    "macs": []
  }
]
```

O cliente não informa destino, solicitante, estado, UUID de RET ou saldo.
Resposta de escrita: `requisicao_id`, `organizacao_id`, `destino_id`, `status`, `revisao`, `repetida`, `estoque_movimentado: false`, `ret_gerado: false`.
A repetição retorna a resposta original da operação, mesmo se a requisição depois tiver sido decidida; a listagem é a fonte do estado atual.
A listagem retorna `requisicoes` e `proximo_cursor`, com paginação por `(criada_em, id)` e snapshots dos itens.

### Política proposta, para aprovação

| Perfil | Consultar/listar | Solicitar | Aprovar/rejeitar |
| --- | --- | --- | --- |
| admin / gestor | Organização ativa | Mini-CD ativo da organização | Organização ativa |
| operador | Organização ativa | Mini-CD ativo da organização | Não |
| tecnico | Apenas Mini-CDs ativos sob sua responsabilidade | Apenas Mini-CD sob sua responsabilidade | Não |
| auditor | Organização ativa | Não | Não |

Uma negação explícita da rota também bloqueia. Não há bypass por email Master.
A aprovação pelo próprio solicitante não é proibida nesta proposta; a decisão fica auditada. Exigir dois usuários distintos seria uma regra de negócio adicional.
Com o cadastro atual, o técnico não poderá solicitar em nome do Mini-CD-For porque não é responsável por ele. Isso falha de forma explícita, sem ampliar permissões.
O catálogo HTTP atual aceita admin/gestor/técnico e usa organização ATEL fixa. A futura integração deverá alinhar sua leitura aos perfis autorizados, sem ampliar o catálogo silenciosamente.

### Validações e concorrência

- Parâmetros UUID tipados: formato inválido resulta em `22P02`; UUID zero/nulo é recusado nas operações de escrita.
- 1–100 materiais únicos por solicitação, entrada até 256 KiB de JSON textual não comprimido; quantidades positivas até 100 milhões e até três casas decimais, sem arredondamento silencioso.
- Somente metragem pode ser fracionada; demais rastreios exigem quantidade inteira.
- Serial/MAC exige um identificador por unidade; identificadores vazios, repetidos, ambíguos, desconhecidos ou de outro material/local/organização são recusados. Limite de 1000 identificadores por item.
- Seriais são comparados em maiúsculas e sem espaços externos. MACs são comparados em hexadecimal sem separadores. O cadastro original não é alterado.
- Estados de ativos aceitos para devolução: `disponivel`, `avariado`, `devolvido`. `reservado`, `em_transito`, `instalado`, `baixado` são recusados. Essa lista é uma decisão de negócio a revisar.
- Aprovação revalida origem, CD Principal, material, unidade, rastreio, custódia e UUID dos ativos. Cadastro incompatível exige rejeição/nova solicitação; não reescreve os itens antigos.
- Rejeição não exige material/CD ainda ativo, para permitir encerrar uma solicitação invalidada.
- Bloqueio consultivo por organização/usuário/chave + unicidade em auditoria; mesma chave com outro conteúdo ou ação falha com `22023`.
- Escritas exigem READ COMMITTED. REPEATABLE READ/SERIALIZABLE recebem `40001` explícito, pois aguardar um lock não atualiza o snapshot dessas transações. Cada ponto de entrada privado tem `lock_timeout=5s`; em `55P03`/`40001`, encerrar a transação e repetir corretamente sem trocar a chave. Não há retry automático que esconda conflitos.
- Chave é estável por intenção. Novo UUID a cada tentativa de rede produziria outra intenção e não deve ser usado pelo futuro cliente.
- Materiais e rastreios são ordenados na entrada canônica; reordenar a mesma entrada não duplica a solicitação.
- Decisão usa `FOR UPDATE`, revisão e transição única `SOLICITADA → APROVADA/REJEITADA`. Repetir a operação confirmada é seguro; outra decisão sobre o mesmo documento falha com `40001`.
- Solicitação, itens e evento de auditoria são atômicos. Decisão e respectivo evento também são atômicos.
- Não há consulta/reserva de saldo, alocação exclusiva de seriais entre solicitações, baixa ou entrada. Solicitações administrativas diferentes podem disputar material: saldo, custódia e atendimento cumulativo deverão ser revalidados na futura confirmação física.

Os clientes não recebem privilégios de tabela. Tabelas novas têm RLS habilitada, sem policies de acesso direto. Os cinco wrappers públicos são `SECURITY INVOKER`; implementações privadas `SECURITY DEFINER` usam `search_path=pg_catalog,pg_temp`, autorização explícita e grants restritos. Helpers internos não são executáveis por authenticated; apenas os quatro pontos de entrada privados necessários aos cinco wrappers recebem EXECUTE. PUBLIC, anon e service_role não recebem esses grants. O script exige executor postgres para tornar o ownership previsível. RLS não restringe o owner privilegiado: a autorização dentro dos pontos de entrada é obrigatória. Não expor o schema privado no PostgREST.
Referências: [funções e privilégios](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Gate de aplicação e testes

1. Revisar o SQL e as decisões de negócio acima, incluindo o mapeamento UUID do CD Principal.
2. Após autorização, aplicar em um clone isolado e executar [verificacao-compilacao.sql](verificacao-compilacao.sql). Este arquivo é somente leitura: valida as funções já instaladas pelos validators PostgreSQL e verifica ownership, ACL, RLS e trigger. Compilação não demonstra a execução de todos os ramos SQL planejados sob demanda.
3. No clone, em sessão postgres, declarar `SET atel.testes_permitidos='homologacao-isolada'` e executar [teste-homologacao.sql](teste-homologacao.sql) via psql com ON_ERROR_STOP. Ele inclui [fixtures-homologacao.sql](fixtures-homologacao.sql), cria usuários sem senha, organizações, vínculos, locais, materiais e ativos novos, e termina com ROLLBACK. Nenhum cadastro ATEL existente é reutilizado ou atualizado. Nunca executar em produção; não rodar o arquivo de fixtures isoladamente. Em erro, executar ROLLBACK antes de continuar. As fixtures de ativos são preparação do teste, não movimentações executadas pelo contrato.
4. Executar os cenários reais de duas sessões de [TESTES-CONCORRENCIA.md](TESTES-CONCORRENCIA.md). O teste sequencial de conflito não comprova espera de locks concorrentes. Homologar ainda mudança de CD Principal, custódia/unidade após solicitação, identificadores ambíguos no cadastro e navegação completa por cursores.
5. Conferir ausência de escrita física e privilégios diretos; executar advisors de segurança após a aplicação autorizada.
6. Somente com contrato confirmado e testes aprovados, integrar consulta do CD Principal, envio com chave estável, lista administrativa e decisões ao formulário existente. Não habilitar envio antes desse gate e não inserir resultados otimistas como se fossem persistidos.

Os testes preparados cobrem solicitação/listagem/aprovação/rejeição, replays, escopo de chaves por usuário/organização, UUIDs cruzados mesmo para usuário membro de A e B, ausência de sessão, vínculo/organização inativos, perfil e rota negados, responsabilidade técnica, quantidades, limite descomprimido, seriais/MACs normalizados/duplicados/desconhecidos/de outro material/local/organização, UUIDs de ativos, auditoria imutável e invariância física. ACL/RLS são verificados separadamente no arquivo de compilação. Todos permanecem NÃO EXECUTADOS.

## Estado da entrega

SQL revisado estaticamente, **não compilado/aplicado/testado em PostgreSQL**. A proibição de SQL de escrita impede instalar os candidatos para compilar ou executar testes; nenhuma exceção foi presumida para DDL com rollback ou banco local. O arquivo de verificação de compilação somente leitura depende de uma instalação futura autorizada. Veja o [relatório objetivo](RELATORIO-REVISAO.md).
Nesta revisão não foram executados TypeScript/build: apenas documentos SQL foram alterados, e esses comandos não verificam PL/pgSQL. Os resultados TypeScript/build da etapa anterior não são evidência de compilação do contrato.
Os módulos da aplicação permanecem intactos e o botão de envio continua bloqueado.
