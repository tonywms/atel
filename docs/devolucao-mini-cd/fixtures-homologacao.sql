-- Incluido por teste-homologacao.sql. NAO EXECUTADO. Nunca usar em producao.
-- Todos os UUIDs sao novos e todos os registros serao revertidos pelo chamador.
create temp table devolucao_fixture(dados jsonb not null) on commit drop;
do $$
declare v jsonb:='{}'; k text; u uuid; nome_schema text;
begin
  foreach k in array array['org_a','org_b','org_inativa','cd_a','cd_b','mini_a','outro_mini_a','mini_b',
    'admin_a','admin_b','admin_ambos','tecnico_a','operador_a','auditor_a','negado_a','negado_pai_a','inativo_a',
    'q_a','q_b','serial_a','serial_b','mac_a','mac_b','metro_a','inativo_material_a',
    'ativo_s1','ativo_s2','ativo_sb','ativo_reservado','ativo_fora','ativo_outro_material','ativo_mac','ativo_mac_b','ativo_mac_fora'] loop
    v:=v || jsonb_build_object(k,gen_random_uuid());
  end loop;
  v:=v || jsonb_build_object('s1','REVISAO-'||(v->>'ativo_s1'),'s2','REVISAO-'||(v->>'ativo_s2'),
    'sb','REVISAO-'||(v->>'ativo_sb'),'reservado','REVISAO-'||(v->>'ativo_reservado'),
    'fora','REVISAO-'||(v->>'ativo_fora'),'outro_material','REVISAO-'||(v->>'ativo_outro_material'),
    'mac',upper(substr(replace(v->>'ativo_mac','-',''),1,12)),
    'mac_b_valor',upper(substr(replace(v->>'ativo_mac_b','-',''),1,12)),
    'mac_fora',upper(substr(replace(v->>'ativo_mac_fora','-',''),1,12)));
  foreach k in array array['admin_a','admin_b','admin_ambos','tecnico_a','operador_a','auditor_a','negado_a','negado_pai_a','inativo_a'] loop
    u:=(v->>k)::uuid;
    insert into auth.users(id,email,aud,role,created_at,updated_at)
      values(u,'revisao-'||u::text||'@example.invalid','authenticated','authenticated',now(),now());
  end loop;
  insert into public.organizacoes(id,nome,ativo) values
    ((v->>'org_a')::uuid,'Fixture devolucao A',true),((v->>'org_b')::uuid,'Fixture devolucao B',true),((v->>'org_inativa')::uuid,'Fixture inativa',false);
  insert into public.usuarios_organizacao(organizacao_id,usuario_id,perfil,ativo)
    select (v->>'org_a')::uuid,(v->>f.chave)::uuid,f.perfil,f.ativo from (values
      ('admin_a','admin',true),('admin_ambos','admin',true),('tecnico_a','tecnico',true),('operador_a','operador',true),
      ('auditor_a','auditor',true),('negado_a','admin',true),('negado_pai_a','admin',true),('inativo_a','admin',false)
    ) as f(chave,perfil,ativo);
  insert into public.usuarios_organizacao(organizacao_id,usuario_id,perfil,ativo) values
    ((v->>'org_b')::uuid,(v->>'admin_b')::uuid,'admin',true),((v->>'org_b')::uuid,(v->>'admin_ambos')::uuid,'admin',true),
    ((v->>'org_inativa')::uuid,(v->>'admin_ambos')::uuid,'admin',true);
  insert into public.locais_estoque(id,organizacao_id,nome,tipo,responsavel_usuario_id,ativo) values
    ((v->>'cd_a')::uuid,(v->>'org_a')::uuid,'CD fixture A','cd',null,true),
    ((v->>'cd_b')::uuid,(v->>'org_b')::uuid,'CD fixture B','cd',null,true),
    ((v->>'mini_a')::uuid,(v->>'org_a')::uuid,'Mini fixture A','ponto_apoio',(v->>'tecnico_a')::uuid,true),
    ((v->>'outro_mini_a')::uuid,(v->>'org_a')::uuid,'Outro mini fixture A','ponto_apoio',null,true),
    ((v->>'mini_b')::uuid,(v->>'org_b')::uuid,'Mini fixture B','ponto_apoio',null,true);
  insert into atel_devolucao_admin.cd_principal(organizacao_id,local_id) values
    ((v->>'org_a')::uuid,(v->>'cd_a')::uuid),((v->>'org_b')::uuid,(v->>'cd_b')::uuid);
  insert into public.materiais(id,organizacao_id,sku,descricao,unidade,rastreio,ativo)
    select (v->>f.chave)::uuid,(v->>'org_a')::uuid,f.chave,'Material fixture '||f.chave,f.unidade,f.rastreio,f.ativo from (values
      ('q_a','UN','quantidade',true),('serial_a','UN','serial',true),('mac_a','UN','mac',true),
      ('metro_a','M','metragem',true),('inativo_material_a','UN','quantidade',false)
    ) as f(chave,unidade,rastreio,ativo);
  insert into public.materiais(id,organizacao_id,sku,descricao,unidade,rastreio,ativo) values
    ((v->>'q_b')::uuid,(v->>'org_b')::uuid,'Q-B','Fixture B','UN','quantidade',true),
    ((v->>'serial_b')::uuid,(v->>'org_b')::uuid,'S-B','Fixture serial B','UN','serial',true),
    ((v->>'mac_b')::uuid,(v->>'org_b')::uuid,'MAC-B','Fixture MAC B','UN','mac',true);
  insert into public.ativos_rastreados(id,organizacao_id,material_id,serial,local_id,estado) values
    ((v->>'ativo_s1')::uuid,(v->>'org_a')::uuid,(v->>'serial_a')::uuid,v->>'s1',(v->>'mini_a')::uuid,'disponivel'),
    ((v->>'ativo_s2')::uuid,(v->>'org_a')::uuid,(v->>'serial_a')::uuid,v->>'s2',(v->>'mini_a')::uuid,'avariado'),
    ((v->>'ativo_sb')::uuid,(v->>'org_b')::uuid,(v->>'serial_b')::uuid,v->>'sb',(v->>'mini_b')::uuid,'disponivel'),
    ((v->>'ativo_reservado')::uuid,(v->>'org_a')::uuid,(v->>'serial_a')::uuid,v->>'reservado',(v->>'mini_a')::uuid,'reservado'),
    ((v->>'ativo_fora')::uuid,(v->>'org_a')::uuid,(v->>'serial_a')::uuid,v->>'fora',(v->>'cd_a')::uuid,'disponivel'),
    ((v->>'ativo_outro_material')::uuid,(v->>'org_a')::uuid,(v->>'q_a')::uuid,v->>'outro_material',(v->>'mini_a')::uuid,'disponivel');
  insert into public.ativos_rastreados(id,organizacao_id,material_id,mac,local_id,estado) values
    ((v->>'ativo_mac')::uuid,(v->>'org_a')::uuid,(v->>'mac_a')::uuid,v->>'mac',(v->>'mini_a')::uuid,'disponivel'),
    ((v->>'ativo_mac_b')::uuid,(v->>'org_b')::uuid,(v->>'mac_b')::uuid,v->>'mac_b_valor',(v->>'mini_b')::uuid,'disponivel'),
    ((v->>'ativo_mac_fora')::uuid,(v->>'org_a')::uuid,(v->>'mac_a')::uuid,v->>'mac_fora',(v->>'cd_a')::uuid,'disponivel');
  insert into public.atel_menu_permissoes(usuario_id,rota,liberado) values
    ((v->>'negado_a')::uuid,'/expedicoes/retornos',false),((v->>'negado_pai_a')::uuid,'/expedicoes',false);
  insert into pg_temp.devolucao_fixture values(v);
  select n.nspname into nome_schema from pg_catalog.pg_namespace as n where n.oid=pg_my_temp_schema();
  execute format('grant usage on schema %I to authenticated',nome_schema);
