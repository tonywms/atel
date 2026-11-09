# Concorrência — roteiro não executado

Executar somente após autorização em um clone descartável, com o contrato revisado instalado. Nenhum passo abaixo foi executado nesta revisão.

Fixtures com `ROLLBACK` de uma sessão não são visíveis a outras. Portanto o teste sequencial não demonstra concorrência real. Para estes casos, preparar novas organizações/usuários/materiais de teste **no clone**, publicar apenas essas fixtures e descartar o clone no final. Não reutilizar ou atualizar documentos históricos.

Exportar os UUIDs das fixtures e uma chave de idempotência comum para duas sessões. Em cada sessão: iniciar transação `READ COMMITTED`, configurar `request.jwt.claim.sub` e `request.jwt.claims` para o mesmo admin da fixture, e usar `SET LOCAL ROLE authenticated`. As duas sessões devem chamar os wrappers públicos, sem acessar as tabelas como admin durante a operação testada.

| Caso | Sessão A | Sessão B | Resultado e invariantes |
| --- | --- | --- | --- |
| Solicitação simultânea | Solicitar com chave K; manter transação aberta | Mesma organização/usuário/K e mesmo payload | B aguarda o lock. Confirmar A em menos de 5 segundos: B deve retornar o mesmo UUID com `repetida=true`. Um cabeçalho e um evento SOLICITAR. |
| Timeout e reenvio | Mesmo caso; manter o lock por mais de 5 segundos | Tentar a mesma chave | B pode receber `55P03`; fazer ROLLBACK de B. Depois de confirmar A, repetir B com a mesma chave: mesmo UUID, sem documento adicional. |
| Mesma chave, outro conteúdo | Solicitar com K e quantidade 1 | Solicitar com K e quantidade 2 | Depois de confirmar A, B deve falhar `22023`; nenhuma escrita parcial. |
| Aprovação versus rejeição | Aprovar uma solicitação de revisão 1 e aguardar antes de confirmar | Rejeitar o mesmo UUID/revisão 1 com outra chave | Uma única decisão vence. Confirmar A antes do timeout: B recebe `40001`; um único evento de decisão. Se B receber timeout, repetir após rollback continua sem permitir segunda decisão. |
| Mesmo replay de decisão | Aprovar com chave D | Aprovar mesmo UUID/revisão/payload/D | Mesmo resultado confirmado, um evento APROVAR. |
| Usuário/organização diferente | Chave K em A/usuário A | K em B/usuário B | Operações independentes, destinos correspondentes e UUIDs distintos; nenhuma leitura cruzada. |
| Snapshot incompatível | `BEGIN ISOLATION LEVEL REPEATABLE READ` ou `SERIALIZABLE` | Chamar solicitar/aprovar/rejeitar | `40001` explícito antes de qualquer escrita, pedindo nova transação READ COMMITTED. Leitura não exige esse nível. |

Uma colisão do hash do advisory lock só deve serializar operações extras; a unicidade real continua em `(organizacao_id, usuario_id, chave_idempotencia)`. Não usar esse hash como identidade de requisição.

Após cada cenário, comparar as tabelas físicas e ativos com a baseline e contar os eventos e itens **somente das fixtures**. Nenhuma RPC administrativa deve alterar estoque, custódia, RETs ou devoluções físicas. O nível READ COMMITTED e a necessidade de repetir a transação após `40001`/`55P03` fazem parte do contrato; não repetir com outra chave.

Verificar também mudança de configuração do CD Principal entre solicitação e aprovação em uma fixture: aprovação deve falhar e preservar `destino_id` original; rejeição permanece possível. Não se deve reescrever a solicitação para redirecioná-la a outro CD.
