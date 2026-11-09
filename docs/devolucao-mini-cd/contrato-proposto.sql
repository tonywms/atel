-- PROPOSTA PARA REVISAO. NAO APLICADA.
-- PostgreSQL 17 / projeto ssunettwxzliiwkwvymg, inspecionado em 2026-11-08.
-- Executar integralmente somente apos aprovacao, como postgres, em homologacao primeiro.
-- Nao e uma migration gerada; falha se o namespace ja existir (sem sobrescrever objetos).
-- Nenhuma operacao fisica, reserva de estoque ou geracao de RET faz parte deste contrato.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local check_function_bodies = on;
set local plpgsql.extra_errors = 'all';
set local plpgsql.variable_conflict = 'error';
do $$ begin
  if current_user <> 'postgres' then
    raise exception 'Aplicar como postgres: o proprietario das funcoes deve ser explicito';
  end if;
end $$;

create schema atel_devolucao_admin authorization postgres;
revoke all on schema atel_devolucao_admin from public, anon, authenticated, service_role;
-- Namespace privado, fora dos schemas expostos no PostgREST. USAGE permite os wrappers.
grant usage on schema atel_devolucao_admin to authenticated;
alter default privileges in schema atel_devolucao_admin revoke execute on functions from public;

create table atel_devolucao_admin.cd_principal (
  organizacao_id uuid primary key references public.organizacoes(id),
  local_id uuid not null,
  definido_em timestamptz not null default now(),
  foreign key (local_id, organizacao_id) references public.locais_estoque(id, organizacao_id)
);

create table atel_devolucao_admin.requisicoes (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id),
  origem_id uuid not null,
  destino_id uuid not null,
  solicitada_por uuid not null references auth.users(id),
  chave_idempotencia uuid not null check (chave_idempotencia <> '00000000-0000-0000-0000-000000000000'),
  motivo text not null check (length(btrim(motivo)) between 3 and 1000),
  entrada_canonica jsonb not null,
  status text not null default 'SOLICITADA' check (status in ('SOLICITADA','APROVADA','REJEITADA')),
  revisao integer not null default 1 check (revisao in (1,2)),
  criada_em timestamptz not null default now(),
  decidida_em timestamptz,
  decidida_por uuid references auth.users(id),
  justificativa text,
  unique (id, organizacao_id),
  unique (organizacao_id, solicitada_por, chave_idempotencia),
  foreign key (origem_id, organizacao_id) references public.locais_estoque(id, organizacao_id),
  foreign key (destino_id, organizacao_id) references public.locais_estoque(id, organizacao_id),
  check (origem_id <> destino_id),
  check ((status='SOLICITADA' and revisao=1 and decidida_em is null and decidida_por is null and justificativa is null)
    or (status in ('APROVADA','REJEITADA') and revisao=2 and decidida_em is not null and decidida_por is not null
      and justificativa is not null and length(btrim(justificativa)) between 3 and 1000))
);
create index requisicoes_org_paginacao on atel_devolucao_admin.requisicoes(organizacao_id, criada_em desc, id desc);
create index requisicoes_org_origem on atel_devolucao_admin.requisicoes(organizacao_id, origem_id, criada_em desc, id desc);
create index requisicoes_destino on atel_devolucao_admin.requisicoes(destino_id, organizacao_id);

create table atel_devolucao_admin.itens (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null,
  requisicao_id uuid not null,
  material_id uuid not null,
  quantidade numeric(18,3) not null check (quantidade > 0 and quantidade <= 100000000),
  sku text not null,
  descricao text not null,
  unidade text not null,
  rastreio text not null check (rastreio in ('quantidade','metragem','serial','mac')),
  seriais text[] not null default '{}',
  macs text[] not null default '{}',
  ativos_ids uuid[] not null default '{}',
  unique (requisicao_id, material_id),
  foreign key (requisicao_id, organizacao_id) references atel_devolucao_admin.requisicoes(id, organizacao_id),
  foreign key (material_id, organizacao_id) references public.materiais(id, organizacao_id),
  check (quantidade::text not in ('NaN','Infinity','-Infinity')),
  check (rastreio='metragem' or quantidade=trunc(quantidade)),
  check ((rastreio='serial' and cardinality(seriais)=quantidade and cardinality(macs)=0 and cardinality(ativos_ids)=quantidade)
    or (rastreio='mac' and cardinality(macs)=quantidade and cardinality(seriais)=0 and cardinality(ativos_ids)=quantidade)
    or (rastreio in ('quantidade','metragem') and cardinality(seriais)=0 and cardinality(macs)=0 and cardinality(ativos_ids)=0))
);
create index itens_material on atel_devolucao_admin.itens(material_id, organizacao_id);

