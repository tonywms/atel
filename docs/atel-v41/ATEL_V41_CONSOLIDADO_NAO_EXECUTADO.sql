-- ATEL V39: Mini-CD -> CD Principal. Aplicar somente com autorizacao no SQL Editor.
-- A requisicao nasce do aceite; o CD confirma fisicamente e endereca.
BEGIN;

-- V40: adaptar exclusivamente a verificacao do destino na RPC existente.
-- Falha de forma segura caso a versao instalada tenha mudado.
DO $v40$
DECLARE v_def text; v_old text; v_new text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO v_def
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='atel_v35_aceitar'
 AND pg_get_function_identity_arguments(p.oid)='p_organizacao_id uuid, p_transferencia_id uuid, p_quantidade_aceita numeric, p_motivo text';
 IF v_def IS NULL THEN RAISE EXCEPTION 'RPC atel_v35_aceitar nao encontrada; V40 cancelada'; END IF;
 v_old := 'and tipo=''estoque_tecnico'' and ativo';
 v_new := 'and tipo in (''estoque_tecnico'',''ponto_apoio'') and ativo';
 IF (length(v_def)-length(replace(v_def,v_old,''))) <> length(v_old) THEN RAISE EXCEPTION 'Regra do aceite nao e unica; V41 cancelada'; END IF;
 IF strpos(v_def,v_old)=0 THEN RAISE EXCEPTION 'Assinatura ou regra do aceite mudou; V40 cancelada sem aplicar'; END IF;
 v_def := replace(v_def,v_old,v_new);
 EXECUTE v_def;
END $v40$;
DO $validar_cd$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.locais_estoque WHERE id='9e67798f-f40b-4f65-bd91-2454a484c623'::uuid AND organizacao_id='6ea04673-4deb-42cf-a001-dbb027120103'::uuid AND tipo='cd' AND ativo) THEN RAISE EXCEPTION 'CD ATEL inexistente/inativo'; END IF;
END $validar_cd$;
CREATE TABLE IF NOT EXISTS public.atel_devolucoes_cd (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organizacao_id uuid NOT NULL,
 transferencia_id uuid NOT NULL UNIQUE REFERENCES public.transferencias(id),
 origem_id uuid NOT NULL REFERENCES public.locais_estoque(id),
 destino_id uuid NOT NULL REFERENCES public.locais_estoque(id),
 material_id uuid NOT NULL REFERENCES public.materiais(id),
 quantidade_enviada numeric NOT NULL CHECK(quantidade_enviada>0),
 quantidade_aceita numeric NOT NULL CHECK(quantidade_aceita>=0),
 quantidade_devolvida numeric NOT NULL CHECK(quantidade_devolvida>0),
 motivo text NOT NULL,
 status text NOT NULL DEFAULT 'AGUARDANDO_CD' CHECK(status IN ('AGUARDANDO_CD','EM_CONFERENCIA','RECEBIDA','DIVERGENTE')),
 criada_em timestamptz NOT NULL DEFAULT now(), recebida_em timestamptz,
 recebida_por uuid,
 CONSTRAINT atel_dev_qtd CHECK(quantidade_enviada=quantidade_aceita+quantidade_devolvida)
);
CREATE INDEX IF NOT EXISTS atel_dev_org_status ON public.atel_devolucoes_cd(organizacao_id,status,criada_em DESC);
ALTER TABLE public.atel_devolucoes_cd ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.atel_devolucoes_cd FROM PUBLIC,anon,authenticated;
-- Enderecos precisam estar cadastrados e habilitados. Nao presume que 4132 existe.
CREATE TABLE IF NOT EXISTS public.atel_devolucao_enderecos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organizacao_id uuid NOT NULL,
 cd_id uuid NOT NULL REFERENCES public.locais_estoque(id),
 codigo text NOT NULL, deposito text NOT NULL, descricao text NOT NULL,
 ativo boolean NOT NULL DEFAULT true, UNIQUE(organizacao_id,cd_id,codigo)
);
ALTER TABLE public.atel_devolucao_enderecos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.atel_devolucao_enderecos FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS public.atel_devolucao_conferencias (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), devolucao_id uuid NOT NULL UNIQUE REFERENCES public.atel_devolucoes_cd(id),
 organizacao_id uuid NOT NULL, endereco_id uuid NOT NULL REFERENCES public.atel_devolucao_enderecos(id),
 quantidade_recebida numeric NOT NULL CHECK(quantidade_recebida>=0),
 condicao text NOT NULL CHECK(condicao IN ('OK','AVARIA','DIVERGENCIA')),
 motivo text NOT NULL, realizado_por uuid NOT NULL, criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.atel_devolucao_conferencias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.atel_devolucao_conferencias FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.atel_v39_criar_ao_aceitar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i public.transferencia_itens%ROWTYPE; cd uuid; saldo numeric;
