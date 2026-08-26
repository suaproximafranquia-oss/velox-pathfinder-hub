# Diagnóstico Final Consolidado — Motor de Relacionamento, Portal dos Leads e Remarketing

Nada foi alterado: sem migration, sem código, sem dados, sem envio, sem mexer na biblioteca. Documento de validação.

## 1. Correção registrada: E20 → E27 → Finalização

Confirmado, esta é a interpretação adotada:

- **E20** = momento em que o executivo clica em GERAR E20 no card. Nasce a instância e o link personalizado com validade de **7 dias corridos exatos**.
- **E27** = **+7 dias corridos** após a E20. Sem qualquer deslocamento. Segunda → segunda; sexta → sexta; atravessar sábado e domingo é irrelevante.
- **Finalização** = ação posterior ao prazo da E20/E27. **Só ela** respeita o calendário operacional: caindo em sábado ou domingo, vai para o próximo dia útil.

Ou seja, o calendário de dias úteis (`src/lib/relationship/calendar.ts`) **não** se aplica ao vencimento do link nem à E27 — apenas à mensagem de finalização.

## 2. Regras fechadas

**Identidade e coluna**
- Identidade do lead = `external_source + external_id` (GreenSales). Nome nunca é chave. Telefone normalizado é dedup auxiliar.
- NOVOS é decidido pela **coluna**. As demais etapas, por coluna + histórico/tags.
- **NOVOS + qualquer outra tag de etapa do funil = REENGAJAMENTO**, nunca E0. Sem matriz de combinações.
- Tags antigas nunca são removidas — são histórico.
- **Kanban não muda**: a posição visual continua pela etapa mais avançada. NOVOS+OPORTUNIDADE aparece em OPORTUNIDADE, NOVOS+FRIO em FRIO, e assim por diante. A regra de NOVOS decide cadência, não posição.
- Decisão sempre por **estado atual + histórico**, nunca pela fotografia de entrada.

**Cadência**
- E0 é o primeiro contato automático, uma única vez por ciclo de entrada. Sem "Reenviar boas-vindas", sem reabertura manual.
- Reengajamento reutiliza **RE0–RE3**, sem motor paralelo, e passa a ser **assistido** pelas AÇÕES DO DIA.
- ZERO CONTATO, FRIO e **AGENDAMENTO** permanecem elegíveis à cadência. AGENDAMENTO não encerra nada e não é rebaixado automaticamente para FRIO.
- **OPORTUNIDADE encerra a cadência** daquele ciclo: fecha a instância ativa, cancela pendências, nada é enviado automaticamente. **COF** e estágios avançados (coffee, contrato, pagamento) também ficam fora de qualquer cadência de prospecção.
- Retorno solicitado dentro de uma oportunidade vira **agenda/prioridade manual**, com prioridade máxima na central do dia. Oportunidade não é lead morto — é lead fora do motor.

**Instâncias**
- Cada ciclo é uma **instância** própria: origem (entrada / reengajamento / E20 manual), início, prazo, encerramento e motivo.
- **GERAR E20 pausa a cadência corrente** e abre uma instância independente. Nunca dois fluxos de mensagem concorrendo pelo mesmo lead.
- Qualquer executivo responsável pelo lead gera a E20, sem aprovação da gestão. A geração fica no histórico.
- E20 depois de uma E30 já encerrada, meses ou anos depois, cria **nova instância**. O histórico anterior permanece intacto.
- E20/E27/finalização são **assistidas** — o sistema prescreve, mostra a mensagem, gera o link, permite copiar e registra a execução. Nada é disparado pela Meta neste momento.

**Link E20**
- TTL próprio de 7 dias corridos por instância, sobre a infraestrutura de token existente. Sem domínio novo.
- Expirado: página de link expirado, conteúdo não liberado, e o lead não volta ao material pelo Portal sem um novo link válido.
- Os links atuais de outros fluxos, com TTL diferente, não são alterados.

**Mensagens e histórico**
- Biblioteca com **versão ativa + versões anteriores preservadas**.
- **Snapshot imutável no envio**: corpo renderizado, `template_id`, versão, conteúdo anexado e primeiro nome usado. Se a E1 mudar amanhã, o lead antigo continua mostrando a E1 que recebeu.
- Mensagens usam **somente o primeiro nome**, derivado do cadastro corrigido.
- **Jornada consolidada** entre Portal dos Leads, Workspace e Remarketing, em leitura única e cronológica.
- **Notas automáticas e notas manuais** existem e são distintas dos eventos.
- Mensagem longa: prévia com "…" e card com o conteúdo completo. Evento simples (ligação com data/hora) permanece compacto.
- Fim dos eventos falsos `lead_sincronizado` sem alteração: só `last_synced_at` é atualizado. Timeline só com acontecimento real.
- **PENDENTE** só existe enquanto o lead está em NOVOS e ainda não foi processado. Saiu de NOVOS, deixa de ser pendente.

