-- Somente leitura. Executar opcionalmente no SQL Editor.
SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS assinatura,
 strpos(pg_get_functiondef(p.oid), 'and tipo=''estoque_tecnico'' and ativo') > 0 AS regra_v35_esperada
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='atel_v35_aceitar';
SELECT conname,pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid='public.transferencias'::regclass AND contype='u';
SELECT t.id,t.codigo,count(i.id) AS itens FROM public.transferencias t
JOIN public.transferencia_itens i ON i.transferencia_id=t.id AND i.organizacao_id=t.organizacao_id
WHERE t.tipo='TRANSFERENCIA_INTERNA' AND t.status='em_transito'
GROUP BY t.id,t.codigo HAVING count(i.id)>1 LIMIT 20;
