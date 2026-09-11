# Diagnóstico read-only — 14 cards vistos no Workspace /f

## Fotografia temporal

A tela mencionada pelo usuário mostrava 14 cards. A leitura atual do banco encontrou **16** porque, depois daquela fotografia, entraram mais dois registros GreenSales:

- `gs_59315` — Jcarlos — origem em 10/09/2026 22:55:30 (São Paulo), ingerido em 10/09 22:57:04;
- `gs_59323` — Ter o meu próprio negócio — origem em 11/09/2026 08:05:38, ingerido em 11/09 08:08:07.

Eles não integram a lista de 14 abaixo. A diferença confirma que a sincronização continuou ativa e que a tela pode refletir uma fotografia anterior.

## Os 14 registros da fotografia

Horários abaixo em São Paulo (UTC−3). “ID interno” inclui o ID do card e o UUID do espelho CRM.

| Nome | ID interno / GreenSales | Validação? | Motivo no Workspace e fluxo | Derivados | Entrada/recriação local |
|---|---|---:|---|---|---|
| Cícero | `gs_57437` / CRM `77df340c-7c2b-42a4-a6f4-40c93fada9b6` / GS `57437` | Não | Sincronização GreenSales recuperou o espelho; o `follow_up` em AGENDAMENTOS criou/recriou o card | 1 compromisso GreenSales; sem cadência, fila ou E0 | Espelho: 10/09 22:04:59; card/compromisso: 10/09 22:36:57 |
| Adenilto Ricardo Pereira | `gs_57771` / CRM `052ea87e-02c1-4a95-a36c-fc24a69110ab` / GS `57771` | Não | Mesmo fluxo de `follow_up` em AGENDAMENTOS | 1 compromisso; sem cadência, fila ou E0 | Espelho: 10/09 22:04:48; card/compromisso: 10/09 22:36:57 |
| Valmir Silv | `gs_58992` / CRM `b7d09e85-af5d-4b7b-ba93-e9467f6eb66a` / GS `58992` | Não | Mesmo fluxo de `follow_up` em AGENDAMENTOS | 1 compromisso; sem cadência, fila ou E0 | Espelho: 10/09 22:04:24; card/compromisso: 10/09 22:36:56 |
| Ricardo Gonçalves | `gs_59034` / CRM `f37a216b-816e-4d5c-8083-40635b523735` / GS `59034` | Sim | Um dos quatro preservados; card originado pela entrada GreenSales/E0 antes da limpeza | 1 cadência ativa, 4 itens de fila (3 executados, E1 pendente), 1 ação E0 pendente; sem compromisso | Card operacional registrado em 08/09 09:40:35; preservado no reset |
| Eduardo Franco | `gs_59037` / CRM `82698d70-fad5-4959-88f1-49250fa9c1a8` / GS `59037` | Sim | Um dos quatro preservados; entrada GreenSales/E0 | 1 cadência ativa, 4 itens de fila, ação E0 cancelada após conclusão; sem compromisso | 04/09 21:55:05; preservado no reset |
| Marcelo Lira | `gs_59056` / CRM `2a29e780-d4de-416c-b6c5-b9955c28e8cf` / GS `59056` | Não | Sincronização recuperou o espelho; `follow_up` na etapa VÍDEO criou/recriou o card | 1 compromisso; sem cadência, fila ou E0 | Espelho: 10/09 22:04:20; card/compromisso: 10/09 22:37:00 |
| Hércules Vieira de Souza | `gs_59058` / CRM `fbf9dc27-dec9-4643-8729-7e7b02a763cf` / GS `59058` | Não | `follow_up` em AGENDAMENTOS após sincronização | 1 compromisso; sem cadência, fila ou E0 | Espelho: 10/09 22:04:20; card/compromisso: 10/09 22:36:55 |
| Francisco | `gs_59081` / CRM `36a0dded-7a64-4845-9c3c-e0d3333832d2` / GS `59081` | Sim | Um dos quatro preservados; entrada GreenSales/E0 | 1 cadência ativa, 4 itens de fila, ação E0 cancelada após conclusão; sem compromisso | Recebido em 08/09 07:49:04; preservado no reset |
| Verônica | `gs_59108` / CRM `7badac65-3ab6-4e4a-b349-18290bb8e42a` / GS `59108` | Não | `follow_up` em AGENDAMENTOS após sincronização | 1 compromisso; sem cadência, fila ou E0 | Espelho: 10/09 22:04:17; card/compromisso: 10/09 22:36:55 |
| Marco Antonio | `gs_59142` / CRM `aab7c56b-86f2-4713-9d67-3f48a2e96de2` / GS `59142` | Não | `follow_up` na etapa VÍDEO após sincronização | 1 compromisso; sem cadência, fila ou E0 | Espelho: 10/09 22:04:15; card/compromisso: 10/09 22:36:59 |
| João Figueiredo | `gs_59279` / CRM `96d1cc08-3078-477e-b445-fb791bec76e9` / GS `59279` | Sim | Um dos quatro preservados; entrada GreenSales/E0 | 1 cadência ativa, 4 itens de fila, 1 ação E0 pendente; sem compromisso | Recebido em 10/09 09:38:04; preservado no reset |
| Adriana | `gs_59303` / CRM `91970a3f-1b0d-4650-9429-61824ad636e1` / GS `59303` | Não | Nova entrada real na etapa NOVOS, recriada pela sincronização; percorreu intake/E0 | 1 cadência, 1 item de fila e 1 ação E0; sem compromisso | 10/09 22:04:06 |
| Quero poder emprestar o meu próprio dinheiro | `gs_59307` / CRM `e36dd092-19ee-42f0-af62-348fa7c1728e` / GS `59307` | Não | Nova entrada real em NOVOS, recriada pela sincronização; percorreu intake/E0 | 1 cadência, 1 item de fila e 1 ação E0; sem compromisso | 10/09 22:04:04 |
| Afonso | `gs_59311` / CRM `1422f525-8983-47b1-b9b8-68e1624ad809` / GS `59311` | Não | Nova entrada real em NOVOS recebida pela sincronização; percorreu intake/E0 | 1 cadência, 1 item de fila e 1 ação E0; sem compromisso | 10/09 22:36:08 |