-- Auditoria exclusiva do novo agregado; nenhuma regravacao de auditoria historica.
create table atel_devolucao_admin.eventos (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null,
  requisicao_id uuid not null,
  usuario_id uuid not null references auth.users(id),
  chave_idempotencia uuid not null,
  acao text not null check (acao in ('SOLICITAR','APROVAR','REJEITAR')),
  entrada jsonb not null,
  antes jsonb,
  depois jsonb not null,
  resposta jsonb not null,
  criado_em timestamptz not null default now(),
  unique (organizacao_id, usuario_id, chave_idempotencia),
  foreign key (requisicao_id, organizacao_id) references atel_devolucao_admin.requisicoes(id, organizacao_id)
);
create index eventos_requisicao on atel_devolucao_admin.eventos(requisicao_id, organizacao_id, criado_em);

create function atel_devolucao_admin.impedir_reescrita_evento()
returns trigger language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
begin
  raise exception using errcode='42501',message='Auditoria administrativa e somente de acrescimo';
end $$;
create trigger eventos_somente_acrescimo before update or delete or truncate
on atel_devolucao_admin.eventos for each statement
execute function atel_devolucao_admin.impedir_reescrita_evento();

alter table atel_devolucao_admin.cd_principal enable row level security;
alter table atel_devolucao_admin.requisicoes enable row level security;
alter table atel_devolucao_admin.itens enable row level security;
alter table atel_devolucao_admin.eventos enable row level security;
revoke all on all tables in schema atel_devolucao_admin from public, anon, authenticated, service_role;
-- Sem policies de escrita: clientes nao recebem acesso direto. Somente as funcoes privadas
-- SECURITY DEFINER abaixo podem escrever, com autorizacao explicita e pg_temp por ultimo.

-- Cadastro explicito sujeito a revisao humana, nao inferencia pelo nome no runtime.
-- IDs lidos do banco real: organizacao ATEL e CD Principal ATEL.
insert into atel_devolucao_admin.cd_principal(organizacao_id, local_id)
select o.id, l.id from public.organizacoes o join public.locais_estoque l on l.organizacao_id=o.id
where o.id='6ea04673-4deb-42cf-a001-dbb027120103' and o.ativo
  and l.id='9e67798f-f40b-4f65-bd91-2454a484c623' and l.tipo='cd' and l.ativo;
do $$ begin
  if not exists (select 1 from atel_devolucao_admin.cd_principal) then
    raise exception 'Configuracao explicita do CD Principal nao corresponde mais ao cadastro real';
  end if;
end $$;

