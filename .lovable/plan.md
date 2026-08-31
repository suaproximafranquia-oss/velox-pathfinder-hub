# Sistema atual x Arquitetura futura — separação e caminho de evolução

Rodada de planejamento. Nada foi alterado: sem código, sem banco, sem cron, sem envio. A Global WhatsApp Safety Lock permanece intacta.

Convenção: **[ATUAL]** existe hoje · **[PARCIAL]** existe em parte/em outra forma · **[FUTURO]** conceito ainda não implantado · **[RECOMENDAÇÃO]** proposta técnica.

Verificado nesta rodada: `src/lib/relationship/config.ts` (etapas e fluxos), `src/lib/relationship/machine.ts`, `src/lib/relationship/types.ts`, `src/lib/relationship/step-registry.ts`, `src/server/crm/cadence.server.ts`, `src/lib/crm/daily-actions.ts`, `src/server/relationship/scheduler.server.ts`.

---

## 1. Inventário: o que existe, o que existe em parte, o que é futuro

### Etapas da cadência

**[ATUAL]** As etapas declaradas hoje são: `E0`, `E0_V1`, `E1`, `E3`, `E4`, `E12`, `E30`, `R1`, `R2`, `R3`, `RE0`–`RE3`, `RF0`, `RF1`, mais `V3`/`V4` no fluxo de visualização. Os fluxos são:
- sem_resposta: E0 → E1 → E3 → E4 → E12 → E30
- visualizacao: E0 → E1 → V3 → V4
- reengajamento: R1 → R2 → R3
- reentrada: RE0 → RE1 → RE2 → RE3

**[FUTURO]** A jornada desenhada por vocês (E0…E8 + fluxos R com R4) é uma **renumeração e ampliação** dessa lista. **[RECOMENDAÇÃO]** Isso é configuração, não código: `step-registry.ts` já deriva as etapas conhecidas de `STEPS`, e `machine.ts` não conhece nomes de etapa individualmente. Acrescentar E2, E5–E8 e R4 é declarar novas entradas em `STEPS` e ajustar as listas de fluxo — com um mapa de equivalência do que existe hoje (por exemplo E3 atual ↔ etapa correspondente na nova numeração) para o histórico não perder sentido.

### Decisão vs execução

**[ATUAL]** O motor decide e executa na mesma passagem; a etapa entra em `executedSteps` no instante da decisão. **[LIMITE]** Não existe estado "decidida e não executada". **[FUTURO]** Separação DECISÃO → PLANEJAMENTO → EXECUÇÃO → RESULTADO.

### E0 como única automação

**[PARCIAL]** A E0 tem caminho de entrada próprio (`first-contact.server.ts` + fila de adiadas), mas compartilha o mesmo tick e o mesmo despachante das demais etapas — o tick tenta disparar qualquer etapa vencida. **[FUTURO]** Whitelist de automação restrita a E0/E0_V1.

### Ação do Dia

**[PARCIAL]** Existe como **camada de leitura** (`daily-actions.ts` + `daily-actions.server.ts`): agrega reuniões, agenda, fila do motor e ligações legadas, com chave determinística, precedência entre fontes, colapso por lead e classificação temporal. **[LIMITE]** Não guarda estado, não recebe resultado, não cria ações. **[FUTURO]** Ação como registro persistente com estados e resultados.

### Resultado de ligação

**[PARCIAL]** `crm_cadence_tasks` já grava `outcome` SIM/NAO, quem concluiu e quando, e ancora a próxima tentativa. **[LIMITE]** É um motor de ligações **separado** do motor de relacionamento. **[FUTURO]** Um único modelo de ação cobrindo ligação, mensagem e reunião.

### Reunião / agendamento

**[PARCIAL]** `portal_meetings` existe e `SCHEDULE_CREATED` pausa a cadência (`SCHEDULED`). **[LIMITE]** Não há registro de comparecimento, evolução, reagendamento nem não comparecimento. **[FUTURO]** Todas essas respostas como resultado estruturado da ação.

### Pular com justificativa

**[FUTURO]** Não existe hoje em nenhuma forma — nem no motor, nem nas ligações, nem na Ação do Dia.

### Relatório administrativo

**[FUTURO]** Não existe. **[PARCIAL]** As fontes brutas existem (`crm_cadence_tasks`, `relationship_message_sends`, `relationship_engine_log`), mas sem categorias comparáveis entre canais.

