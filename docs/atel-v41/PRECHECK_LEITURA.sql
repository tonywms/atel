-- Somente SELECT: executar no SQL Editor para verificar compatibilidade antes da migracao.
SELECT current_database() AS banco, to_regprocedure('public.atel_v35_aceitar(uuid,uuid,numeric,text)') AS rpc_aceite,
 to_regclass('public.atel_devolucoes_cd') AS tabela_devolucoes,
 to_regclass('public.atel_devolucao_enderecos') AS tabela_enderecos;
SELECT id,nome,tipo,ativo FROM public.locais_estoque
 WHERE organizacao_id='6ea04673-4deb-42cf-a001-dbb027120103'::uuid ORDER BY nome;
SELECT pg_get_functiondef('public.atel_v35_aceitar(uuid,uuid,numeric,text)'::regprocedure) AS definicao_aceite;
