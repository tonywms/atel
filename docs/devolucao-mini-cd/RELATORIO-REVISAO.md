# Relatório da revisão restrita a docs/devolucao-mini-cd

## Problemas encontrados e correções

| Área | Problema / limite anterior | Correção |
| --- | --- | --- |
| Entrada | `pg_column_size(jsonb)` pode medir representação comprimida, não o limite textual anunciado. | `octet_length(p_itens::text)`, com teste de entrada altamente repetitiva acima de 256 KiB. |
| Compilação e aliases | Havia aliases escalares implícitos em SRFs/UNNEST, casts de arrays pouco explícitos e dependência das configurações de compilação da sessão. Não foi comprovado que esses aliases, isoladamente, fossem erros de sintaxe. | Aliases `AS j(valor)`/`AS u(ativo_id)`, agregações UUID[] explícitas e arrays vazios tipados. `check_function_bodies=on`, `plpgsql.extra_errors=all`, `plpgsql.variable_conflict=error` na instalação. |
| Ownership | A instrução “executar como postgres” não era verificada; SECURITY DEFINER depende de quem cria a função. | O script aborta para outro current_user antes de criar objetos. |
| SECURITY / RLS | Arquitetura de wrappers INVOKER e helpers privados DEFINER era adequada, mas a revisão não verificava ACLs efetivas, service_role ou proteção contra objetos temporários. | `search_path=pg_catalog,pg_temp`, nomes de relações qualificados, revogações explícitas também de service_role, teste de ownership/ACL/RLS. Apenas os pontos privados necessários recebem EXECUTE. Nenhum bypass de organização por email. |
| Idempotência / isolamento | Advisory lock não renova snapshot de REPEATABLE READ/SERIALIZABLE; promessa de replay transparente nesses níveis era incompleta. | Escritas aceitam apenas READ COMMITTED e falham com `40001` nos demais níveis. Estado/revisão e escopo organização/ator/chave preservados; conflitos de payload continuam `22023`. |
| Espera concorrente | Timeout da instalação não limita chamadas futuras das RPCs. | `lock_timeout=5s` nos pontos de entrada privados; roteiro cobre espera, timeout/reenvio e duas decisões concorrentes. |
| Auditoria | `depois` da decisão guardava apenas a resposta resumida, sem ator/data/justificativa no snapshot; proteção era apenas por privilégios. | Snapshots completos da requisição antes/depois; solicitação audita também UUIDs persistidos dos itens. Trigger impede UPDATE/DELETE/TRUNCATE dos eventos. |
| Rastreios | Busca filtrada por material podia aceitar um identificador também cadastrado em outro material da mesma organização. | Busca normalizada no escopo da organização e rejeição de identidade ambígua/material incorreto, mantendo UUIDs reais e validando custódia. Não cria índice nem altera o cadastro de ativos. |
| Testes | Smoke test dependia de cadastros ATEL, não cobria organizações/perfis negados/rastreios e usava contagens insuficientes para cobrir esses riscos. | Fixtures descartáveis de A/B + organização inativa, usuário membro de ambas, perfis e rotas negados; cenários positivos/negativos de serial e MAC; snapshots físicos antes/depois e auditoria. Casos concorrentes reais documentados separadamente. |

## Invariantes preservadas

- O destino nunca vem do cliente: consulta a designação explícita do CD Principal da mesma organização. Aprovação recusa mudança desse destino sem reescrever o documento.
- Somente requisições administrativas e respectivos eventos são persistidos pelo contrato. Nenhuma escrita em estoque, movimentos, ativos, pedidos, RETs, devoluções físicas ou seus históricos.
- Replays não criam eventos/documentos extras; decisões só saem de SOLICITADA e exigem revisão esperada.
- Solicitar/aprovar não reserva saldo nem serial; disputa de material entre intenções administrativas distintas continua sujeita a revalidação física futura.
- RLS e privilégios diretos negam tabelas aos clientes, mas não substituem as verificações explícitas executadas pelo código privilegiado.

## Verificações realizadas e pendentes

Realizadas: leitura somente deste diretório, revisão estática e checagem lexical/escopo com [verificar-estatico.mjs](verificar-estatico.mjs). Nenhuma consulta a banco foi necessária nesta revisão. Não foram executados SQL, DDL com rollback, testes de homologação, Git, build, push ou deploy.

**Não há resultado de compilação PostgreSQL nesta entrega.** Compilar funções candidatas ainda não instaladas exige DDL, incompatível com a restrição atual. Não confundir a checagem lexical, CREATE FUNCTION futuro ou TypeScript com execução dos ramos SQL de PL/pgSQL. Preparado [verificacao-compilacao.sql](verificacao-compilacao.sql), somente leitura, para validar o contrato depois de instalação autorizada em clone.

Pendentes em clone autorizado: validators PostgreSQL, execução de toda a suíte, concorrência real, revogação/configuração concorrente, mudança de custódia/unidade/CD, identificadores ambíguos e paginação integral. Os arquivos de teste são propostas não executadas; criam fixtures novas e terminam com rollback. A suíte requer psql, opt-in explícito e nunca deve ser executada em produção.

Base técnica: [CREATE FUNCTION e SECURITY DEFINER](https://www.postgresql.org/docs/17/sql-createfunction.html), [isolamento de transações](https://www.postgresql.org/docs/17/transaction-iso.html), [checks PL/pgSQL](https://www.postgresql.org/docs/17/plpgsql-development-tips.html).
