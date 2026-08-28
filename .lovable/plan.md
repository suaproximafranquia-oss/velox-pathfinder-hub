# Auditoria 3/5 — Fechamento da arquitetura antes da construção

Nada foi implementado. Abaixo, resposta objetiva a cada decisão: **SIM**, **SIM COM RESSALVA** ou **NÃO — recomendo diferente**, sempre com a consequência técnica.

---

## AÇÃO DO DIA (1–8)

**1. SIM.** A Ação do Dia passa a ser a fonte única da atividade operacional e substitui integralmente o overlay atual (`src/components/crm/daily-calls-overlay.tsx`). "Ligação do Dia" deixa de existir como conceito: ligação vira um `kind` dentro da nova lista.

**2. SIM.** Toda ação é sempre `lead + etapa + instância`. Etapa genérica sem lead não gera item. É o que a `action_key` garante.

**3. SIM COM RESSALVA.** Lead, origem/carteira, etapa, data/hora prevista, atraso e ação recomendada: todos disponíveis hoje. **Tentativa** só existe de forma completa para mensagens (`relationship_queue`, via instância); para ligações o legado guarda `step_day`, não número de tentativa. Onde não houver tentativa registrada, a interface deve omitir o campo — **jamais estimar**.

**4. SIM.** Agenda entra no topo quando dentro da janela. Regra: **de −15 min até `ends_at`**, relógio America/São_Paulo.

**5. SIM.** Reunião atrasada permanece no topo até ser concluída, reagendada ou cancelada. Ela não "cai" para o bloco de atrasadas comuns — reunião marcada é compromisso com terceiro.

**6. Somente na janela operacional.** Recomendação: reunião futura aparece **no dia em que ocorre** (e no topo a partir de −15 min). Antes disso ela vive na Agenda, não na Ação do Dia. Mostrar reunião distante na lista diária destrói a leitura de "o que fazer agora".

**7. O sistema determina a próxima ação oficial.** Recomendação: **uma ação oficial por lead por vez**. Se houver mensagem e ligação pendentes para o mesmo lead, a lista exibe a de maior precedência (agenda > reunião > mensagem da fila oficial > ligação legado) e mantém a outra recolhida sob o mesmo card, sem duplicar item. Isso é exatamente o papel do `Map<action_key>` com precedência.

**8. SIM COM RESSALVA IMPORTANTE.** A próxima ação é criada automaticamente **pelo motor** (`relationship_queue`, via `engine.server.ts`) ao registrar a conclusão. A Ação do Dia **não cria tarefa** — ela conclui na origem e relê. Se a Ação do Dia criasse tarefas, teríamos um segundo motor de cadência, o que é proibido pelas regras do projeto.

---

## MENSAGENS E MOTOR (9–18)

**9. SIM na intenção, NÃO na forma literal.** A Biblioteca passa a ter **apenas as mensagens do Word** como conteúdo oficial e ordem de exibição. Mas **as chaves técnicas existentes não podem ser apagadas**: `E20` e `E12` estão gravadas em `relationship_message_sends` (snapshots), em `relationship_e20_occurrences` e nos mapas de cor da UI. O caminho correto é: **chave técnica imutável + rótulo oficial do Word + `display_order`**. Etapas do Word que não existirem hoje (E2, E5, E6, E7, R0) entram como chaves novas; etapas atuais sem correspondência no Word são **desativadas** (`active = false`), nunca deletadas.

**10. SIM, sem exceção.** Nenhuma nomenclatura, texto, nome de etapa ou versão será inventado. Onde o Word não definir, o slot fica **vazio e visivelmente pendente** — é o que já acontece com `PENDING_TEXT_STEPS`.

**11. SIM.** A mensagem é determinada pela etapa real do lead na fila. Sem seletor manual.

**12–13. SIM para ambos.** Nome válido → inserido automaticamente; nome ausente, implausível ou rejeitado → versão neutra `"caro investidor"` (`src/lib/relationship/names.ts:12`, `resolveTreatment:140-169`). Já implementado, apenas reutilizar.

**14. SIM.** Link gerado a partir do `leadId` (ID GreenSales) com validade de 7 dias calculada **no servidor** (`e20.server.ts:23,130`). O front nunca monta a URL.

**15. SIM — e é a correção principal.** Hoje `issueE20` encerra a anterior e emite nova a **cada chamada**. A UI passa a **ler a ocorrência ativa antes**; havendo link válido, ele é reutilizado até expirar.

**16. SIM.** Botão de estado: "Gerar apresentação digital" → "Copiar apresentação digital" (com prazo restante). "Gerar novo link" fica como ação secundária, separada e confirmada.

