-- NAO EXECUTADO. Somente em clone isolado, contrato revisado instalado e apos autorizacao.
-- psql -X -v ON_ERROR_STOP=1 -c "SET atel.testes_permitidos='homologacao-isolada'" -f teste-homologacao.sql
-- O opt-in deve ocorrer na mesma conexao que executa o arquivo.
-- Fixtures novas e descartaveis; nenhuma atualizacao de cadastros/historicos existentes.
-- Nenhum comando deste arquivo foi executado nesta revisao. Em erro: ROLLBACK.
\set ON_ERROR_STOP on
begin isolation level read committed;
set local lock_timeout='5s';
set local statement_timeout='60s';
set local check_function_bodies=on;
set local plpgsql.extra_errors='all';
do $$ begin
  if current_user<>'postgres' or current_setting('atel.testes_permitidos',true) is distinct from 'homologacao-isolada' then
    raise exception 'Teste exige postgres e opt-in de homologacao isolada';
  end if;
  if to_regprocedure('public.atel_devolucao_admin_solicitar(uuid,uuid,text,jsonb,uuid)') is null then
    raise exception 'Contrato revisado deve estar instalado no clone';
  end if;
end $$;
\ir fixtures-homologacao.sql
create temp table devolucao_fisico_antes on commit drop as select pg_temp.fotografia() as dados;

set local role authenticated;
do $$
declare
  v jsonb; org uuid; org_b uuid; origem uuid; chave uuid:=gen_random_uuid(); decisao uuid:=gen_random_uuid();
  entrada jsonb; entrada_b jsonb; resposta jsonb; repetida jsonb; lista jsonb; item jsonb;
  req uuid; req_rejeicao uuid; req_serial uuid; req_mac uuid; campo text; sql_chamada text;