## Classificação final dos 14

- **4 leads de validação:** Ricardo, Eduardo, Francisco e João.
- **Consequência dos testes dos quatro:** **0**. Nenhum dos outros dez possui marcação de teste, lote de homologação ou vínculo derivado dos quatro.
- **Externos/recriados pela sincronização — compromissos:** **7** — Cícero, Adenilto, Valmir, Marcelo, Hércules, Verônica e Marco. O sincronizador recuperou seus espelhos e o fluxo normal de `follow_up` criou cards e compromissos.
- **Externos/recriados pela sincronização — novas entradas/E0:** **3** — Adriana, “Quero poder emprestar o meu próprio dinheiro” e Afonso.
- **Outro caso:** **0** dentro da fotografia de 14.

## Origem técnica confirmada

- A tela de Workspace usa `portal_leads` por meio da sincronização local em `src/routes/f.executivo.dashboard.tsx` e `src/lib/portal-leads-sync.ts`.
- O espelho GreenSales é `crm_leads`.
- `src/server/crm/lead-sync.server.ts` recupera registros ausentes e sincroniza `follow_up`.
- `src/server/crm/greensales-followup.server.ts:232-292` chama `ensureWorkspaceCard()` quando há `follow_up` elegível.
- `src/server/crm/lead-intake.server.ts:121-150, 252+` cria o card e os derivados E0 para novas entradas elegíveis.
- `portal_leads.created_at` preserva a data de criação informada pela origem; para os sete cards de compromisso, a hora real de recriação local é demonstrada pelos registros de compromisso/Timeline entre 01:36:55 e 01:37:00 UTC.

## Conclusão

Os dez cards além dos quatro não foram gerados pelo teste controlado. Todos vieram novamente da integração normal com o GreenSales: sete por compromissos (`follow_up`) e três por novas entradas em NOVOS. Depois da fotografia de 14, a mesma sincronização adicionou mais dois, elevando o total atual do banco para 16.

Nenhum código, dado, relógio, sincronização, reset ou deploy foi alterado.
