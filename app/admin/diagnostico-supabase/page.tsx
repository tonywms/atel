'use client';
import { useState } from 'react';
import { diagnosticarAtel } from '@/lib/atelSupabaseV08';

type Resultado = Awaited<ReturnType<typeof diagnosticarAtel>>;
export default function DiagnosticoSupabaseAtel() {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [carregando, setCarregando] = useState(false);
  async function testar() {
    setCarregando(true);
    try { setResultado(await diagnosticarAtel()); }
    catch (erro) { setResultado({ estado: 'ERRO_PERMISSAO', mensagem: erro instanceof Error ? erro.message : 'Falha inesperada.' }); }
    finally { setCarregando(false); }
  }
  return <main style={{ padding: 28, maxWidth: 850, margin: '0 auto' }}>
    <h1>WMS Atel · Diagnóstico Supabase V08</h1>
    <p>Teste não destrutivo de configuração, sessão e vínculo organizacional. Nenhum dado é alterado.</p>
    <p><strong>Projeto esperado:</strong> ssunettwxzliiwkwvymg</p>
    <button type="button" disabled={carregando} onClick={testar} style={{padding:'12px 18px',cursor:'pointer'}}>
      {carregando ? 'Verificando...' : 'Verificar conexão e permissões'}
    </button>
    {resultado && <section aria-live="polite" style={{marginTop:20,padding:18,border:'1px solid #888',borderRadius:8}}>
      <h2>{resultado.estado.replaceAll('_',' ')}</h2><p>{resultado.mensagem}</p>
      {'vinculos' in resultado && <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(resultado.vinculos,null,2)}</pre>}
    </section>}
  </main>;
}
