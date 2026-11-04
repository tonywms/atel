# WMS Field Service Demo

## Rodar
1. `npm install`
2. copie `.env.example` para `.env.local`
3. `npm run dev`
4. abra `http://localhost:3000`

A demo funciona sem Supabase com `NEXT_PUBLIC_DEMO_MODE=true`.

## Roteiro
Integrações → Simular API → Operação CD → Separar → Conferir → Embarcar → Movimentações → Aceitar carga → Estoque Móvel → OS → Finalizar → Cliente 360° → Ativos → Logística Reversa.

## Supabase
Execute `supabase/schema.sql` no SQL Editor. Depois configure URL/key e use `NEXT_PUBLIC_DEMO_MODE=false`.
