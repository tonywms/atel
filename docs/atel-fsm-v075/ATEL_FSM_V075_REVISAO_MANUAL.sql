-- ATEL FSM V07.5: estrutura inicial isolada por usuario autenticado.
-- NAO executar antes de configurar autenticacao e revisar a estrategia multiempresa.
begin;
create table if not exists public.atel_fsm_ordens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  codigo text not null,
  documento jsonb not null,
  revisao bigint not null default 1 check (revisao > 0),
  atualizado_em timestamptz not null default now(),
  unique (owner_id, codigo)
);
create table if not exists public.atel_fsm_eventos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  ordem_codigo text not null,
  evento_id text not null,
  documento jsonb not null,
  criado_em timestamptz not null default now(),
  unique (owner_id, ordem_codigo, evento_id),
  foreign key (owner_id, ordem_codigo)
    references public.atel_fsm_ordens(owner_id, codigo) on delete cascade
);
alter table public.atel_fsm_ordens enable row level security;
alter table public.atel_fsm_eventos enable row level security;
revoke all on public.atel_fsm_ordens from anon;
revoke all on public.atel_fsm_eventos from anon;
grant select, insert, update, delete on public.atel_fsm_ordens to authenticated;
grant select, insert, update, delete on public.atel_fsm_eventos to authenticated;
drop policy if exists atel_fsm_ordens_owner on public.atel_fsm_ordens;
create policy atel_fsm_ordens_owner on public.atel_fsm_ordens
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
drop policy if exists atel_fsm_eventos_owner on public.atel_fsm_eventos;
create policy atel_fsm_eventos_owner on public.atel_fsm_eventos
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
commit;
