# Diagnóstico — continuidade da E0 atrasada na Financeira /f

## Causa encontrada

**A mensagem é criada imediatamente, mas a continuidade não participa da ordenação oficial no servidor.** Ela recebe a data de execução da Ligação 2 e volta à disputa normal da fila. Além disso, a lista lateral sempre apresenta “Atrasadas” antes de “Para hoje”, mesmo quando o navegador promove a continuação ao card principal.

Consulta somente leitura confirmou duas ocorrências de hoje, 10/09, com Ligação 2 vencida em 09/09:

| Lead | Ligação 2 concluída — São Paulo | `due_at` da Mensagem E0 — São Paulo | Mensagem criada — São Paulo | Estado consultado |
|---|---|---|---|---|
| `gs_59193` | 10/09 09:38:10.482 | 10/09 09:38:10.482 | 10/09 09:38:13.180 | PENDING, sem reivindicação |
| `gs_42724` | 10/09 09:38:48.280 | 10/09 09:38:48.280 | 10/09 09:38:51.331 | PENDING, sem reivindicação |

Portanto, nesses registros, não faltou geração da Mensagem E0: ela foi persistida cerca de três segundos após a ligação, com liberação imediata. Essas ocorrências corroboram o mecanismo, mas o usuário não identificou qual lead originou o relato.

### Verificações técnicas delimitadas

1. **Data gravada:** Ligação 2 = execução da Ligação 1 + 10 minutos. Mensagem E0 = execução da Ligação 2, sem intervalo adicional. A mensagem não herda o vencimento antigo.
2. **Bucket:** `hoje`, porque o vencimento da mensagem passou a ser hoje; não `atrasada`.
3. **`actionRank`:** **2**, por continuar sendo E0, e não 4 de uma mensagem comum de hoje. Uma ação já reivindicada tem rank 0. Outras E0 atrasadas também têm rank 2 e vencem pelo desempate de data; etapas posteriores atrasadas, sem reivindicação/prioridade especial, têm rank 3 e não vencem a E0 apenas por estarem atrasadas.
4. **`continuityLeadRef.current`:** o caminho real atribui novamente o lead correto ao concluir a Ligação 2. A referência só é limpa em `commitQueue()` quando a lista recebida não contém ação executável desse lead. Isso pode acontecer durante os 10 minutos após Ligação 1, mas concluir Ligação 2 a define novamente. **Não há evidência capturada de que a referência tenha sido perdida no episódio relatado.**
5. **Reclassificação da resposta:** no caminho real, `completeWithStability()` não usa `result.queue` para selecionar o próximo card. Aguarda a barreira existente e faz outra leitura oficial. `reclassifyDailyActions()` reaplica a continuidade antes do rank; com a referência e a mensagem presentes, não a rebaixa. Uma reprodução somente em memória com leads fictícios confirmou isso.
6. **Motor versus navegador:** `tickLead()` cria uma linha PENDING com etapa E0, ordem 3 e `due_at` imediato. A leitura transforma essa mesma linha em `DailyAction`, com `dueDate` de hoje, `startsAt: null` e bucket `hoje`. Não cria outra mensagem. Entretanto, `queueAfterOutcome()` e a releitura passam por `currentDailyAction()`, que ordena/reivindica a posição 1 **sem receber a continuidade do lead recém-concluído**. A preferência local do navegador não é compartilhada pela trava de execução no servidor.

**Limite do diagnóstico:** estão comprovadas a ausência de continuidade na ordenação oficial e a divergência visual da lista lateral. Não está comprovado qual estado da referência ou resposta ocorreu no navegador naquele instante. Seria incorreto afirmar que a reclassificação, sozinha, elimina uma continuidade válida.

## Arquivo/função responsável

| Responsabilidade | Arquivo / função |
|---|---|
| Datas da sequência, sem erro identificado na espera | `src/lib/relationship/cadence-v2.ts:480–573` — `stepActions()` / `nextReleasedAction()` |
| Geração após “Não atendeu” | `src/server/relationship/call-outcome.server.ts:80–88` — `registerQueueCallOutcome()` / `tickLead()` |
| Conversão para bucket `hoje` | `src/server/crm/daily-actions.server.ts:336–403` — `buildDailyActions()` |
| Retorno após conclusão, sem contexto de continuidade | `src/lib/crm/daily-actions.functions.ts:60–67,453–457` — `queueAfterOutcome()` |
| Ordenação/reivindicação oficial sem continuidade | `src/server/crm/daily-actions-gate.server.ts:46–80` — `currentDailyAction()` |
| Preferência local preservada antes do rank | `src/lib/crm/daily-actions.ts:190–272` — `actionRank()`, `sortDailyActions()` e `reclassifyDailyActions()` |
| Referência, barreira e releitura | `src/components/crm/daily-actions-overlay.tsx:137–156,209–246` — `commitQueue()` / `completeWithStability()` |
| “Atrasadas” sempre antes de “Para hoje” na lateral | `src/components/crm/daily-actions-overlay.tsx:50–60,288–295,587–606` — `BLOCKS`, `blocks` e renderização |

## Qual correção mínima seria necessária

**Alinhar a continuidade da E0 no servidor e na apresentação, sem alterar o vencimento.** Após concluir a Ligação 2, o servidor deve reconhecer a Mensagem E0 liberada do mesmo lead como continuação validada daquela ação, antes de reivindicar trabalho de outro lead. A releitura e a trava de execução precisam reconhecer a mesma escolha; corrigir apenas a ordem no navegador deixaria a divergência operacional.

Na lateral, a continuação em foco precisa aparecer na mesma precedência do card ativo, sem ser empurrada visualmente para depois de todo o bloco “Atrasadas”.

Não é necessário retroagir `due_at`, transformar a mensagem em artificialmente atrasada, mudar a espera de 10 minutos, a regra E0, cadência, histórico, prefetch, Message Library ou outras etapas. Nenhuma alteração de código ou dados foi realizada; este documento registra somente o diagnóstico e a correção mínima sugerida, não uma autorização de implementação.