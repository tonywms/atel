"use client";

import styles from "./atel-separacao-progresso-v157.module.css";

type Linha = {
  id: number;
  codigo: string;
  descricao: string;
  solicitado: number;
  separado: number;
  unidade: string;
};

type Props = {
  linhas: Linha[];
  itemAtualId: number;
  onIrPendente: (indice: number) => void;
};

function quantidadeValida(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function AtelSeparacaoProgressoV157({ linhas }: Props) {
  const total = linhas.length;
  const concluidas = linhas.filter((linha) => quantidadeValida(linha.separado) >= quantidadeValida(linha.solicitado)).length;
  const pendentes = Math.max(total - concluidas, 0);
  const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;


  return (
    <section className={styles.painel} aria-label="Progresso da separação">
      <div className={styles.topo}>
        <div className={styles.tituloArea}>
          <span className={styles.icone} aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19V11M10 19V5M16 19v-8M22 19V8" /><path d="M2 21h20" />
            </svg>
          </span>
          <div>
            <span className={styles.legenda}>EXECUÇÃO DO PEDIDO</span>
            <strong className={styles.titulo}>Progresso da separação</strong>
          </div>
        </div>
        <span className={pendentes === 0 ? styles.situacaoOk : styles.situacao}>
          {pendentes === 0 ? "Tudo separado" : "Em execução"}
        </span>
      </div>

      <div className={styles.numeros}>
        <div><strong>{total}</strong><span>Itens previstos</span></div>
        <div><strong>{concluidas}</strong><span>Concluídos</span></div>
        <div><strong>{pendentes}</strong><span>Pendentes</span></div>
      </div>

      <div className={styles.faixaTexto}>
        <span>{concluidas} de {total} itens concluídos</span>
        <strong>{percentual}%</strong>
      </div>
      <div className={styles.trilho} role="progressbar" aria-label="Percentual de itens separados" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual}>
        <div className={styles.progresso} style={{ width: `${percentual}%` }} />
      </div>


    </section>
  );
}