begin
  select f.dados into strict v from pg_temp.devolucao_fixture as f;
  org:=(v->>'org_a')::uuid; org_b:=(v->>'org_b')::uuid; origem:=(v->>'mini_a')::uuid;
  entrada:=jsonb_build_array(jsonb_build_object('material_id',v->>'q_a','quantidade',1));
  entrada_b:=jsonb_build_array(jsonb_build_object('material_id',v->>'q_b','quantidade',1));
  perform pg_temp.login((v->>'admin_a')::uuid);
  resposta:=public.atel_devolucao_admin_consultar_cd_principal(org);
  perform pg_temp.assert_true((resposta->>'local_id')=(v->>'cd_a'),'CD Principal de A');
  resposta:=pg_temp.solicitar(org,origem,entrada,'Fixture solicitacao',chave); req:=(resposta->>'requisicao_id')::uuid;
  perform pg_temp.assert_true(req is not null and resposta->>'status'='SOLICITADA' and (resposta->>'destino_id')=(v->>'cd_a')
    and resposta->>'estoque_movimentado'='false' and resposta->>'ret_gerado'='false','Resposta inicial invalida');
  repetida:=pg_temp.solicitar(org,origem,entrada,'Fixture solicitacao',chave);
  perform pg_temp.assert_true(repetida->>'requisicao_id'=req::text and repetida->>'repetida'='true','Solicitacao duplicada');
  perform pg_temp.assert_erro(format('select pg_temp.solicitar(%L,%L,%L::jsonb,%L,%L)',org,origem,entrada,'Outro motivo',chave),'22023','conteudo diferente');
  resposta:=public.atel_devolucao_admin_aprovar(org,req,1,'Fixture aprovacao',decisao);
  repetida:=public.atel_devolucao_admin_aprovar(org,req,1,'Fixture aprovacao',decisao);
  perform pg_temp.assert_true(resposta->>'status'='APROVADA' and repetida->>'repetida'='true','Aprovacao nao idempotente');
  perform pg_temp.assert_erro(format('select public.atel_devolucao_admin_rejeitar(%L,%L,1,%L,%L)',org,req,'Outra decisao',gen_random_uuid()),'40001','ja decidida');
  resposta:=pg_temp.solicitar(org,origem,entrada); req_rejeicao:=(resposta->>'requisicao_id')::uuid; chave:=gen_random_uuid();
  resposta:=public.atel_devolucao_admin_rejeitar(org,req_rejeicao,1,'Fixture rejeitada',chave);
  repetida:=public.atel_devolucao_admin_rejeitar(org,req_rejeicao,1,'Fixture rejeitada',chave);
  perform pg_temp.assert_true(resposta->>'status'='REJEITADA' and repetida->>'repetida'='true','Rejeicao nao idempotente');
  perform pg_temp.assert_erro(format('select public.atel_devolucao_admin_aprovar(%L,%L,1,%L,%L)',org,req_rejeicao,'Outra acao',chave),'22023','conteudo diferente');

  -- Sem vinculo em B: negar todas as operacoes, sem revelar se o documento existe.
  foreach sql_chamada in array array[
    format('select public.atel_devolucao_admin_consultar_cd_principal(%L)',org_b),
    format('select public.atel_devolucao_admin_listar(%L)',org_b),
    format('select pg_temp.solicitar(%L,%L,%L::jsonb)',org_b,v->>'mini_b',entrada_b),
    format('select public.atel_devolucao_admin_aprovar(%L,%L,1,%L,%L)',org_b,req,'Sem vinculo',gen_random_uuid()),
    format('select public.atel_devolucao_admin_rejeitar(%L,%L,1,%L,%L)',org_b,req,'Sem vinculo',gen_random_uuid())
  ] loop perform pg_temp.assert_erro(sql_chamada,'42501','vinculo ativo'); end loop;
  -- Mesmo usuario autorizado nas duas organizacoes nao pode cruzar UUIDs.
  perform pg_temp.login((v->>'admin_ambos')::uuid);
  perform pg_temp.assert_erro(format('select public.atel_devolucao_admin_aprovar(%L,%L,1,%L,%L)',org_b,req,'UUID de A em B',gen_random_uuid()),'22023','nesta organizacao');
  perform pg_temp.negativa(org_b,origem,entrada_b,'P0001','Origem deve');
  perform pg_temp.negativa(org,origem,entrada_b,'P0001','Material inexistente');
  perform pg_temp.assert_erro(format('select public.atel_devolucao_admin_consultar_cd_principal(%L)',v->>'org_inativa'),'42501','vinculo ativo');
  chave:=gen_random_uuid();
  resposta:=pg_temp.solicitar(org,origem,entrada,'Chave por organizacao',chave);
  repetida:=pg_temp.solicitar(org_b,(v->>'mini_b')::uuid,entrada_b,'Chave por organizacao',chave);
  perform pg_temp.assert_true((resposta->>'requisicao_id')<>(repetida->>'requisicao_id') and (repetida->>'destino_id')=(v->>'cd_b'),'Escopo de chave/destino');
  lista:=public.atel_devolucao_admin_listar(org_b);
  perform pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(lista->'requisicoes') as j(req) where j.req->>'organizacao_id'<>org_b::text),'Listagem vazou A em B');
  -- Mesma chave em usuarios diferentes e outra intencao, nao replay de outro ator.
  perform pg_temp.login((v->>'admin_a')::uuid);
  repetida:=pg_temp.solicitar(org,origem,entrada,'Chave por organizacao',chave);
  perform pg_temp.assert_true((resposta->>'requisicao_id')<>(repetida->>'requisicao_id'),'Chave cruzou usuarios');

  perform pg_temp.login((v->>'tecnico_a')::uuid);
  perform pg_temp.solicitar(org,origem,entrada);
  perform pg_temp.negativa(org,(v->>'outro_mini_a')::uuid,entrada,'42501','responsabilidade');
  perform pg_temp.assert_erro(format('select public.atel_devolucao_admin_aprovar(%L,%L,1,%L,%L)',org,req,'Tecnico nao decide',gen_random_uuid()),'42501','Perfil');
  lista:=public.atel_devolucao_admin_listar(org);
  perform pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(lista->'requisicoes') as j(req) where j.req->>'origem_id'<>origem::text),'Tecnico viu outro Mini-CD');
  perform pg_temp.login((v->>'operador_a')::uuid);
  perform pg_temp.solicitar(org,origem,entrada);
  perform pg_temp.assert_erro(format('select public.atel_devolucao_admin_rejeitar(%L,%L,1,%L,%L)',org,req,'Operador nao decide',gen_random_uuid()),'42501','Perfil');
  perform pg_temp.login((v->>'auditor_a')::uuid);
  perform public.atel_devolucao_admin_listar(org);
  perform pg_temp.negativa(org,origem,entrada,'42501','Perfil');
  foreach campo in array array['negado_a','negado_pai_a'] loop
    perform pg_temp.login((v->>campo)::uuid);
    foreach sql_chamada in array array[
      format('select public.atel_devolucao_admin_consultar_cd_principal(%L)',org),format('select public.atel_devolucao_admin_listar(%L)',org),
      format('select pg_temp.solicitar(%L,%L,%L::jsonb)',org,origem,entrada),
      format('select public.atel_devolucao_admin_aprovar(%L,%L,1,%L,%L)',org,req,'Rota bloqueada',gen_random_uuid()),
      format('select public.atel_devolucao_admin_rejeitar(%L,%L,1,%L,%L)',org,req,'Rota bloqueada',gen_random_uuid())
    ] loop perform pg_temp.assert_erro(sql_chamada,'42501','Rotina'); end loop;
  end loop;
  perform pg_temp.login((v->>'inativo_a')::uuid);
  perform pg_temp.assert_erro(format('select public.atel_devolucao_admin_listar(%L)',org),'42501','vinculo ativo');
  perform pg_temp.login(null);
  perform pg_temp.assert_erro(format('select public.atel_devolucao_admin_listar(%L)',org),'42501','Autenticacao');
  perform pg_temp.login((v->>'admin_a')::uuid);

  perform pg_temp.assert_erro('select public.atel_devolucao_admin_consultar_cd_principal(''nao-e-uuid'')','22P02');
  perform pg_temp.assert_erro(format('select public.atel_devolucao_admin_listar(%L,null,0)',org),'22023','paginacao');
  perform pg_temp.assert_erro(format('select pg_temp.solicitar(%L,%L,%L::jsonb,%L,%L)',org,origem,entrada,'Chave zero','00000000-0000-0000-0000-000000000000'),'22023','invalido');
  foreach item in array array[
    jsonb_build_array(jsonb_build_object('material_id',v->>'q_a','quantidade',0)),
    jsonb_build_array(jsonb_build_object('material_id',v->>'q_a','quantidade',-1)),
    jsonb_build_array(jsonb_build_object('material_id',v->>'q_a','quantidade',1.5)),
    jsonb_build_array(jsonb_build_object('material_id',v->>'metro_a','quantidade',1.0001)),
    jsonb_build_array(jsonb_build_object('material_id',v->>'q_a','quantidade',100000001)),
    jsonb_build_array(jsonb_build_object('material_id',v->>'inativo_material_a','quantidade',1)),entrada || entrada,
    jsonb_build_array(jsonb_build_object('material_id',v->>'q_a','quantidade',1,'destino_id',v->>'cd_b')),
    jsonb_build_array(jsonb_build_object('material_id',v->>'q_a','quantidade',1,'seriais',jsonb_build_array(repeat('X',270000))))
  ] loop perform pg_temp.negativa(org,origem,item); end loop;
  perform pg_temp.solicitar(org,origem,jsonb_build_array(jsonb_build_object('material_id',v->>'metro_a','quantidade',1.125)));

  -- Seriais: normalizacao, ordem independente e preservacao de UUIDs.
  chave:=gen_random_uuid();
  entrada:=jsonb_build_array(jsonb_build_object('material_id',v->>'serial_a','quantidade',2,'seriais',jsonb_build_array(' '||lower(v->>'s2')||' ',v->>'s1')));
  resposta:=pg_temp.solicitar(org,origem,entrada,'Fixture seriais',chave); req_serial:=(resposta->>'requisicao_id')::uuid;
  entrada:=jsonb_build_array(jsonb_build_object('material_id',v->>'serial_a','quantidade',2,'seriais',jsonb_build_array(v->>'s1',v->>'s2')));
  repetida:=pg_temp.solicitar(org,origem,entrada,'Fixture seriais',chave);
  perform pg_temp.assert_true(repetida->>'requisicao_id'=req_serial::text and repetida->>'repetida'='true','Ordem/case de seriais duplicou');
  lista:=public.atel_devolucao_admin_listar(org);
  select j.req->'itens'->0 into strict item from jsonb_array_elements(lista->'requisicoes') as j(req) where j.req->>'id'=req_serial::text;
  perform pg_temp.assert_true(item->'ativos_ids' @> jsonb_build_array(v->>'ativo_s1',v->>'ativo_s2') and jsonb_array_length(item->'ativos_ids')=2,'UUIDs de ativos perdidos');
  perform public.atel_devolucao_admin_aprovar(org,req_serial,1,'Seriais revalidados',gen_random_uuid());
  foreach item in array array[
    jsonb_build_array(jsonb_build_object('material_id',v->>'serial_a','quantidade',1)),
    jsonb_build_array(jsonb_build_object('material_id',v->>'serial_a','quantidade',2,'seriais',jsonb_build_array(v->>'s1',lower(v->>'s1')))),
    jsonb_build_array(jsonb_build_object('material_id',v->>'serial_a','quantidade',1,'seriais',jsonb_build_array(''))),
    jsonb_build_array(jsonb_build_object('material_id',v->>'serial_a','quantidade',1,'seriais',jsonb_build_array(123))),
    jsonb_build_array(jsonb_build_object('material_id',v->>'serial_a','quantidade',1,'seriais',jsonb_build_array(v->>'sb'))),
    jsonb_build_array(jsonb_build_object('material_id',v->>'serial_a','quantidade',1,'seriais',jsonb_build_array(v->>'reservado'))),
    jsonb_build_array(jsonb_build_object('material_id',v->>'serial_a','quantidade',1,'seriais',jsonb_build_array(v->>'fora'))),
    jsonb_build_array(jsonb_build_object('material_id',v->>'serial_a','quantidade',1,'seriais',jsonb_build_array(v->>'outro_material')))
  ] loop perform pg_temp.negativa(org,origem,item); end loop;

  -- MACs: comparacao sem separadores/case, cardinalidade e identificador desconhecido.
  chave:=gen_random_uuid();
  entrada:=jsonb_build_array(jsonb_build_object('material_id',v->>'mac_a','quantidade',1,'macs',jsonb_build_array(lower(v->>'mac'))));
  resposta:=pg_temp.solicitar(org,origem,entrada,'Fixture MAC',chave); req_mac:=(resposta->>'requisicao_id')::uuid;
  entrada:=jsonb_build_array(jsonb_build_object('material_id',v->>'mac_a','quantidade',1,'macs',jsonb_build_array(regexp_replace(v->>'mac','(..)(..)(..)(..)(..)(..)','\1:\2:\3:\4:\5:\6'))));
  repetida:=pg_temp.solicitar(org,origem,entrada,'Fixture MAC',chave);
  perform pg_temp.assert_true(repetida->>'requisicao_id'=req_mac::text and repetida->>'repetida'='true','MAC equivalente duplicou documento');
  lista:=public.atel_devolucao_admin_listar(org);
  select j.req->'itens'->0 into strict item from jsonb_array_elements(lista->'requisicoes') as j(req) where j.req->>'id'=req_mac::text;
  perform pg_temp.assert_true(item->'ativos_ids'=jsonb_build_array(v->>'ativo_mac'),'UUID do ativo MAC perdido');
  perform public.atel_devolucao_admin_aprovar(org,req_mac,1,'MAC revalidado',gen_random_uuid());
  foreach item in array array[
    jsonb_build_array(jsonb_build_object('material_id',v->>'mac_a','quantidade',1)),
    jsonb_build_array(jsonb_build_object('material_id',v->>'mac_a','quantidade',1,'macs',jsonb_build_array('ZZ:00:00:00:00:00'))),
    jsonb_build_array(jsonb_build_object('material_id',v->>'mac_a','quantidade',2,'macs',jsonb_build_array(v->>'mac',lower(v->>'mac')))),
    jsonb_build_array(jsonb_build_object('material_id',v->>'mac_a','quantidade',1,'macs',jsonb_build_array('000000000000'))),
    jsonb_build_array(jsonb_build_object('material_id',v->>'mac_a','quantidade',1,'macs',jsonb_build_array(v->>'mac_b_valor'))),
    jsonb_build_array(jsonb_build_object('material_id',v->>'mac_a','quantidade',1,'macs',jsonb_build_array(v->>'mac_fora'))),
    jsonb_build_array(jsonb_build_object('material_id',v->>'mac_a','quantidade',1,'seriais',jsonb_build_array(v->>'s1')))
  ] loop perform pg_temp.negativa(org,origem,item); end loop;
  perform pg_temp.assert_erro('select 1 from atel_devolucao_admin.requisicoes','42501');
  perform pg_temp.assert_erro(format('select atel_devolucao_admin.destino(%L)',org),'42501');
  perform set_config('atel_teste.req',req::text,true);
  raise notice 'Casos administrativos, organizacoes, perfis, UUIDs, seriais e MACs percorridos';
