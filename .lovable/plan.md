# Diagnóstico — replicar o compromisso nas "Notas do Executivo" (/f)

Nada foi alterado. Abaixo o que existe hoje e o que seria necessário.

## 1. Tabela e função que alimentam "Notas do Executivo"

- Tabela: `investor_notes` (campos `lead_id`, `body`, `author_name`, `author_executive_id`, `author_user_id`, `scope`, `source_key`, `created_at`).
- Função oficial de gravação: `addInvestorNote` em `src/server/crm/investor-notes.server.ts`.
- Leitura: `listInvestorNotes` (mesmo arquivo), exposta por `listInvestorNotesFn` em `src/lib/crm/investor-notes.functions.ts` e exibida no Workspace do lead (`investor-profile-view.tsx`).
- A Ação do Dia já usa exatamente esse mecanismo (`recordDailyActionHistory` em `daily-actions-history.server.ts`), inclusive para os desfechos "compareceu / não compareceu / reagendada". Ou seja, o encadeamento pedido ("Agendamento criado…" seguido de "Agendamento — compareceu") já cai na mesma aba, na mesma tabela.

## 2. Dá para criar a nota dentro do fluxo atual?

Sim. O ponto correto é `syncOneFollowUp`, em `src/server/crm/greensales-followup.server.ts`, exatamente ao lado das chamadas de `appendTimeline` que já existem para criação, reagendamento e cancelamento. Não é preciso novo serviço, nova tabela nem nova rota.

## 3. Como evitar nota repetida a cada sincronização

Pelo `source_key`, que já é a chave de idempotência do mecanismo. Uma chave derivada do compromisso, por exemplo:

```text
greensales:follow_up:<externalId>:criado:<horário do compromisso em ISO>
```

`addInvestorNote` consulta `source_key` antes de inserir e ainda trata a violação de índice único como "já existe". Sincronizar de 5 em 5 minutos, ou amanhã de novo, não cria segunda nota.

## 4. Se o horário mudar na origem

O compromisso continua sendo o mesmo registro em `portal_meetings` (nada é duplicado). Nas notas entra **uma nova linha** de alteração, com chave própria contendo o horário novo:

```text
Agendamento reagendado — 14/09/2026 11:30 → 14/09/2026 14:00
source_key: greensales:follow_up:<externalId>:reagendado:<novo horário ISO>
```

A nota original permanece intacta. Se voltar ao horário anterior, a chave daquele horário já existe e nada é reescrito.

## 5. Cancelamento na origem

Sim: uma nota adicional ("Agendamento cancelado — …", com o motivo já usado hoje na Timeline), chave `…:cancelado:<horário ISO>`. Nenhuma nota é apagada nem editada — a aba é append-only.

## 6. Idempotência por referência técnica

Sim. A referência natural é a mesma identidade já usada pelo espelho: `external_ref = f:greensales:lead:<externalId>:follow_up`, mais o tipo de acontecimento e o horário. Isso cobre criação, reagendamento, mudança de modalidade e cancelamento sem colisão.

## 7. Risco para Timeline, portal_meetings, Ação do Dia, fila, cadência ou métricas

Nenhum. `investor_notes` não é lida por motor, fila, cadência, gates da Ação do Dia nem pelas métricas da Central — é registro histórico de leitura humana. A gravação seria em bloco protegido (falha na nota nunca desfaz o espelhamento), igual ao que a Ação do Dia já faz.

## 8. Arquivos e funções mínimos

- `src/server/crm/greensales-followup.server.ts` — pequena função interna `appendFollowUpNote(...)` e três chamadas, nos mesmos pontos dos `appendTimeline` já existentes (create / update / cancel), além do ponto de mudança de modalidade se quisermos registrá-la.
- `src/server/crm/investor-notes.server.ts` — um ajuste único: hoje `addInvestorNote` exige `userId` (autor humano). A sincronização é automática, sem sessão. Basta tornar `userId` opcional e aceitar o `authorName` já informado (ex.: "Sincronização GreenSales"), sem alterar o comportamento atual de quem passa `userId`. A coluna no banco já aceita valor nulo — **nenhuma migration**.

Nada mais precisa mudar: sem nova tabela, sem nova rota, sem alteração na Timeline, no espelho ou na Ação do Dia.

## 9. Restrição de ambiente

Sim, fica só na Financeira `/f`: o módulo de follow-up do GreenSales é exclusivo de `/f` e as notas ficam presas ao lead `gs_<id>`. `/s`, `/s/portal` e `/seg` não são tocados.

## 10. Conclusão

A implementação é segura reaproveitando o que já existe. O único ponto técnico a resolver antes é o **autor da nota automática**: hoje o mecanismo pressupõe um usuário logado. Definido isso (sugestão: autor "Sincronização GreenSales", sem `author_user_id`), o restante é uma extensão pequena, idempotente e sem efeito colateral.

### Decisão pendente para você

- Texto e autor exibidos na nota automática (proposta: corpo "Agendamento criado — 14/09/2026 às 11:30" / "Videochamada criada — 10/09/2026 às 15:00"; autor "Sincronização GreenSales").
- Registrar também a troca de modalidade (AGENDAMENTOS ↔ VÍDEO) como nota, ou manter isso só no histórico do compromisso.