**Remarketing**
- Ambiente separado, base própria, nunca cria lead no CRM. Mas seus envios aparecem na jornada compartilhada da **mesma pessoa**: data, hora, campanha e mensagem. Sem duplicar o contato.

**Executivo e janela de 24h**
- Telefone individual passa a ter fonte confiável em `executive_profiles`.
- Botão **"Falar com o Executivo"** dinâmico, resolvido pelo responsável atual do lead.
- Resposta automática **somente dentro da janela de 24h** aberta por uma resposta do lead. Dentro da janela, conversa humana e do motor sem novo template. A interpretação do que o lead quis dizer continua humana.

**Edição manual**
- Nome e telefone editáveis no Portal dos Leads. **MANUAL > GREENSALES**; o sync não sobrescreve o valor corrigido; a alteração vai para o histórico.
- Trava reversível: ação administrativa **"voltar a seguir origem"** devolve aquele campo ao GreenSales.

## 3. Arquitetura atual (verificada)

| Camada | Onde vive | Situação |
|---|---|---|
| Coluna/posição | `src/lib/crm/board.ts` (`resolveBoardColumn`) | decide pela etapa mais avançada; REMARKETING tratado à parte |
| Entrada x reentrada | `src/lib/relationship/entry.ts` (`resolveEntryFlow`, `resolveCooledFlow`) | decide por `hasPreviousRelationship`, `newCommercialEntry`, `entryCount` — **não olha tags** |
| Máquina de estados | `src/lib/relationship/machine.ts`, `decide.ts`, `engine.ts` | estados incluem `PAUSED`, `INTERRUPTED`, `COMPLETED`, `CLOSED` |
| Persistência da cadência | `relationship_cadences` | **1 linha por (scope, lead)** — sem noção de instância |
| Fila e auditoria | `relationship_queue`, `relationship_events`, `relationship_decisions`, `relationship_engine_log` | completas |
| Elegibilidade de ligações | `src/lib/crm/cadence.ts` (`ELIGIBLE_STAGE_KEYS`) | só `zero_contato` e `frio` |
| Sincronização | `src/server/crm/lead-service.server.ts`, `lead-sync.server.ts`, `sync-scheduler.server.ts` | upsert sobrescreve nome/telefone e grava `lead_sincronizado` sem mudança |
| Primeiro contato | `src/server/crm/lead-intake.server.ts`, `first-contact.server.ts`, `first-contact-queue.server.ts` | E0 na transição real para a coluna de entrada, com janela e fila de adiadas |
| Token de link | `src/server/portal-token.server.ts` | HMAC `investorId.exp`, TTL **fixo de 30 dias** |
| Rotas curtas | `/e/$slug`, `/s/$slug`, `/f/$slug` | só redirecionam para a Home com contexto; não gateiam nem expiram |
| Telefone do executivo | `src/lib/executive-auth.ts` | campos `phone`/`whatsapp` existem, mas os 7 executivos estão com o mesmo número e o dado é local |
| Remarketing | `remarketing_*` + `src/server/remarketing/*` | isolado, com conversas próprias |
| Blindagem | triggers `guard_lead_delete` / `guard_lead_truncate`, `portal_lead_guard_log` | ativa |

## 4. Conflitos que permanecem

1. **Uma linha de cadência por lead** — bloqueio estrutural único para instâncias, pausa por E20 e E20 recorrente.
2. **RE0–RE3 são despachados**, não prescritos — tornar assistido muda o destino da decisão, não a decisão.
3. **AGENDAMENTO fora de `ELIGIBLE_STAGE_KEYS`**.
4. **Não existe encerramento por OPORTUNIDADE/COF**; os terminais atuais são por etapa (E12/E30) ou ação manual.
5. **TTL do token é global (30 dias)** e assina só o investidor — a E20 precisa de validade e identificador por instância sem tocar nos links atuais.
6. **Nenhuma rota gateia conteúdo** nem tem página de expirado.
7. **Telefone do executivo sem fonte confiável.**
8. **`upsertLead` sobrescreve nome/telefone** e polui a timeline.
9. **Nenhum versionamento em uso**: `crm_meta_templates` e `relationship_template_bindings` estão **vazias**; o motor roda 100% sobre os textos fixos de `messages.ts`, em modo simulado.