end $$;
grant select on pg_temp.devolucao_fixture to authenticated;

create function pg_temp.assert_true(p_ok boolean,p_msg text) returns void
language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$ begin
  if p_ok is distinct from true then raise exception using errcode='XX000',message=p_msg; end if;
end $$;
create function pg_temp.login(p_user uuid) returns void
language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$ begin
  perform set_config('request.jwt.claim.sub',coalesce(p_user::text,''),true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated')::text,true);
end $$;
create function pg_temp.assert_erro(p_sql text,p_estado text,p_trecho text default null) returns void
language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare v_estado text; v_mensagem text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_estado=returned_sqlstate,v_mensagem=message_text;
    if v_estado<>p_estado or (p_trecho is not null and position(p_trecho in v_mensagem)=0) then
      raise exception using errcode='XX000',message=format('Esperado %s / %s; recebido %s / %s',p_estado,p_trecho,v_estado,v_mensagem);
    end if;
    return;
  end;
  raise exception using errcode='XX000',message='Operacao deveria falhar: '||p_sql;
end $$;
grant execute on function pg_temp.assert_true(boolean,text),pg_temp.login(uuid),pg_temp.assert_erro(text,text,text) to authenticated;

create function pg_temp.solicitar(p_org uuid,p_origem uuid,p_itens jsonb,p_motivo text default 'Fixture administrativa',p_chave uuid default gen_random_uuid())
returns jsonb language sql security invoker set search_path=pg_catalog,pg_temp as $$
  select public.atel_devolucao_admin_solicitar(p_org,p_origem,p_motivo,p_itens,p_chave)
$$;
create function pg_temp.negativa(p_org uuid,p_origem uuid,p_itens jsonb,p_estado text default 'P0001',p_trecho text default null)
returns void language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$ begin
  perform pg_temp.assert_erro(format('select pg_temp.solicitar(%L,%L,%L::jsonb)',p_org,p_origem,p_itens),p_estado,p_trecho);
end $$;
grant execute on function pg_temp.solicitar(uuid,uuid,jsonb,text,uuid),pg_temp.negativa(uuid,uuid,jsonb,text,text) to authenticated;

-- Somente o executor postgres usa esta fotografia, antes/depois das operacoes.
create function pg_temp.fotografia() returns jsonb
language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare v jsonb; t text; resumo text; resultado jsonb:='{}';
begin
  select f.dados into strict v from pg_temp.devolucao_fixture as f;
  foreach t in array array['saldos_estoque','movimentacoes_estoque','ativos_rastreados','atel_rets_ped_v3730','devolucoes','devolucao_itens'] loop
    execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text,''[]'')) from public.%I as r where r.organizacao_id in (%L::uuid,%L::uuid)',t,v->>'org_a',v->>'org_b') into resumo;
    resultado:=resultado || jsonb_build_object(t,resumo);
  end loop;
  return resultado;
end $$;
revoke all on function pg_temp.fotografia() from public,anon,authenticated;
