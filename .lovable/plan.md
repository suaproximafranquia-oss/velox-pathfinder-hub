# Diagnóstico — Ação do Dia, compromissos futuros, alerta e fuso (somente `/f`)

Nada foi alterado: nenhuma ação executada, nenhum lead tocado, nenhuma migration, nenhum dado modificado.

## 1. Dados reais de Michel e Marco Antônio

| | Michel | Marco Antônio |
|---|---|---|
| Lead (GreenSales) | 59115 | 59142 |
| `stage_key` | `agendamentos` | `agendamentos` |
| `follow_up` na origem | `2026-09-09 11:00:00` (horário da operação) | `2026-09-09 16:00:00` |
| Registro espelhado | `gsfu_59115` | `gsfu_59142` |
| Guardado no banco (UTC) | `2026-09-09 14:00:00+00` | `2026-09-09 19:00:00+00` |
| Convertido para o horário local | 11:00 | 16:00 |
| Origem | `greensales` | `greensales` |

Conversão: o `follow_up` é lido como horário de São Paulo e gravado em UTC (`parseFollowUp`, com deslocamento real do fuso). 11:00 local = 14:00 UTC e 16:00 local = 19:00 UTC — exatamente o que está gravado. A exibição volta a converter para São Paulo.

**Fuso não é a causa.** Não há conversão dupla, nem divergência entre horário exibido, guardado e usado para priorizar.

## 2. Causa real

A função que classifica um compromisso está em `src/lib/crm/daily-actions.ts`, em `resolveBucket`. A regra atual é:

- começou há mais de 5 minutos → "atrasada";
- já começou ou começa em até 5 minutos → "agora";
- começa depois disso, **mas no mesmo dia** → "hoje";
- só cai em "futura" quando é de **outro dia**.

Ou seja: "futuro" hoje significa "outro dia", não "ainda não chegou a hora". Um compromisso de hoje às 11:00 ou às 16:00, às 08:18, já entra como "Para hoje".

Em seguida, a ordenação (`actionRank`, mesmo arquivo) dá a compromissos de prioridade máxima o posto 1 — acima do primeiro contato (E0) e de qualquer ligação/mensagem. Resultado: Michel assume a posição 1 às 08:18 e Marco Antônio vem logo atrás, ambos horas antes da hora.

Respostas diretas:
1. Michel aparece antes da hora porque um compromisso do próprio dia nunca é classificado como futuro.
2. Marco Antônio, pelo mesmo motivo — e por prioridade máxima ele sobe acima das ações reais do dia.
3. Erro de fuso: **NÃO**.
4. A classificação "futuro" funciona apenas para outro dia; para hoje, **não**.
5. A prioridade ignora a hora do compromisso: **SIM** (ela só olha se é prioridade máxima e se é de hoje).
6. Lista lateral e card principal usam a mesma lista oficial; a tela escolhe como card ativo o primeiro item que não seja "futura" — como Michel está em "Para hoje", ele é escolhido. Nenhuma segunda fila existe.
7. Existe mecanismo de alerta de reunião: `evaluateMeetingReminders` em `src/lib/workspace-alerts.ts`, que gera lembrete das reuniões nas próximas 24h.
8. Ele não apareceu hoje porque lê a lista de reuniões guardada no próprio navegador (`listMeetings`, `src/lib/meetings.ts`), e os compromissos do GreenSales vivem no banco (`portal_meetings`) — o alerta simplesmente não os enxerga.

## 3. Caminho confirmado

GreenSales (`stage_key = agendamentos` + `follow_up`) → sincronização (`src/server/crm/greensales-followup.server.ts`) → `portal_meetings` (`gsfu_<id>`, origem `greensales`) → Ação do Dia (`src/server/crm/daily-actions.server.ts`) → classificação (`resolveBucket`) → ordem (`actionRank`) → tela. Nenhuma tag foi usada como substituto de `stage_key`.

## 4. Menor correção necessária (para decisão futura, não executada)

Uma única mudança de regra, em `src/lib/crm/daily-actions.ts`:

- em `resolveBucket`, um compromisso com hora marcada que ainda está a mais de 5 minutos de distância passa a ser "futura", mesmo sendo hoje (a regra T-5 continua idêntica: dentro de 5 minutos vira "agora"; passou da hora vira "atrasada");
- consequência automática: ele sai da disputa da posição 1 e passa a aparecer em "Próximos compromissos", sem tocar em `actionRank`, fila, motor, GreenSales, posição 1 ou T-5.

Testes existentes de classificação/ordem precisariam apenas de conferência.

## 5. Alerta de próximo compromisso

Pode ser aproveitado o que já existe: a leitura oficial dos compromissos do dia já traz Michel e Marco com hora. O aviso visual seria uma faixa lendo o primeiro compromisso de hoje ainda não iniciado — sem novo motor, sem nova consulta, sem novo armazenamento. O mecanismo antigo (`workspace-alerts.ts`) não serve como está, porque lê apenas o armazenamento local do navegador.

Arquivos envolvidos numa construção futura:
- `src/lib/crm/daily-actions.ts` (regra de classificação);
- `src/components/crm/daily-actions-overlay.tsx` (faixa de aviso, opcional);
- `src/routes/f.executivo.dashboard.tsx` (faixa no Portal dos Leads, opcional).

Nada mais seria tocado; `/s`, `/s/portal` e `/seg` ficam fora.
