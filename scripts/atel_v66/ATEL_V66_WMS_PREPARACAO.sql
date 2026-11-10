-- ATEL V66 | PostgreSQL WMS | execução manual, somente após preencher fonte oficial
-- Esta rotina NÃO altera estoques, movimentos, vinculos, idproduto existente ou controles operacionais.
-- Execute no banco WMS, NAO no Supabase. Faça backup integral antes da primeira aplicação.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- Identidade e sequencia comprovadas no arquivo ATEL_ESTRUTURA_ERP.csv.
DO $$ BEGIN
 IF to_regclass('public.produto') IS NULL OR to_regclass('public.produto_idproduto_seq') IS NULL THEN
  RAISE EXCEPTION 'Estrutura WMS produto/sequencia ausente'; END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='produto' AND column_name='idproduto' AND column_default LIKE 'nextval(%') THEN
  RAISE EXCEPTION 'idproduto nao usa sequencia; interrompido'; END IF;
END $$;
-- Carregar APENAS dados comprovadamente recebidos do Adapter nesta tabela TEMPORARIA.
-- Colunas de controle opcionais não são sobrescritas por esta rotina.
CREATE TEMP TABLE atel_v66_entrada (
 idempresa integer NOT NULL,
 codigoproduto varchar(30) NOT NULL,
 nome varchar(100) NOT NULL,
 unidadepadrao varchar(100),
 codreferencia varchar(30)
) ON COMMIT DROP;
-- EXEMPLO DE FORMATO, NÃO É UMA ORDEM DE INSERT:
-- INSERT INTO atel_v66_entrada(idempresa,codigoproduto,nome,unidadepadrao)
-- VALUES (1,'38','ONU GPON BRIDGE ZTE F612 V9.2','UN');
-- A integração real deve carregar aqui a resposta autenticada e validada do Adapter.
-- Bloqueio intencional se nenhuma linha for fornecida.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM atel_v66_entrada) THEN
  RAISE EXCEPTION 'V66 BLOQUEADA: nenhuma linha oficial do Adapter foi carregada; nenhum dado alterado'; END IF;
 IF EXISTS (SELECT 1 FROM atel_v66_entrada WHERE idempresa<=0 OR btrim(codigoproduto)='' OR btrim(nome)='') THEN
  RAISE EXCEPTION 'Dados oficiais invalidos'; END IF;
 IF EXISTS (SELECT 1 FROM atel_v66_entrada GROUP BY idempresa,codigoproduto HAVING count(*)>1) THEN
  RAISE EXCEPTION 'Duplicidade na fonte Adapter'; END IF;
 IF EXISTS (SELECT 1 FROM public.produto GROUP BY idempresa,codigoproduto HAVING count(*)>1) THEN
  RAISE EXCEPTION 'Duplicidade no cadastro WMS; requer saneamento previo'; END IF;
 IF EXISTS (SELECT 1 FROM atel_v66_entrada a LEFT JOIN public.empresa e ON e.idempresa=a.idempresa WHERE e.idempresa IS NULL) THEN
  RAISE EXCEPTION 'Empresa inexistente no WMS'; END IF;
END $$;
-- Bloqueio para impedir concorrência com outras rotinas de produto durante o upsert.
LOCK TABLE public.produto IN SHARE ROW EXCLUSIVE MODE;
-- A tabela produto tem sequencia nativa. Mantemos o valor original em UPDATE.
UPDATE public.produto p
 SET nome = a.nome,
     unidadepadrao = COALESCE(a.unidadepadrao,p.unidadepadrao),
     codreferencia = COALESCE(a.codreferencia,p.codreferencia)
FROM atel_v66_entrada a
WHERE p.idempresa=a.idempresa AND p.codigoproduto=a.codigoproduto
AND (p.nome,p.unidadepadrao,p.codreferencia) IS DISTINCT FROM
    (a.nome,COALESCE(a.unidadepadrao,p.unidadepadrao),COALESCE(a.codreferencia,p.codreferencia));
INSERT INTO public.produto(idempresa,codigoproduto,nome,unidadepadrao,codreferencia)
SELECT a.idempresa,a.codigoproduto,a.nome,a.unidadepadrao,a.codreferencia
FROM atel_v66_entrada a
WHERE NOT EXISTS (SELECT 1 FROM public.produto p WHERE p.idempresa=a.idempresa AND p.codigoproduto=a.codigoproduto);
-- Por segurança, a versão entregue permanece em ROLLBACK até validação da fonte oficial.
ROLLBACK;