end $$;
reset role;

do $$
declare ev atel_devolucao_admin.eventos%rowtype;
begin
  perform pg_temp.assert_true((select count(*)=2 from atel_devolucao_admin.eventos as e where e.requisicao_id=current_setting('atel_teste.req')::uuid),'Auditoria duplicada/ausente');
  select e.* into strict ev from atel_devolucao_admin.eventos as e where e.requisicao_id=current_setting('atel_teste.req')::uuid and e.acao='APROVAR';
  perform pg_temp.assert_true(ev.antes->>'status'='SOLICITADA' and ev.depois->>'status'='APROVADA'
    and ev.depois->>'decidida_por'=ev.usuario_id::text and ev.depois->>'decidida_em' is not null
    and ev.depois->>'justificativa'='Fixture aprovacao','Auditoria final incompleta');
  perform pg_temp.assert_erro(format('update atel_devolucao_admin.eventos set acao=acao where id=%L',ev.id),'42501','somente de acrescimo');
  perform pg_temp.assert_erro(format('delete from atel_devolucao_admin.eventos where id=%L',ev.id),'42501','somente de acrescimo');
  perform pg_temp.assert_true(pg_temp.fotografia()=(select b.dados from pg_temp.devolucao_fisico_antes as b),'Alteracao indevida de estoque/ativos/RET/devolucao');
end $$;
select 'Testes encerrados; todas as fixtures serao revertidas' as resultado;
rollback;