**17. SIM.** Copia **mensagem + URL**, texto final renderizado, pronto para colar. Nunca só a URL.

**18. SIM.** A etapa vem da ação; não há como copiar mensagem de outra etapa. Consulta ao histórico de mensagens continua possível na ficha, em modo leitura, sem botão de cópia operacional.

---

## E0 / COMUNICAÇÃO AUTOMÁTICA (19–23)

**19. SIM — JÁ DEFINIDO e parcialmente implementado.** E0 é o único disparo automático. Hoje está em simulação (`E0_SIMULATION_ENABLED = true`, `src/lib/crm/e0-simulation.ts`), com marca obrigatória `TESTE — E0 SIMULADA` em mensagem e timeline. Regra permanente: **o ambiente decide antes das credenciais** — homologação nunca chama a Meta, mesmo com token real, e destinatário real em teste bloqueia o envio. Falta apenas: selo visual inequívoco na ficha e exclusão de `simulated = true` de todo contador.

**20. SIM.** Resposta automática só dentro da janela oficial de 24 h do WhatsApp (`engine.server.ts:29`). Fora da janela, só template aprovado — e, sem template aprovado, nada é enviado.

**21. SIM.** Direcionamento sempre pelo `responsible_executive_id` do lead e pelo WhatsApp do perfil dele. `src/server/relationship/executive-contact.server.ts` **já faz exatamente isso** e já se recusa a atender sem responsável e sem número — é o comportamento a replicar. **Contradição a corrigir:** `src/server/relationship/dispatch.server.ts:29,65-66` ainda cai em `getDefaultExecutive()` quando não há responsável, entregando ao investidor o portal de outro executivo.

**22. SIM.** WhatsApp obrigatório no perfil de quem recebe leads. Já é coluna real (`executive_profiles.whatsapp`) — falta a validação de obrigatoriedade.

**23. SIM.** Sem WhatsApp cadastrado: **bloquear a geração**, exibir motivo ao executivo e sinalizar à gestão. Nunca número genérico, nunca número de outro executivo.

---

## APRESENTAÇÃO DIGITAL / PORTAL (24–28)

**24. SIM.** `/` passa a ser exclusivamente institucional do Grupo Velox. Hoje `/` é o Portal da Financeira (`src/routes/index.tsx`) — inversão a executar.

**25. SIM.** `/f` vira a entrada exclusiva da Financeira (`src/routes/f.index.tsx`), com `f.tsx` permanecendo **sem guard** para não bloquear os links públicos `/f/{executivo}`.

**26. SIM — e a preparação já existe.** `src/lib/portal-brands.ts` já define os três prefixos e `s.$slug.tsx`/`seg.$slug.tsx` já existem como stubs. **Atenção ao detalhe:** o código atual usa **`s`** para Solar, não `sol`. Recomendo **manter `s`** (evita migrar rotas, validação de slugs reservados e links já emitidos); se a marca exigir `/sol`, criar `/sol` e manter `s` como alias permanente.

**27. SIM.** Raiz institucional = seletor das três operações, sem expor nenhum ambiente interno e sem redirecionar automaticamente para a Financeira.

**28. SIM.** A apresentação personalizada leva ao **Manual do Investidor**, jamais ao Workspace ou a área operacional. Pré-requisito técnico: adotar `unitPath()` antes da inversão de rotas — hoje há ~153 literais `/f/...` e `unitPath()` tem zero uso; sem isso, links E20 já entregues deixam de resolver.

---

## CRM / COMPORTAMENTO DO INVESTIDOR (29–35)

**29. SIM COM RESSALVA.** O CRM vira camada visual/operacional de leitura, **sem composição livre de mensagem**. Ressalva: o registro do envio precisa continuar existindo em algum lugar, porque é ele que alimenta o snapshot (`recordMessageSnapshot`) e a Jornada. Recomendação: o **envio/registro migra para a Ação do Dia** (etapa correta, texto oficial, cópia controlada) e o CRM mantém apenas a leitura da conversa. Remover o envio sem realocar o registro cegaria o histórico.

**30. SIM.** `crm_meta_templates` está **vazia (0 linhas)** — a aba não tem função real. Remover `src/routes/f.executivo.templates.tsx` e a entrada de menu. Reintroduzir só se/quando o E0 real via Meta exigir gestão de templates aprovados.

**31. SIM.** A aba Jornada sai do CRM (`src/components/crm/crm-lead-journey.tsx`) e permanece na ficha operacional. Sem perda de dado: ambas leem o mesmo agregador `journey.server.ts`.

**32. SIM.** Último acesso já é dado real (`portal_engagement.last_access_at`); "online" ainda não existe e será derivado.