create function atel_devolucao_admin.autorizar(p_org uuid, p_acao text, p_origem uuid default null)
returns text language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_perfil text; v_liberado boolean;
begin
  if auth.uid() is null then raise exception using errcode='42501', message='Autenticacao obrigatoria'; end if;
  if p_org is null or p_org='00000000-0000-0000-0000-000000000000' then
    raise exception using errcode='22023', message='Organizacao invalida';
  end if;
  select u.perfil into v_perfil from public.usuarios_organizacao u
    join public.organizacoes o on o.id=u.organizacao_id
    where u.organizacao_id=p_org and u.usuario_id=auth.uid() and u.ativo and o.ativo for share of u,o;
  if not found then raise exception using errcode='42501', message='Sem vinculo ativo com a organizacao'; end if;
  if p_acao not in ('CONSULTAR','SOLICITAR','DECIDIR') or p_acao is null then raise exception 'Operacao invalida'; end if;
  -- O replay apos aguardar o advisory lock precisa de um snapshot novo por comando.
  -- Nao converter um conflito em sucesso aparente sob REPEATABLE READ/SERIALIZABLE.
  if p_acao in ('SOLICITAR','DECIDIR') and current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode='40001',message='Operacao administrativa exige transacao READ COMMITTED';
  end if;
  if (p_acao='DECIDIR' and v_perfil not in ('admin','gestor'))
    or (p_acao='SOLICITAR' and v_perfil not in ('admin','gestor','operador','tecnico'))
    or (p_acao='CONSULTAR' and v_perfil not in ('admin','gestor','operador','tecnico','auditor')) then
    raise exception using errcode='42501', message='Perfil sem permissao para a operacao';
  end if;
  -- Mesmo criterio de prefixo mais especifico da rota atual; ausencia nao concede perfil.
  select p.liberado into v_liberado from public.atel_menu_permissoes p
    where p.usuario_id=auth.uid() and p.rota in ('/expedicoes/retornos','/expedicoes')
    order by length(p.rota) desc limit 1;
  if v_liberado is false then raise exception using errcode='42501', message='Rotina de retornos bloqueada'; end if;
  if v_perfil='tecnico' then
    perform 1 from public.locais_estoque l where l.organizacao_id=p_org and l.tipo='ponto_apoio'
      and l.ativo and l.responsavel_usuario_id=auth.uid() and (p_origem is null or l.id=p_origem) for share;
    if not found then raise exception using errcode='42501', message='Tecnico sem responsabilidade pelo Mini-CD'; end if;
  end if;
  return v_perfil;
end $$;