BEGIN
 IF NEW.tipo IS DISTINCT FROM 'TRANSFERENCIA_INTERNA' OR NEW.status <> 'recebida_parcial' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
 SELECT * INTO STRICT i FROM public.transferencia_itens WHERE transferencia_id=NEW.id AND organizacao_id=NEW.organizacao_id;
 IF NOT EXISTS(SELECT 1 FROM public.locais_estoque l WHERE l.id=NEW.destino_id AND l.organizacao_id=NEW.organizacao_id AND l.tipo='ponto_apoio' AND l.ativo) THEN RETURN NEW; END IF;
 saldo:=i.quantidade_solicitada-coalesce(i.quantidade_recebida,0);
 IF saldo<=0 THEN RETURN NEW; END IF;
 SELECT id INTO cd FROM public.locais_estoque WHERE id='9e67798f-f40b-4f65-bd91-2454a484c623'::uuid AND organizacao_id=NEW.organizacao_id AND tipo='cd' AND ativo;
 IF cd IS NULL THEN RAISE EXCEPTION 'CD Principal ATEL nao configurado'; END IF;
 INSERT INTO public.atel_devolucoes_cd(organizacao_id,transferencia_id,origem_id,destino_id,material_id,quantidade_enviada,quantidade_aceita,quantidade_devolvida,motivo)
 VALUES(NEW.organizacao_id,NEW.id,NEW.destino_id,cd,i.material_id,i.quantidade_solicitada,coalesce(i.quantidade_recebida,0),saldo,coalesce(nullif(btrim(NEW.motivo_divergencia),''),'DIVERGENCIA'))
 ON CONFLICT(transferencia_id) DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS atel_v38_gerar_devolucao ON public.transferencias;
DROP TRIGGER IF EXISTS atel_v39_gerar_devolucao ON public.transferencias;
CREATE TRIGGER atel_v39_gerar_devolucao AFTER UPDATE OF status ON public.transferencias FOR EACH ROW EXECUTE FUNCTION public.atel_v39_criar_ao_aceitar();
CREATE OR REPLACE FUNCTION public.atel_v39_listar(p_organizacao_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); r jsonb;
BEGIN
 IF u IS NULL OR NOT EXISTS(SELECT 1 FROM public.usuarios_organizacao WHERE organizacao_id=p_organizacao_id AND usuario_id=u AND ativo AND perfil IN ('admin','gestor')) THEN RAISE EXCEPTION 'Acesso exclusivo CD admin/gestor'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'codigo',t.codigo,'origem',o.nome,'destino',cd.nome,'sku',m.sku,'material',m.descricao,'quantidade_enviada',d.quantidade_enviada,'quantidade_aceita',d.quantidade_aceita,'quantidade_devolvida',d.quantidade_devolvida,'motivo',d.motivo,'status',d.status,'criada_em',d.criada_em,'recebida_em',d.recebida_em,'recebida_por',d.recebida_por,'conferencia',CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('quantidade_recebida',c.quantidade_recebida,'condicao',c.condicao,'motivo',c.motivo,'endereco',e.codigo,'deposito',e.deposito) END) ORDER BY d.criada_em DESC),'[]'::jsonb) INTO r
 FROM public.atel_devolucoes_cd d JOIN public.transferencias t ON t.id=d.transferencia_id AND t.organizacao_id=d.organizacao_id
 JOIN public.locais_estoque o ON o.id=d.origem_id AND o.organizacao_id=d.organizacao_id
 JOIN public.locais_estoque cd ON cd.id=d.destino_id AND cd.organizacao_id=d.organizacao_id
 JOIN public.materiais m ON m.id=d.material_id AND m.organizacao_id=d.organizacao_id
 LEFT JOIN public.atel_devolucao_conferencias c ON c.devolucao_id=d.id AND c.organizacao_id=d.organizacao_id
 LEFT JOIN public.atel_devolucao_enderecos e ON e.id=c.endereco_id AND e.organizacao_id=d.organizacao_id
 WHERE d.organizacao_id=p_organizacao_id;
 RETURN r;