**33. SIM.** Online = atividade nos últimos 15 min, **calculado na leitura**, sem coluna de status e sem job de expiração. Passado o limite, exibe "Último acesso: data/hora".

**34. SIM.** Campo único, derivado uma vez, consumido igualmente por CRM e Workspace. **Ressalva técnica obrigatória:** o ping de presença **não pode** entrar na lista branca de atividade (`src/lib/events/investor-activity.ts`) — se entrar, presença vira "atividade" e o problema do NOVO recorrente volta por outra porta. Observação: `src/lib/crm/presence.ts` é presença **do WhatsApp**, alimentada pela integração, e é coisa distinta — não misturar as duas.

**35. SIM.** "Ver ficha completa" navega para a ficha do lead no Workspace, preservando origem/carteira como parâmetro informativo. Hoje o botão não navega: `onOpenLead` (`portal-leads-board.tsx:620-623`) só seleciona o card, e não existe rota por `leadId`. Será criada `src/routes/f.executivo.investidores.$id.tsx`, reutilizando `crm-lead-ficha.tsx` / `investor-profile-view.tsx`.

---

## JORNADA / HISTÓRICO (36–40)

**36. SIM — REGRA DEFINITIVA, já implementada.** Lista branca em `src/lib/events/investor-activity.ts`, aplicada em `executive-data.ts`. Abrir card, comentar, criar reunião e enviar mensagem **não são** atividade do investidor.

**37. SIM.** Só fato ocorrido gera evento. Já há guarda de mudança real e `dedupeKey` determinística em `src/lib/lead-state.ts:129,148,165`. Renderização, remontagem e abertura de tela nunca emitem.

**38. SIM.** `investor.reactivated` permanece **apenas como alerta** (`src/lib/workspace-alerts.ts:132-137`), sem persistir, sem alterar status e fora da Jornada — a whitelist do servidor (`journey.server.ts:88-98`) já o exclui.

**39. SIM.** Lista branca, nunca lista negra. Voltar à lista negra é o que contaminava o estado a cada evento novo criado no sistema.

**40. SIM.** Na dúvida, **não é atividade do investidor** até existir regra explícita. Falso negativo é reversível; falso positivo reclassifica lead e corrompe a operação.

---

## PERFIS E PERMISSÕES (41–44)

**41. SIM, com uma correção obrigatória.** Os três níveis são corretos, mas hoje **o híbrido é decidido pelo ID do usuário**, não pelo papel ativo: `HYBRID_WORKSPACE_USER_IDS` (`src/lib/portal-workspace.ts:19`), usado em `canAccessPortalWorkspace:30-35` e `canViewFullWorkspace:42-49` — contrariando o comentário do próprio arquivo (`:130-133`). O acesso deve seguir o **papel ativo**.

**42. SIM.** Ambiente exclusivo do administrador, no mesmo padrão já validado do Remarketing: subtree próprio (`/f/admin`) com layout e entrada condicionada.

**43. SIM.** Invisível aos demais executivos, que continuam gerando apresentações apenas dos próprios leads. **Correção de segurança necessária:** as tabelas E20 usam `is_portal_member()` no SELECT — hoje **qualquer colaborador lê todas as ocorrências**. Trocar por `can_access_investor(lead_id)`, função que já existe e autoriza admin, gestão e responsável.

**44. SIM.** Visão total é **somente leitura de estrutura**: administrador enxerga tudo sem alterar `responsible_executive_id`. Transferência continua sendo ato explícito e auditado (`src/lib/relationship/lead-transfer.ts`).

---

## BACKUP (45–48)

**45. SIM.** Horários durante o dia, e na retenção histórica apenas o ponto da meia-noite de cada dia encerrado. Hoje a regra é outra (`RETENTION = { fullHours: 48, dailyDays: 7 }`, `backup.server.ts:143-152`, com "último ponto do dia"), então é alteração estrutural.

**46. SIM.** 00:00 = fechamento do dia anterior (`reference_date = created_at − 1 dia`). **Risco confirmado a corrigir junto:** o agrupamento diário atual usa `Math.floor(at / day)` em **UTC** (`:362`); em −03:00 a meia-noite local cai no dia UTC seguinte e o rótulo sai errado por construção. Exige campo explícito de data de referência calculado em fuso local.

**47. SIM.** Máximo de 7 pontos diários, com corte por **ranking** (`ORDER BY reference_date DESC LIMIT 7`), não por idade — hoje é por idade, e um dia sem execução produziria 6 pontos. O oitavo é eliminado automaticamente. Pontos `protected = true` (manuais e pré-restauração) permanecem preservados.

