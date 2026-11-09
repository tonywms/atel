-- NAO EXECUTADO. Verificacao SOMENTE LEITURA, apos instalar o contrato revisado
-- em homologacao autorizada. Nao instala funcoes nem substitui testes de execucao.
-- Valida corpos PL/pgSQL e wrappers SQL existentes, ownership, ACL e RLS.
begin read only;
set local check_function_bodies=on;
set local plpgsql.extra_errors='all';
set local plpgsql.variable_conflict='error';

do $$
declare f record; t record; v_entrada boolean; v_total integer:=0;
begin
  if current_user<>'postgres' then raise exception 'Validacao exige postgres'; end if;
  for f in select p.oid,p.proname,p.prosecdef,p.proowner,p.proconfig,n.nspname,l.lanname
    from pg_catalog.pg_proc as p join pg_catalog.pg_namespace as n on n.oid=p.pronamespace
    join pg_catalog.pg_language as l on l.oid=p.prolang
    where n.nspname='atel_devolucao_admin' or (n.nspname='public' and p.proname in (
      'atel_devolucao_admin_consultar_cd_principal','atel_devolucao_admin_solicitar','atel_devolucao_admin_listar',
      'atel_devolucao_admin_aprovar','atel_devolucao_admin_rejeitar')) loop
    v_total:=v_total+1;
    if f.proowner<>'postgres'::regrole or not exists(select 1 from unnest(f.proconfig) as cfg(valor) where cfg.valor ~ '^search_path=pg_catalog, ?pg_temp$') then
      raise exception 'Owner/search_path incorreto: %.%',f.nspname,f.proname;
    end if;
    if f.nspname='public' and (f.prosecdef or f.lanname<>'sql') then raise exception 'Wrapper deve ser SQL INVOKER: %',f.proname; end if;
    if f.nspname='atel_devolucao_admin' and f.prosecdef is distinct from (f.proname not in ('canonicalizar','impedir_reescrita_evento')) then
      raise exception 'Modo de seguranca inesperado: %',f.proname;
    end if;
    v_entrada:=f.nspname='public' or f.proname in ('consultar_cd','solicitar','listar','decidir');
    if f.nspname='atel_devolucao_admin' and v_entrada and not ('lock_timeout=5s'=any(f.proconfig)) then
      raise exception 'Timeout de lock ausente no ponto de entrada: %',f.proname;
    end if;
    if has_function_privilege('authenticated',f.oid,'EXECUTE') is distinct from v_entrada
      or has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('service_role',f.oid,'EXECUTE') then
      raise exception 'ACL inesperada: %.%',f.nspname,f.proname;
    end if;
    if f.lanname='plpgsql' then perform pg_catalog.plpgsql_validator(f.oid);
    elsif f.lanname='sql' then perform pg_catalog.fmgr_sql_validator(f.oid);
    else raise exception 'Linguagem inesperada'; end if;
  end loop;
  if v_total<>14 then raise exception 'Esperadas 9 funcoes privadas e 5 wrappers, encontradas %',v_total; end if;
  v_total:=0;
  for t in select c.oid,c.relname,c.relrowsecurity,c.relowner from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid=c.relnamespace where n.nspname='atel_devolucao_admin' and c.relkind='r' loop
    v_total:=v_total+1;
    if not t.relrowsecurity or t.relowner<>'postgres'::regrole
      or has_table_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
      or has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
      or has_table_privilege('service_role',t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
      or exists(select 1 from pg_catalog.pg_policy as p where p.polrelid=t.oid) then
      raise exception 'RLS/owner/ACL de tabela inesperado: %',t.relname;
    end if;
  end loop;
  if v_total<>4 then raise exception 'Esperadas quatro tabelas privadas'; end if;
  if has_schema_privilege('authenticated','atel_devolucao_admin','CREATE') then raise exception 'Cliente nao pode criar objetos privados'; end if;
  if not exists(select 1 from pg_catalog.pg_trigger as tr where tr.tgrelid='atel_devolucao_admin.eventos'::regclass
    and tr.tgname='eventos_somente_acrescimo' and tr.tgenabled='O' and not tr.tgisinternal) then
    raise exception 'Protecao de auditoria ausente';
  end if;
end $$;
select 'Validadores e ACL/RLS verificados; executar tambem todos os ramos dos testes de homologacao' as resultado;
rollback;