END $$;
CREATE OR REPLACE FUNCTION public.atel_v39_enderecos(p_organizacao_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); r jsonb;
BEGIN
 IF u IS NULL OR NOT EXISTS(SELECT 1 FROM public.usuarios_organizacao WHERE organizacao_id=p_organizacao_id AND usuario_id=u AND ativo AND perfil IN ('admin','gestor')) THEN RAISE EXCEPTION 'Acesso exclusivo CD admin/gestor'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'codigo',e.codigo,'deposito',e.deposito,'descricao',e.descricao) ORDER BY e.codigo),'[]'::jsonb) INTO r
 FROM public.atel_devolucao_enderecos e JOIN public.locais_estoque cd ON cd.id=e.cd_id AND cd.organizacao_id=e.organizacao_id AND cd.tipo='cd' AND cd.ativo
 WHERE e.organizacao_id=p_organizacao_id AND e.ativo AND e.cd_id='9e67798f-f40b-4f65-bd91-2454a484c623'::uuid;
 RETURN r;
END $$;
CREATE OR REPLACE FUNCTION public.atel_v39_receber(p_organizacao_id uuid,p_devolucao_id uuid,p_endereco_id uuid,p_quantidade numeric,p_condicao text,p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); d public.atel_devolucoes_cd%ROWTYPE; e public.atel_devolucao_enderecos%ROWTYPE; v_perfil text; novo_status text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Autenticacao obrigatoria'; END IF;
 SELECT perfil INTO v_perfil FROM public.usuarios_organizacao WHERE organizacao_id=p_organizacao_id AND usuario_id=u AND ativo;
 IF v_perfil IS NULL OR v_perfil NOT IN ('admin','gestor') THEN RAISE EXCEPTION 'Recebimento exclusivo de gestor/admin CD ATEL'; END IF;
 SELECT * INTO d FROM public.atel_devolucoes_cd WHERE id=p_devolucao_id AND organizacao_id=p_organizacao_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Requisicao nao encontrada'; END IF;
 IF d.status NOT IN ('AGUARDANDO_CD','EM_CONFERENCIA') THEN RAISE EXCEPTION 'Requisicao ja conferida'; END IF;
 SELECT * INTO e FROM public.atel_devolucao_enderecos WHERE id=p_endereco_id AND organizacao_id=p_organizacao_id AND cd_id=d.destino_id AND ativo;
 IF NOT FOUND OR e.deposito <> 'DEVOLUCAO' THEN RAISE EXCEPTION 'Endereco de devolucao invalido para o CD'; END IF;
 IF p_quantidade IS NULL OR p_quantidade<0 OR p_quantidade>d.quantidade_devolvida THEN RAISE EXCEPTION 'Quantidade conferida invalida'; END IF;
 IF p_condicao IS NULL OR p_condicao NOT IN ('OK','AVARIA','DIVERGENCIA') OR length(btrim(coalesce(p_motivo,'')))<3 OR length(p_motivo)>500 THEN RAISE EXCEPTION 'Condicao ou motivo invalido'; END IF;
 novo_status:=CASE WHEN p_quantidade=d.quantidade_devolvida AND p_condicao='OK' THEN 'RECEBIDA' ELSE 'DIVERGENTE' END;
 INSERT INTO public.atel_devolucao_conferencias(devolucao_id,organizacao_id,endereco_id,quantidade_recebida,condicao,motivo,realizado_por)
 VALUES(d.id,p_organizacao_id,e.id,p_quantidade,p_condicao,btrim(p_motivo));
 -- So material OK e quantidade integral ingressam no saldo disponivel do CD.
 IF novo_status='RECEBIDA' AND p_quantidade>0 THEN
  INSERT INTO public.saldos_estoque(organizacao_id,local_id,material_id,quantidade) VALUES(p_organizacao_id,d.destino_id,d.material_id,p_quantidade)
  ON CONFLICT(organizacao_id,local_id,material_id) DO UPDATE SET quantidade=public.saldos_estoque.quantidade+excluded.quantidade,atualizado_em=now();
  INSERT INTO public.movimentacoes_estoque(organizacao_id,material_id,origem_id,destino_id,tipo,quantidade,referencia_externa,observacao,realizado_por,chave_idempotencia)
  VALUES(p_organizacao_id,d.material_id,d.origem_id,d.destino_id,'transferencia',p_quantidade,d.id::text,'V39: recebimento devolucao CD; endereco '||e.codigo,u,'V39-CD-'||d.id::text);
 END IF;
 UPDATE public.atel_devolucoes_cd SET status=novo_status,recebida_em=now(),recebida_por=u WHERE id=d.id;
 RETURN jsonb_build_object('id',d.id,'status',novo_status,'quantidade_recebida',p_quantidade,'estoque_movimentado',novo_status='RECEBIDA');
END $$;
REVOKE ALL ON FUNCTION public.atel_v39_criar_ao_aceitar() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.atel_v39_listar(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.atel_v39_enderecos(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.atel_v39_receber(uuid,uuid,uuid,numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atel_v39_listar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atel_v39_enderecos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atel_v39_receber(uuid,uuid,uuid,numeric,text,text) TO authenticated;
COMMIT;