**48. SIM, sem risco para os dados.** `portal_backups`/`portal_backup_blobs` são apenas pontos de restauração; limpar o histórico **não afeta nenhum dado real do Portal**. Duas observações: (a) preservar os pontos `protected`; (b) a UI precisa passar a informar que a restauração **nunca** toca o núcleo operacional — `NEVER_RESTORE_TABLES` protege leads, conversas, jornada, engajamento e reuniões, e o usuário hoje não sabe disso.

---

## LIMPEZA ESTRUTURAL (49–55)

**49. SIM na interface, NÃO na lógica.** Remover a tela (`src/routes/f.executivo.identidade.tsx`) e o menu: nenhuma dependência funcional. **Manter** `resolve_portal_identity` e as colunas `identity_conflict`/`identity_alternates` — é o que garante a identidade atômica e a deduplicação. Recomendo um aviso discreto de conflito na própria ficha, para a informação não se perder.

**50. SIM.** `postPresentationVideoUrl` **não é coluna de banco** (vive no seed/`stored` de `src/lib/executive-auth.ts:158,315`), então remover da interface **não exige migration**. Manter o campo no modelo de envio (`crm-conversation.tsx`, `post-presentation.ts:71` já o tratam como opcional) e apenas retirar do perfil e da noção de "perfil completo".

**51. SIM.** Templates deixa de ser sistema de envio; a **Biblioteca de Conteúdo é a única fonte oficial do motor**. Consequência já mapeada: `src/lib/relationship/messages.ts` (consumidor único: `message-library.server.ts`) é aposentada após a importação do Word.

**52. SIM.** Princípio aceito: existir tecnicamente não justifica permanecer exposto.

**53. SIM.** Limpeza antes da construção — **com uma exceção de ordem**: remoções cujo substituto ainda não existe (envio no CRM, por exemplo) só entram **depois** que a Ação do Dia estiver operando, para não abrir buraco no registro do histórico.

**54. SIM.** Fonte única por regra. Estado do lead e presença: servidor. Mensagem: Biblioteca. Cadência: `relationship_queue`. Histórico: `journey.server.ts`. Compromisso: `workspace_agenda_events` (com reunião confirmada espelhada nele). Ação do Dia é **só leitura e agregação** — nunca uma nova fonte.

**55. SIM.** A fase de perguntas está encerrada. Há informação técnica suficiente para começar a construção incremental.

---

## Ordem da construção incremental aprovada

**Etapa 1 — Fundação da Ação do Dia (sem migration)**
`action_key = source:leadId:step|kind:instância` · agregador de leitura (`relationship_queue` + `crm_cadence_tasks` + `workspace_agenda_events` + `portal_meetings`) com precedência agenda > reunião > mensagem > ligação · blocos de ordenação em America/São_Paulo · overlay "Ações do Dia" substituindo "Ligação do Dia" · rota `f.executivo.investidores.$id` + correção de "Ver ficha completa".

**Etapa 2 — Mensagens oficiais**
Importar o Word na Biblioteca (chave técnica imutável + rótulo oficial + `display_order`), desativar o que não constar, criar as etapas ausentes, cadastrar os bindings de conteúdo, aposentar `messages.ts`, exibir texto renderizado com Copiar na Ação do Dia.

**Etapa 3 — Agenda integrada**
Espelhar reunião confirmada como evento `maxima` em `workspace_agenda_events` (cai na constraint `EXCLUDE` já existente), reunião atrasada fixa no topo, janela de −15 min.

**Etapa 4 — Apresentação Digital e perfil**
Migrar `slug`, `title`, `photo_url`, `phone` para `executive_profiles` · WhatsApp obrigatório com bloqueio · fim do fallback para Executivo Padrão · botão de estado com reutilização do link válido · RLS E20 por `can_access_investor` · ambiente administrativo `/f/admin`.

**Etapa 5 — Presença e limpeza**
`last_seen_at` + online derivado de 15 min (fora da lista branca) · remoção de Templates, Pendências de Identidade, aba Jornada do CRM, vídeo no perfil e cabeçalho do Remarketing.

**Etapa 6 — Backup e rotas**
Nova retenção com data de referência local e corte por ranking, reset do histórico · adoção de `unitPath()` e inversão `/` institucional × `/f`.

**Não implantar junto:** Etapa 1/3 com Etapa 6 (ambas mexem em navegação) · Etapa 2 com Etapa 1 (erro de texto ficaria indistinguível de erro de agregação) · backup isolado, em janela dedicada · presença separada da Etapa 1, por encostar na regra mais sensível do sistema.

**Pendência única de conteúdo:** o **Word oficial** — ele bloqueia a Etapa 2 inteira, e nenhuma nomenclatura será criada sem ele.