create function atel_devolucao_admin.destino(p_org uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_destino uuid;
begin
  select c.local_id into v_destino from atel_devolucao_admin.cd_principal c
    join public.locais_estoque l on l.id=c.local_id and l.organizacao_id=c.organizacao_id
    where c.organizacao_id=p_org and l.ativo and l.tipo='cd' for share of c,l;
  if not found then raise exception using errcode='22023', message='CD Principal nao configurado ou inativo'; end if;
  return v_destino;
end $$;

-- Validacao sintatica e normalizacao deterministica ANTES da consulta de idempotencia.
-- Ordem dos itens/seriais nao altera o significado da mesma chave; conteudo diferente falha.
create function atel_devolucao_admin.canonicalizar(p_itens jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare x jsonb; v_id uuid; v_q numeric; v_s text[]; v_m text[]; v_ids uuid[]:='{}'; v_result jsonb:='[]';
  v_seriais_vistos text[]:='{}'; v_macs_vistos text[]:='{}';
begin
  if jsonb_typeof(p_itens) is distinct from 'array' then raise exception 'Itens devem ser um array'; end if;
  if jsonb_array_length(p_itens) not between 1 and 100 or octet_length(p_itens::text)>262144 then raise exception 'Informe de 1 a 100 itens, ate 256 KiB de JSON nao comprimido'; end if;
  for x in select j.item from jsonb_array_elements(p_itens) as j(item) loop
    if jsonb_typeof(x) is distinct from 'object' then raise exception 'Item invalido'; end if;
    if exists(select 1 from jsonb_object_keys(x) as keys(chave) where keys.chave not in ('material_id','quantidade','seriais','macs')) then raise exception 'Campo de item desconhecido'; end if;
    if jsonb_typeof(x->'material_id') is distinct from 'string' or jsonb_typeof(x->'quantidade') is distinct from 'number' then raise exception 'UUID de material e quantidade numerica obrigatorios'; end if;
    v_id:=(x->>'material_id')::uuid; -- UUID malformado: PostgreSQL retorna 22P02.
    v_q:=(x->>'quantidade')::numeric;
    if v_id='00000000-0000-0000-0000-000000000000' or v_id=any(v_ids) then raise exception 'Material nulo ou repetido'; end if;
    if v_q::text in ('NaN','Infinity','-Infinity') or v_q<=0 or v_q>100000000 or v_q<>round(v_q,3) then raise exception 'Quantidade fora do intervalo ou com mais de tres decimais'; end if;
    if (x ? 'seriais' and jsonb_typeof(x->'seriais') is distinct from 'array')
      or (x ? 'macs' and jsonb_typeof(x->'macs') is distinct from 'array') then raise exception 'Seriais/MACs devem ser arrays'; end if;
    if jsonb_array_length(coalesce(x->'seriais','[]'))>1000 or jsonb_array_length(coalesce(x->'macs','[]'))>1000 then raise exception 'Limite de 1000 rastreios por item'; end if;
    if exists(select 1 from jsonb_array_elements(coalesce(x->'seriais','[]')) as j(valor) where jsonb_typeof(j.valor) is distinct from 'string')
      or exists(select 1 from jsonb_array_elements(coalesce(x->'macs','[]')) as j(valor) where jsonb_typeof(j.valor) is distinct from 'string') then raise exception 'Rastreios devem ser textos'; end if;
    select coalesce(array_agg(upper(btrim(j.valor)) order by upper(btrim(j.valor)) collate "C"),'{}'::text[]) into v_s from jsonb_array_elements_text(coalesce(x->'seriais','[]')) as j(valor);
    select coalesce(array_agg(upper(regexp_replace(btrim(j.valor),'[:.\-]','','g')) order by upper(regexp_replace(btrim(j.valor),'[:.\-]','','g')) collate "C"),'{}'::text[]) into v_m from jsonb_array_elements_text(coalesce(x->'macs','[]')) as j(valor);
    if exists(select 1 from unnest(v_s) as u(valor) where length(u.valor) not between 1 and 120)
      or exists(select 1 from unnest(v_m) as u(valor) where u.valor !~ '^[0-9A-F]{12}$')
      or cardinality(v_s)<>(select count(distinct u.valor) from unnest(v_s) as u(valor))
      or cardinality(v_m)<>(select count(distinct u.valor) from unnest(v_m) as u(valor)) then raise exception 'Serial/MAC vazio, invalido ou duplicado'; end if;
    if v_s && v_seriais_vistos or v_m && v_macs_vistos then raise exception 'Serial/MAC repetido entre materiais'; end if;
    v_seriais_vistos:=v_seriais_vistos || v_s;
    v_macs_vistos:=v_macs_vistos || v_m;
    v_ids:=array_append(v_ids,v_id);
    v_result:=v_result || jsonb_build_array(jsonb_build_object('material_id',v_id,'quantidade',v_q,'seriais',v_s,'macs',v_m));
  end loop;
  select jsonb_agg(j.item order by j.item->>'material_id') into v_result from jsonb_array_elements(v_result) as j(item);
  return v_result;
end $$;

-- Consulta custodia, mas nao reserva nem altera ativos/saldos. Revalidada ao aprovar.
create function atel_devolucao_admin.validar_itens(p_org uuid, p_origem uuid, p_itens jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp set lock_timeout='5s' as $$
declare x jsonb; m public.materiais%rowtype; a public.ativos_rastreados%rowtype;
  v_s text[]; v_m text[]; v_ativos uuid[]; v_todos uuid[]:='{}'; v_result jsonb:='[]'; v_ident text; v_contagem integer;
begin
  for x in select j.item from jsonb_array_elements(p_itens) as j(item) loop
    select mat.* into m from public.materiais as mat where mat.id=(x->>'material_id')::uuid and mat.organizacao_id=p_org and mat.ativo for share of mat;
    if not found then raise exception 'Material inexistente, inativo ou de outra organizacao'; end if;
    if m.rastreio<>'metragem' and (x->>'quantidade')::numeric<>trunc((x->>'quantidade')::numeric) then raise exception 'Material exige quantidade inteira'; end if;
    select coalesce(array_agg(j.valor order by j.valor collate "C"),'{}'::text[]) into v_s from jsonb_array_elements_text(x->'seriais') as j(valor);
    select coalesce(array_agg(j.valor order by j.valor collate "C"),'{}'::text[]) into v_m from jsonb_array_elements_text(x->'macs') as j(valor);
    if (m.rastreio='serial' and (cardinality(v_s)<>(x->>'quantidade')::numeric or cardinality(v_m)<>0))
      or (m.rastreio='mac' and (cardinality(v_m)<>(x->>'quantidade')::numeric or cardinality(v_s)<>0))
      or (m.rastreio in ('quantidade','metragem') and (cardinality(v_s)<>0 or cardinality(v_m)<>0)) then raise exception 'Rastreios nao correspondem ao material e a quantidade'; end if;
    v_ativos:='{}';
    foreach v_ident in array (case when m.rastreio='serial' then v_s else v_m end) loop
      v_contagem:=0;
      for a in select ar.* from public.ativos_rastreados as ar where ar.organizacao_id=p_org
        and (case when m.rastreio='serial' then upper(btrim(ar.serial)) else upper(regexp_replace(btrim(ar.mac),'[:.\-]','','g')) end)=v_ident
        order by ar.id for share of ar loop
        v_contagem:=v_contagem+1;
        if a.material_id is distinct from m.id or a.local_id is distinct from p_origem or a.estado not in ('disponivel','avariado','devolvido') then raise exception 'Ativo nao esta sob custodia elegivel do Mini-CD'; end if;
        if a.id=any(v_todos) then raise exception 'Ativo repetido na requisicao'; end if;
        v_ativos:=array_append(v_ativos,a.id);
        v_todos:=array_append(v_todos,a.id);
      end loop;
      if v_contagem<>1 then raise exception 'Rastreio inexistente ou ambiguo no cadastro'; end if;
    end loop;
    v_result:=v_result || jsonb_build_array(x || jsonb_build_object('sku',m.sku,'descricao',m.descricao,'unidade',m.unidade,'rastreio',m.rastreio,'ativos_ids',v_ativos));
  end loop;
  return v_result;
end $$;

create function atel_devolucao_admin.consultar_cd(p_org uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp set lock_timeout='5s' as $$
declare v_id uuid; v_nome text;
begin
  perform atel_devolucao_admin.autorizar(p_org,'CONSULTAR');
  v_id:=atel_devolucao_admin.destino(p_org);
  select nome into v_nome from public.locais_estoque where id=v_id and organizacao_id=p_org;
  return jsonb_build_object('contrato_versao',1,'organizacao_id',p_org,'local_id',v_id,'nome',v_nome);
end $$;

create function atel_devolucao_admin.solicitar(p_org uuid,p_origem uuid,p_motivo text,p_itens jsonb,p_chave uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp set lock_timeout='5s' as $$
declare v_itens jsonb; v_entrada jsonb; v_validados jsonb; v_destino uuid; v_id uuid; v_resposta jsonb;
  v_repetida atel_devolucao_admin.eventos%rowtype; v_requisicao atel_devolucao_admin.requisicoes%rowtype; x jsonb;
begin
  perform atel_devolucao_admin.autorizar(p_org,'SOLICITAR',p_origem);
  if p_origem is null or p_origem='00000000-0000-0000-0000-000000000000' or p_chave is null or p_chave='00000000-0000-0000-0000-000000000000'
    or p_motivo is null or length(btrim(p_motivo)) not between 3 and 1000 then raise exception using errcode='22023',message='Origem, chave ou motivo invalido'; end if;
  v_itens:=atel_devolucao_admin.canonicalizar(p_itens);
  v_entrada:=jsonb_build_object('origem_id',p_origem,'motivo',btrim(p_motivo),'itens',v_itens);
  perform pg_advisory_xact_lock(hashtextextended('devolucao-admin|'||p_org::text||'|'||auth.uid()::text||'|'||p_chave::text,0));
  select ev.* into v_repetida from atel_devolucao_admin.eventos as ev where ev.organizacao_id=p_org and ev.usuario_id=auth.uid() and ev.chave_idempotencia=p_chave;
  if found then
    if v_repetida.acao<>'SOLICITAR' or v_repetida.entrada<>v_entrada then raise exception using errcode='22023',message='Chave reutilizada com conteudo diferente'; end if;
    return v_repetida.resposta || jsonb_build_object('repetida',true);
  end if;
  perform 1 from public.locais_estoque where id=p_origem and organizacao_id=p_org and tipo='ponto_apoio' and ativo for share;
  if not found then raise exception 'Origem deve ser um Mini-CD ativo da organizacao'; end if;
  v_destino:=atel_devolucao_admin.destino(p_org);
  v_validados:=atel_devolucao_admin.validar_itens(p_org,p_origem,v_itens);
  insert into atel_devolucao_admin.requisicoes(organizacao_id,origem_id,destino_id,solicitada_por,chave_idempotencia,motivo,entrada_canonica)
    values(p_org,p_origem,v_destino,auth.uid(),p_chave,btrim(p_motivo),v_entrada) returning * into v_requisicao;
  v_id:=v_requisicao.id;
  for x in select j.item from jsonb_array_elements(v_validados) as j(item) loop
    insert into atel_devolucao_admin.itens(organizacao_id,requisicao_id,material_id,quantidade,sku,descricao,unidade,rastreio,seriais,macs,ativos_ids)
    values(p_org,v_id,(x->>'material_id')::uuid,(x->>'quantidade')::numeric,x->>'sku',x->>'descricao',x->>'unidade',x->>'rastreio',
      array(select j.valor from jsonb_array_elements_text(x->'seriais') as j(valor)),array(select j.valor from jsonb_array_elements_text(x->'macs') as j(valor)),
      array(select j.valor::uuid from jsonb_array_elements_text(x->'ativos_ids') as j(valor)));
  end loop;
  v_resposta:=jsonb_build_object('contrato_versao',1,'requisicao_id',v_id,'organizacao_id',p_org,'destino_id',v_destino,
    'status','SOLICITADA','revisao',1,'repetida',false,'estoque_movimentado',false,'ret_gerado',false);
  insert into atel_devolucao_admin.eventos(organizacao_id,requisicao_id,usuario_id,chave_idempotencia,acao,entrada,depois,resposta)
    values(p_org,v_id,auth.uid(),p_chave,'SOLICITAR',v_entrada,jsonb_build_object('requisicao',to_jsonb(v_requisicao),
      'itens',(select jsonb_agg(to_jsonb(i) order by i.material_id) from atel_devolucao_admin.itens as i where i.requisicao_id=v_id and i.organizacao_id=p_org)),v_resposta);
  return v_resposta;
end $$;

create function atel_devolucao_admin.decidir(p_org uuid,p_id uuid,p_revisao integer,p_justificativa text,p_chave uuid,p_status text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp set lock_timeout='5s' as $$
declare r atel_devolucao_admin.requisicoes%rowtype; e atel_devolucao_admin.eventos%rowtype;
  v_entrada jsonb; v_resposta jsonb; v_acao text; v_itens jsonb; x jsonb; v_ativos uuid[]; v_anteriores uuid[]; v_antes jsonb;
begin
  perform atel_devolucao_admin.autorizar(p_org,'DECIDIR');
  if p_id is null or p_id='00000000-0000-0000-0000-000000000000' or p_chave is null or p_chave='00000000-0000-0000-0000-000000000000'
    or p_revisao is null or p_revisao<1 or p_justificativa is null or length(btrim(p_justificativa)) not between 3 and 1000
    or p_status is null or p_status not in ('APROVADA','REJEITADA') then raise exception using errcode='22023',message='Parametros de decisao invalidos'; end if;
  v_acao:=case when p_status='APROVADA' then 'APROVAR' else 'REJEITAR' end;
  v_entrada:=jsonb_build_object('requisicao_id',p_id,'revisao',p_revisao,'justificativa',btrim(p_justificativa),'status',p_status);
  perform pg_advisory_xact_lock(hashtextextended('devolucao-admin|'||p_org::text||'|'||auth.uid()::text||'|'||p_chave::text,0));
  select ev.* into e from atel_devolucao_admin.eventos as ev where ev.organizacao_id=p_org and ev.usuario_id=auth.uid() and ev.chave_idempotencia=p_chave;
  if found then
    if e.acao<>v_acao or e.entrada<>v_entrada then raise exception using errcode='22023',message='Chave reutilizada com conteudo diferente'; end if;
    return e.resposta || jsonb_build_object('repetida',true);
  end if;
  select req.* into r from atel_devolucao_admin.requisicoes as req where req.id=p_id and req.organizacao_id=p_org for update of req;
  if not found then raise exception using errcode='22023',message='Requisicao nao encontrada nesta organizacao'; end if;
  if r.status<>'SOLICITADA' or r.revisao<>p_revisao then raise exception using errcode='40001',message='Requisicao ja decidida ou revisao desatualizada'; end if;
  if p_status='APROVADA' then
    perform 1 from public.locais_estoque where id=r.origem_id and organizacao_id=p_org and tipo='ponto_apoio' and ativo for share;
    if not found then raise exception 'Mini-CD de origem inativo ou invalido'; end if;
    if r.destino_id<>atel_devolucao_admin.destino(p_org) then raise exception 'CD Principal mudou; rejeite e solicite novamente, sem reescrever o destino'; end if;
    v_itens:=atel_devolucao_admin.validar_itens(p_org,r.origem_id,r.entrada_canonica->'itens');
    for x in select j.item from jsonb_array_elements(v_itens) as j(item) loop
      if exists(select 1 from atel_devolucao_admin.itens i where i.requisicao_id=r.id and i.material_id=(x->>'material_id')::uuid
        and (i.rastreio is distinct from (x->>'rastreio') or i.unidade is distinct from (x->>'unidade'))) then raise exception 'Unidade ou rastreio do material mudou desde a solicitacao'; end if;
      select coalesce(array_agg(j.valor::uuid order by j.valor::uuid),'{}'::uuid[]) into v_ativos from jsonb_array_elements_text(x->'ativos_ids') as j(valor);
      select coalesce(array_agg(u.ativo_id order by u.ativo_id),'{}'::uuid[]) into v_anteriores from atel_devolucao_admin.itens as i
        cross join lateral unnest(i.ativos_ids) as u(ativo_id) where i.requisicao_id=r.id and i.organizacao_id=p_org and i.material_id=(x->>'material_id')::uuid;
      if v_ativos is distinct from v_anteriores then raise exception 'Identidade dos ativos mudou desde a solicitacao'; end if;
    end loop;
  end if;
  v_antes:=to_jsonb(r);
  update atel_devolucao_admin.requisicoes as req set status=p_status,revisao=2,decidida_por=auth.uid(),decidida_em=now(),justificativa=btrim(p_justificativa)
    where req.id=r.id and req.organizacao_id=p_org returning req.* into r;
  v_resposta:=jsonb_build_object('contrato_versao',1,'requisicao_id',r.id,'organizacao_id',p_org,'destino_id',r.destino_id,
    'status',p_status,'revisao',2,'repetida',false,'estoque_movimentado',false,'ret_gerado',false);
  insert into atel_devolucao_admin.eventos(organizacao_id,requisicao_id,usuario_id,chave_idempotencia,acao,entrada,antes,depois,resposta)
    values(p_org,r.id,auth.uid(),p_chave,v_acao,v_entrada,v_antes,to_jsonb(r),v_resposta);
  return v_resposta;
end $$;

create function atel_devolucao_admin.listar(p_org uuid,p_status text default null,p_limite integer default 50,p_antes_em timestamptz default null,p_antes_id uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp set lock_timeout='5s' as $$
declare v_perfil text; v_rows jsonb;
begin
  v_perfil:=atel_devolucao_admin.autorizar(p_org,'CONSULTAR');
  if p_limite is null or p_limite not between 1 and 100 or (p_status is not null and p_status not in ('SOLICITADA','APROVADA','REJEITADA'))
    or ((p_antes_em is null)<>(p_antes_id is null))
    or p_antes_id='00000000-0000-0000-0000-000000000000' or p_antes_em::text in ('infinity','-infinity') then raise exception using errcode='22023',message='Filtro ou paginacao invalida'; end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.criada_em desc,q.id desc),'[]') into v_rows from (
    select r.id,r.organizacao_id,r.origem_id,r.destino_id,r.solicitada_por,r.motivo,r.status,r.revisao,r.criada_em,r.decidida_em,r.decidida_por,r.justificativa,
      (select coalesce(jsonb_agg(to_jsonb(i) order by i.material_id),'[]') from atel_devolucao_admin.itens i where i.requisicao_id=r.id and i.organizacao_id=p_org) as itens
    from atel_devolucao_admin.requisicoes r where r.organizacao_id=p_org and (p_status is null or r.status=p_status)
      and (p_antes_em is null or (r.criada_em,r.id)<(p_antes_em,p_antes_id))
      and (v_perfil<>'tecnico' or exists(select 1 from public.locais_estoque l where l.id=r.origem_id and l.organizacao_id=p_org
        and l.ativo and l.tipo='ponto_apoio' and l.responsavel_usuario_id=auth.uid()))
    order by r.criada_em desc,r.id desc limit p_limite
  ) q;
  return jsonb_build_object('contrato_versao',1,'requisicoes',v_rows,'proximo_cursor',
    case when jsonb_array_length(v_rows)=p_limite then jsonb_build_object('criada_em',v_rows->-1->'criada_em','id',v_rows->-1->'id') else null end);
end $$;

-- Apenas cinco operacoes expostas. Wrappers nao possuem privilegio elevado.
create function public.atel_devolucao_admin_consultar_cd_principal(p_organizacao_id uuid)
returns jsonb language sql security invoker set search_path=pg_catalog,pg_temp as $$ select atel_devolucao_admin.consultar_cd(p_organizacao_id) $$;
create function public.atel_devolucao_admin_solicitar(p_organizacao_id uuid,p_origem_id uuid,p_motivo text,p_itens jsonb,p_chave_idempotencia uuid)
returns jsonb language sql security invoker set search_path=pg_catalog,pg_temp as $$ select atel_devolucao_admin.solicitar(p_organizacao_id,p_origem_id,p_motivo,p_itens,p_chave_idempotencia) $$;
create function public.atel_devolucao_admin_listar(p_organizacao_id uuid,p_status text default null,p_limite integer default 50,p_antes_em timestamptz default null,p_antes_id uuid default null)
returns jsonb language sql security invoker set search_path=pg_catalog,pg_temp as $$ select atel_devolucao_admin.listar(p_organizacao_id,p_status,p_limite,p_antes_em,p_antes_id) $$;
create function public.atel_devolucao_admin_aprovar(p_organizacao_id uuid,p_requisicao_id uuid,p_revisao integer,p_justificativa text,p_chave_idempotencia uuid)
returns jsonb language sql security invoker set search_path=pg_catalog,pg_temp as $$ select atel_devolucao_admin.decidir(p_organizacao_id,p_requisicao_id,p_revisao,p_justificativa,p_chave_idempotencia,'APROVADA') $$;
create function public.atel_devolucao_admin_rejeitar(p_organizacao_id uuid,p_requisicao_id uuid,p_revisao integer,p_justificativa text,p_chave_idempotencia uuid)
returns jsonb language sql security invoker set search_path=pg_catalog,pg_temp as $$ select atel_devolucao_admin.decidir(p_organizacao_id,p_requisicao_id,p_revisao,p_justificativa,p_chave_idempotencia,'REJEITADA') $$;

-- Fechar os grants implicitos de funcoes em public, inclusive defaults do provedor.
revoke all on function public.atel_devolucao_admin_consultar_cd_principal(uuid),
  public.atel_devolucao_admin_solicitar(uuid,uuid,text,jsonb,uuid),
  public.atel_devolucao_admin_listar(uuid,text,integer,timestamptz,uuid),
  public.atel_devolucao_admin_aprovar(uuid,uuid,integer,text,uuid),
  public.atel_devolucao_admin_rejeitar(uuid,uuid,integer,text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.atel_devolucao_admin_consultar_cd_principal(uuid),
  public.atel_devolucao_admin_solicitar(uuid,uuid,text,jsonb,uuid),
  public.atel_devolucao_admin_listar(uuid,text,integer,timestamptz,uuid),
  public.atel_devolucao_admin_aprovar(uuid,uuid,integer,text,uuid),
  public.atel_devolucao_admin_rejeitar(uuid,uuid,integer,text,uuid) to authenticated;
revoke all on all functions in schema atel_devolucao_admin from public, anon, authenticated, service_role;
grant execute on function atel_devolucao_admin.consultar_cd(uuid),
  atel_devolucao_admin.solicitar(uuid,uuid,text,jsonb,uuid),
  atel_devolucao_admin.listar(uuid,text,integer,timestamptz,uuid),
  atel_devolucao_admin.decidir(uuid,uuid,integer,text,uuid,text) to authenticated;

notify pgrst, 'reload schema';
commit;
