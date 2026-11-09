-- ATEL V38: registro automatico de devolucao quando aceite parcial/recusa for confirmado.
-- EXECUCAO SOMENTE APOS AUTORIZACAO. Nao altera estoque nem RET.
begin;
create table if not exists public.atel_devolucoes_cd (
 id uuid primary key default gen_random_uuid(),
 organizacao_id uuid not null,
 transferencia_id uuid not null unique references public.transferencias(id),
 origem_id uuid not null references public.locais_estoque(id),
 destino_id uuid not null references public.locais_estoque(id),
 material_id uuid not null references public.materiais(id),
 quantidade_enviada numeric not null check(quantidade_enviada>0),
 quantidade_aceita numeric not null check(quantidade_aceita>=0),
 quantidade_devolvida numeric not null check(quantidade_devolvida>0),
 motivo text not null,
 status text not null default 'AGUARDANDO_CD' check(status in ('AGUARDANDO_CD','EM_CONFERENCIA','RECEBIDA','DIVERGENTE')),
 criada_em timestamptz not null default now(),
 recebida_em timestamptz,
 recebida_por uuid,
 constraint atel_devolucoes_quantidade check(quantidade_enviada=quantidade_aceita+quantidade_devolvida)
);
create index if not exists atel_devolucoes_cd_org_status_idx on public.atel_devolucoes_cd(organizacao_id,status,criada_em desc);
alter table public.atel_devolucoes_cd enable row level security;
revoke all on public.atel_devolucoes_cd from anon,authenticated;
create or replace function public.atel_v38_gerar_devolucao_aceite() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_i public.transferencia_itens%rowtype; v_cd uuid; v_rec numeric;
begin
 if new.tipo is distinct from 'TRANSFERENCIA_INTERNA' or new.status not in ('recebida_parcial') or old.status is not distinct from new.status then return new; end if;
 select * into v_i from public.transferencia_itens where transferencia_id=new.id and organizacao_id=new.organizacao_id;
 if not found then raise exception 'Item da transferencia ausente'; end if;
 v_rec:=v_i.quantidade_solicitada-coalesce(v_i.quantidade_recebida,0);
 if v_rec<=0 then return new; end if;
 select id into v_cd from public.locais_estoque where organizacao_id=new.organizacao_id and tipo='cd' and ativo and id='9e67798f-f40b-4f65-bd91-2454a484c623'::uuid;
 if v_cd is null then raise exception 'CD Principal ATEL nao cadastrado/ativo'; end if;
 insert into public.atel_devolucoes_cd(organizacao_id,transferencia_id,origem_id,destino_id,material_id,quantidade_enviada,quantidade_aceita,quantidade_devolvida,motivo)
 values(new.organizacao_id,new.id,new.destino_id,v_cd,v_i.material_id,v_i.quantidade_solicitada,coalesce(v_i.quantidade_recebida,0),v_rec,coalesce(nullif(pg_catalog.btrim(new.motivo_divergencia),''),'NAO INFORMADO'))
 on conflict(transferencia_id) do nothing;
 return new;
end $$;
drop trigger if exists atel_v38_gerar_devolucao on public.transferencias;
create trigger atel_v38_gerar_devolucao after update of status on public.transferencias for each row execute function public.atel_v38_gerar_devolucao_aceite();
create or replace function public.atel_v38_listar_devolucoes(p_organizacao_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_result jsonb;
begin
 if v_user is null or not exists(select 1 from public.usuarios_organizacao where organizacao_id=p_organizacao_id and usuario_id=v_user and ativo) then raise exception 'Acesso nao autorizado'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'transferencia_id',d.transferencia_id,'codigo',t.codigo,'origem',o.nome,'destino',l.nome,'sku',m.sku,'material',m.descricao,'quantidade_devolvida',d.quantidade_devolvida,'motivo',d.motivo,'status',d.status,'criada_em',d.criada_em) order by d.criada_em desc),'[]'::jsonb) into v_result
 from public.atel_devolucoes_cd d join public.transferencias t on t.id=d.transferencia_id and t.organizacao_id=d.organizacao_id
 join public.locais_estoque o on o.id=d.origem_id and o.organizacao_id=d.organizacao_id
 join public.locais_estoque l on l.id=d.destino_id and l.organizacao_id=d.organizacao_id
 join public.materiais m on m.id=d.material_id and m.organizacao_id=d.organizacao_id
 where d.organizacao_id=p_organizacao_id;
 return v_result;
end $$;
revoke all on function public.atel_v38_listar_devolucoes(uuid) from public,anon;
grant execute on function public.atel_v38_listar_devolucoes(uuid) to authenticated;
commit;