## 5. Mapa da biblioteca

### 5.1 Camadas

| Camada | Local | Conteúdo | Situação |
|---|---|---|---|
| A — Template oficial Meta | `crm_meta_templates` | 0 registros | vazia |
| A — Vínculo finalidade→template | `relationship_template_bindings` (tem `version`, `approved`) | 0 registros | vazia |
| B — Texto operante | `src/lib/relationship/messages.ts` | 18 etapas | **fonte real do motor hoje** |
| B' — Espelho de gestão | `src/lib/relationship/internal-templates.ts` | deriva de `messages.ts` | derivado, sem duplicidade |
| C — Conteúdo/vídeo | `relationship_contents` | 17 itens ativos | fonte real dos vídeos |
| C' — Grupos declarados | `src/lib/relationship/content.ts` | 13 grupos | 5 sem conteúdo |
| D — E0 simulada | `src/lib/crm/e0-simulation.ts` | prefixo `[TESTE — E0 SIMULADA]` | camada de teste |

### 5.2 Mensagem por etapa

| Etapa | Finalidade | Fluxo | Texto | Grupo | Botão |
|---|---|---|---|---|---|
| E0 | primeiro_contato | entrada | código | — | portal |
| E0_V1 | primeiro_contato_portal | entrada via Portal | código | — | portal |
| E1 | segundo_contato | sem_resposta | código | E1 | conteúdo |
| E3 | terceiro_contato | sem_resposta | código | E3 | conteúdo |
| E4 | quarto_contato | sem_resposta | código | **null** | — |
| E12 | encerramento | sem_resposta | código | FINALIZACAO | conteúdo |
| V3 / V4 | visualização | visualizacao | código | — | — |
| R1 | reengajamento_1 | reengajamento | código | R1 | conteúdo |
| R2 | reengajamento_2 | reengajamento | código | R2 | conteúdo |
| R3 | encerramento | reengajamento | código | — | — |
| RE0 | reentrada_contato | reentrada | código | — | portal |
| RE1 | reentrada_criterios | reentrada | código | RE1 | conteúdo |
| RE2 | reentrada_estrutura | reentrada | código | RE2 | conteúdo |
| RE3 | reentrada_encerramento | reentrada | código | FINALIZACAO | conteúdo |
| RF0 / RF1 | esfriado | relacionamento_frio | código | — / FINALIZACAO | — / conteúdo |
| E30 | recontato tardio | sem_resposta | **sem texto** | — | desativada |
| E2 | — | — | não existe | grupo vazio | — |
| **E20 / E27** | — | — | **não existem** | grupos a criar | a definir |

### 5.3 Vídeos (17 ativos)

- **E1 (5)**: Democratização do acesso ao crédito · Desertos financeiros · Ecossistema de soluções Velox · O mercado financeiro está mudando · O mercado financeiro não é exclusividade dos grandes bancos
- **E3 (6)**: Blindagem patrimonial · Como avaliar uma franquia antes de investir · Complementar renda e elevar ticket · Estrutura e suporte ao franqueado · Home Office ou Loja Física · Suporte e consultoria ao franqueado
- **E4 (1)**: Franquia séria não vende promessa
- **R1 (1)**: Flávio — 11 meses de Velox
- **R2 (4)**: Começar sem garantia · Conte a sua própria história · Informação, ambiente e escolha · Objetivos, esforço e persistência

### 5.4 Realocações aprovadas (a executar na FASE 3, não agora)

| Vídeo | Grupo hoje | Passa a ter também | Duplicação |
|---|---|---|---|
| Conte a sua própria história | R2 | **FINALIZACAO** | não — mesmo registro, grupo adicional |
| Como avaliar uma franquia antes de investir | E3 | **RE1** | não |
| Estrutura e suporte ao franqueado | E3 | **RE2** | não |

Depois dessas associações, os grupos exigidos ficam assim: `FINALIZACAO` 1 · `RE1` 1 · `RE2` 1 · `E1` 5 · `E3` 6 · `R1` 1 · `R2` 4. **Nenhum grupo exigido fica vazio.** Nenhum conteúdo novo é criado.

### 5.5 Pendências registradas (sem ação agora)