### ID como identidade

**[ATUAL]** Já é assim na base: `portal_leads.id` é a identidade, `daily-actions.ts` carrega `leadId`, e as funções `can_access_investor` / `current_executive_id` decidem acesso por ID. **[LIMITE]** Não há amarração formal entre "a ação exibida" e "a nota gravada" — hoje a nota depende do contexto de tela.

### Mensagens com versões completas

**[PARCIAL]** A Biblioteca existe e vincula conteúdo a etapa (`relationship_step_content_bindings`, `relationship_contents`), mas o link/material é resolvido no momento da execução. **[FUTURO]** Versões completas (texto + link + rótulo com/sem nome), imutáveis por versão.

### Safety Lock

**[ATUAL]** Ativa e íntegra: ponto único antes da Graph API, com auditoria de cada tentativa bloqueada.

---

## 2. Como evoluir sem criar dois motores

**[RECOMENDAÇÃO] Princípio central:** não construir um "novo motor". O motor atual (`machine.ts` + `engine.ts`) continua sendo a única inteligência; o que muda é **o que ele produz**: em vez de um envio, uma **ação planejada**.

```text
MOTOR (única decisão)
   └─> PLANEJADOR (grava ação: lead_id + etapa + ciclo)
         ├─ etapa na whitelist (E0) ─> despachante ─> Safety Lock ─> canal
         └─ demais etapas ──────────> AÇÃO DO DIA ─> executivo responde
                                            └─> evento de resultado ─> MOTOR decide de novo
```

Cinco travas que impedem os riscos citados:

1. **Whitelist server-side de automação.** O despachante recebe a etapa e recusa qualquer chave fora de `E0`/`E0_V1`, registrando a recusa. Etapa manual não tem como sair por engano — nem por bug, nem por configuração de tela.
2. **`executedSteps` só no resultado.** Planejar nunca marca a etapa como cumprida. Isso elimina de vez a confusão entre "identificada" e "executada".
3. **Chave determinística com unicidade no banco** (`lead_id + etapa + ciclo`): recriação em massa vira no-op, e nem o tick nem o caminho imediato conseguem duplicar uma ação.
4. **Um caminho de escrita só.** Tanto a decisão imediata (após um resultado) quanto o ciclo periódico entram pela mesma função de planejamento. Nunca dois códigos criando ação.
5. **Desligamento em ordem, com marco de corte.** Fase 1 sombra (planeja, não apresenta, não executa) → Fase 2 apresenta na Ação do Dia → Fase 3 remove o despachante automático para tudo fora da whitelist e aposenta o motor de ligações legado, que passa a ser apenas histórico. Só etapas vencendo a partir do marco viram ação, o que evita avalanche.

**Convivência dos dois motores de ligação hoje.** `crm_cadence_tasks` é um planejador paralelo real. **[RECOMENDAÇÃO]** Durante a transição ele fica **somente leitura** (histórico e ancoragem das tentativas já feitas), e o novo planejador é a única fonte de ações novas — nunca os dois criando ligação para o mesmo lead.

**Renumeração E0…E8 sem quebrar histórico.** **[RECOMENDAÇÃO]** Não renomear as chaves antigas. Declarar as novas etapas e manter uma tabela de equivalência etapa-antiga → etapa-nova usada apenas na leitura do histórico. Renomear em lugar quebraria `executedSteps` de todos os leads vivos.

---

## 3. Decisões que ainda dependem de vocês

1. Mapa oficial E0/E1/E3/E4/E12/E30 (atual) → E0…E8 (futuro): quais são equivalentes e quais são etapas realmente novas?
2. R4 entra no fluxo de reengajamento — e o que ele contém?
3. Os fluxos `visualizacao` (V3/V4), `reentrada` (RE0–RE3) e `RF` permanecem no modelo futuro?
4. Pular consome a etapa ou ela pode voltar depois?
5. Após "não compareceu", o retorno ao R é na etapa seguinte à última executada?
6. Validade de uma ação pendente: indefinida ou expira após N dias úteis?
7. Rotação entre versões de mensagem: por lead, por executivo ou sequência global?
8. Quem pode pular: só o responsável ou também a gestão?
9. "Sem interesse" encerra a cadência ou apenas suspende?
10. Ações anteriores ao marco de corte: entram na Ação do Dia ou ficam só como histórico?