- **E4**: o vídeo "Franquia séria não vende promessa" está cadastrado em E4, mas a mensagem E4 tem `contentGroup: null` — o conteúdo nunca é usado. Registrado para revisão posterior da mensagem E4, por decisão sua. **Nada será associado sem seu aval.**
- **E30**: integrada ao fluxo e desativada por não ter texto oficial. Continua desativada; nenhum texto será inventado.
- **E2** e **R3**: grupos declarados sem conteúdo e sem uso pelo motor.
- **E20 / E27**: grupos e textos inexistentes; serão criados na FASE 2/3 com texto aprovado por você.

### 5.6 Versionamento e snapshot

- **Versionamento**: as 17 mensagens com texto, mais E20, E27 e o texto futuro de E30.
- **Snapshot imutável no envio**: corpo renderizado + `template_id` + versão + `content_id` do vídeo anexado + primeiro nome usado. Vale para mensagens de etapa, E20 gerada e envio de remarketing.
- **Sem versionamento**: os vídeos em si — o snapshot guarda a referência e o item permanece.
- **Sem duplicidade de texto hoje**; ela nasceria ao popular `crm_meta_templates` sem retirar o texto do código. A migração deve mover, não copiar.

## 6. Dependências

```text
FASE 1 (higiene + identidade)
  └─ habilita → FASE 2 (instâncias)
        ├─ instância é pré-requisito de: pausa por E20, E20, E27, encerrar por OPORTUNIDADE
        └─ link 7 dias = instância (id) + token com TTL próprio
FASE 3 (biblioteca versionada)
  ├─ depende do mapa (seção 5) aprovado
  └─ snapshot depende de: instância + biblioteca versionada
FASE 4
  ├─ jornada consolidada (FASE 3) → eventos de remarketing
  └─ botão dinâmico → telefone em executive_profiles
```

Transversal: nada é apagado; toda estrutura nova é aditiva; o estado atual de cada lead vira a **instância 1**.

## 7. Riscos de regressão

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Camada de instância sobre `relationship_cadences` | Tabela nova aditiva; linha atual vira instância 1 com `executed_steps` preservado; leitura cai na linha antiga se não houver instância |
| Alto | RE0–RE3 assistidos | Se a AÇÃO DO DIA não for criada, o lead fica em silêncio — verificar que toda decisão prescrita gera item de fila |
| Médio | Encerrar por OPORTUNIDADE/COF | Etapa errada na origem silencia lead legítimo; registrar motivo e reabrir ao sair da etapa |
| Médio | AGENDAMENTO elegível | Aumenta o volume das ligações do dia; medir antes de ativar |
| Médio | Trava manual de nome/telefone | Por campo e reversível via "voltar a seguir origem" |
| Médio | TTL do token | E20 recebe caminho próprio; os links de 30 dias não são tocados |
| Baixo | Fim do `lead_sincronizado` | Evento puramente informativo |
| Baixo | Remoção do "Reenviar boas-vindas" e dos templates fictícios | Composer humano e Central de Templates permanecem |
| Baixo | Realocação de grupos da biblioteca | Associação aditiva; nenhum texto ou vídeo alterado |

## 8. Ordem de implementação (só após sua aprovação)

- **FASE 1 — Higiene e identidade**: fim dos eventos falsos de sincronização; PENDENTE só em NOVOS não processado; regra NOVOS+tag alimentando `resolveEntryFlow`; remoção do "Reenviar boas-vindas" e dos templates fictícios de cadência; AGENDAMENTO elegível; edição manual de nome/telefone com prioridade reversível e registro; primeiro nome do cadastro corrigido.
- **FASE 2 — Instâncias e E20**: camada de instância (estado atual = instância 1); OPORTUNIDADE/COF encerram e cancelam pendências; RE0–RE3 assistidos; GERAR E20 no card pausando a cadência corrente; E27 = +7 dias corridos exatos; link por instância com TTL de 7 dias corridos e página de expirado; finalização deslocada para dia útil quando cair no fim de semana.
- **FASE 3 — Biblioteca e jornada**: realocações da seção 5.4; criação de E20/E27 com texto aprovado; versionamento com versão ativa e histórico; snapshot no envio; jornada consolidada com prévia "…" e card completo; notas manuais e automáticas.
- **FASE 4 — Integrações**: eventos de remarketing na jornada compartilhada; telefone individual em `executive_profiles`; botão dinâmico "Falar com o Executivo"; resposta automática dentro da janela de 24h; agenda de retorno de oportunidade como prioridade máxima do dia.
