# Validação Final — Regras Fechadas, Mapa da Biblioteca e Ordem de Implementação

Nada foi alterado: sem migration, sem código, sem dados, sem envio, sem mexer na biblioteca.

## 1. As 7 ambiguidades estão fechadas

| # | Decisão registrada | Impacto arquitetural |
|---|---|---|
| 1 | Kanban continua pela etapa mais avançada; a regra NOVOS+tag decide **só** cadência | `board.ts` não muda; a decisão nasce em função nova consumida pelo intake |
| 2 | Reengajamento reusa RE0–RE3 e passa a ser **assistido** (AÇÕES DO DIA) | Não cria motor novo; muda o despacho de RE0–RE3 de automático para prescrito |
| 3 | E20 **pausa** a cadência corrente | Estado `PAUSED` já existe em `CadenceState`; falta a instância |
| 4 | Qualquer executivo responsável gera E20, sem aprovação | Autorização pelo responsável atual, já resolvível |
| 5 | Link E20 com TTL próprio de 7 dias, sobre a infraestrutura de token atual | `portal-token.server.ts` hoje tem TTL fixo de 30 dias e assina só `investorId` |
| 6 | MANUAL > GREENSALES, com "voltar a seguir origem" | Trava reversível por campo, não permanente |
| 7 | Mapa da biblioteca antes da FASE 3 | Entregue abaixo |

Nenhuma dessas decisões conflita entre si. As regras gerais reiteradas na sua mensagem estão todas contempladas.

## 2. Conflitos que permanecem entre as regras e a arquitetura atual

1. **Uma linha de cadência por lead.** `relationship_cadences` tem chave por (scope, lead). Sem uma camada de instância, E20 recorrente e "pausar a cadência corrente enquanto a E20 roda" não coexistem. É o único bloqueio estrutural real.
2. **RE0–RE3 hoje são despachados pelo motor**, não prescritos. Tornar assistido exige que a decisão do motor gere um item de AÇÃO DO DIA em vez de um envio.
3. **`ELIGIBLE_STAGE_KEYS = ["zero_contato","frio"]`** em `src/lib/crm/cadence.ts` — AGENDAMENTO está fora, contra a regra validada.
4. **Não existe encerramento por OPORTUNIDADE/COF.** Os estados terminais atuais são por etapa (E12/E30) e por ação manual.
5. **`portal-token.server.ts` assina `investorId.exp`** com TTL global de 30 dias. E20 precisa de TTL e identificador por instância, sem alterar os tokens atuais.
6. **`/e/$slug`, `/s/$slug`, `/f/$slug` apenas redirecionam para a Home** com contexto de executivo/marca — não validam nada e não expiram. O E20 exige uma rota que gateie o conteúdo.
7. **Telefone do executivo**: `src/lib/executive-auth.ts` tem `phone`/`whatsapp` por usuário, mas os 7 executivos oficiais estão todos com `5517997727337` e o dado vive no cadastro local, não em `executive_profiles`.
8. **`upsertLead` sobrescreve nome/telefone** a cada sync e grava `lead_sincronizado` mesmo sem mudança.
9. **Sem versionamento de texto**: `relationship_template_bindings` tem coluna `version`, mas a tabela está **vazia**, e `crm_meta_templates` também está **vazia**. Hoje o motor roda inteiramente sobre os textos fixos de `messages.ts` em modo simulado.

## 3. MAPA DA BIBLIOTECA (estado atual verificado)

### 3.1 Onde as mensagens vivem hoje

| Camada | Arquivo/tabela | Conteúdo | Situação |
|---|---|---|---|
| A — Texto oficial Meta | `crm_meta_templates` | **0 registros** | vazia |
| A — Vínculo finalidade→template | `relationship_template_bindings` (tem `version`, `approved`) | **0 registros** | vazia |
| B — Texto operante | `src/lib/relationship/messages.ts` (`HOMOLOGATION_MESSAGES`) | 18 etapas, textos completos | **fonte real usada pelo motor hoje** |
| B' — Espelho de gestão | `src/lib/relationship/internal-templates.ts` | Deriva de `messages.ts`, adiciona rótulo/variáveis, `metaTemplateId: null` | derivado, não é segunda fonte |
| C — Conteúdo/vídeo | `relationship_contents` | 17 itens ativos | fonte real dos vídeos |
| C' — Grupos declarados | `src/lib/relationship/content.ts` (`CONTENT_GROUPS`) | 13 grupos | 5 grupos sem conteúdo |
| D — Texto de E0 simulada | `src/lib/crm/e0-simulation.ts` | prefixo `[TESTE — E0 SIMULADA]` | camada de teste |

### 3.2 Mensagem por etapa

| Etapa | Finalidade (`purpose`) | Fluxo | Texto está em | Grupo de conteúdo | Botão |
|---|---|---|---|---|---|
| E0 | primeiro_contato | sem_resposta / entrada | código | — | portal |
| E0_V1 | primeiro_contato_portal | entrada via Portal | código | — | portal |
| E1 | segundo_contato | sem_resposta | código | E1 | conteúdo |
| E3 | terceiro_contato | sem_resposta | código | E3 | conteúdo |
| E4 | quarto_contato | sem_resposta | código | — | — |
| E12 | encerramento | sem_resposta | código | FINALIZACAO | conteúdo |
| V3 | visualizacao_sem_resposta | visualizacao | código | — | — |
| V4 | visualizacao_firme | visualizacao | código | — | — |
| R1 | reengajamento_1 | reengajamento | código | R1 | conteúdo |
| R2 | reengajamento_2 | reengajamento | código | R2 | conteúdo |
| R3 | reengajamento_encerramento | reengajamento | código | — | — |
| RE0 | reentrada_contato | reentrada | código | — | portal |
| RE1 | reentrada_criterios | reentrada | código | RE1 | conteúdo |
| RE2 | reentrada_estrutura | reentrada | código | RE2 | conteúdo |
| RE3 | reentrada_encerramento | reentrada | código | FINALIZACAO | conteúdo |
| RF0 | retomada_esfriado | relacionamento_frio | código | — | — |
| RF1 | encerramento_esfriado | relacionamento_frio | código | FINALIZACAO | conteúdo |
| E30 | recontato tardio | sem_resposta | **não existe texto** | — | desativada |
| **E2** | — | — | **não existe** | grupo declarado, vazio | — |
| **E20** | — | — | **não existe** | não existe grupo | a criar |
| **E27** | — | — | **não existe** | não existe grupo | a criar |

### 3.3 Vídeos cadastrados (`relationship_contents`, 17 ativos)

- **E1 (5)**: Democratização do acesso ao crédito · Desertos financeiros · Ecossistema de soluções Velox · O mercado financeiro está mudando · O mercado financeiro não é exclusividade dos grandes bancos
- **E3 (6)**: Blindagem patrimonial · Como avaliar uma franquia antes de investir · Complementar renda e elevar ticket · Estrutura e suporte ao franqueado · Home Office ou Loja Física · Suporte e consultoria ao franqueado
- **E4 (1)**: Franquia séria não vende promessa
- **R1 (1)**: Flávio — 11 meses de Velox
- **R2 (4)**: Começar sem garantia · Conte a sua própria história · Informação, ambiente e escolha · Objetivos, esforço e persistência

### 3.4 Lacunas e realocações necessárias

| Achado | Detalhe |
|---|---|
| **Grupos exigidos sem conteúdo** | `FINALIZACAO`, `RE1`, `RE2` são exigidos por E12/RE1/RE2/RE3/RF1 e estão **vazios** — essas etapas não conseguem ser enviadas hoje |
| **Vídeo de finalização em grupo errado** | "Conte a sua própria história" é o vídeo padrão de finalização declarado em `content.ts` (`CLOSING_CONTENT_URL`), mas está cadastrado apenas em **R2**. Precisa ser associado também a `FINALIZACAO` (o mesmo registro, sem duplicar) |
| **Vídeos de reentrada em E3** | "Como avaliar uma franquia antes de investir" e "Estrutura e suporte ao franqueado" correspondem exatamente aos rótulos de RE1 e RE2. Devem ganhar também esses grupos |
| **E4 anexa conteúdo?** | Há 1 vídeo em E4, mas a mensagem E4 tem `contentGroup: null` — o conteúdo está cadastrado e nunca é usado |
| **Grupos declarados sem uso** | `E2`, `R3` — reservados, sem conteúdo e sem mensagem |
| **Grupos ausentes** | `E20`, `E27`, `E30`, `RF0`, `REENGAJAMENTO` |
| **Duplicidade de texto** | Não há: `internal-templates.ts` deriva de `messages.ts`. A duplicidade futura nasceria ao popular `crm_meta_templates` sem retirar o texto do código |

### 3.5 O que precisa de versionamento e snapshot

- **Versionamento (versão ativa + histórico)**: todas as 17 mensagens com texto, mais E20, E27 e o texto pendente de E30.
- **Snapshot no envio (imutável)**: corpo renderizado + `template_id` + `version` + `content_id` do conteúdo anexado + primeiro nome usado. Vale para toda mensagem de etapa, para a E20 gerada e para o envio de remarketing.
- **Não precisa de versionamento**: os vídeos em si (`relationship_contents`) — o snapshot guarda a referência do item usado, e o item permanece.

## 4. Dependências a respeitar

```text
FASE 1 (higiene + identidade)
  └─ habilita → FASE 2 (instâncias)
        ├─ instância é pré-requisito de: pausar cadência, E20, E27, encerrar por OPORTUNIDADE
        └─ link 7 dias depende de: instância (id) + token adaptado
FASE 3 (biblioteca versionada)
  ├─ depende do MAPA (item 3) aprovado
  └─ snapshot depende de: instância + biblioteca versionada
FASE 4 (remarketing, telefone, janela 24h)
  ├─ jornada consolidada depende da FASE 3
  └─ botão dinâmico depende de: telefone em executive_profiles
```

Regras transversais: identidade sempre `external_source + external_id`; telefone normalizado só como dedup auxiliar; nada é apagado; toda estrutura nova é aditiva e o estado atual de cada lead vira a **instância 1**.

## 5. Riscos de regressão

| Risco | Onde | Mitigação |
|---|---|---|
| Alto | Introduzir instâncias sobre `relationship_cadences` | Tabela nova aditiva; a linha atual vira instância 1 com `executed_steps` preservado; motor lê a instância ativa e cai na linha antiga se não houver |
| Alto | RE0–RE3 virar assistido | Se a AÇÃO DO DIA não for criada, o lead fica em silêncio — exige verificação de que toda decisão prescrita gera item de fila |
| Médio | Encerrar por OPORTUNIDADE | Etapa errada vinda da origem silencia lead legítimo; registrar motivo e reabrir ao sair da etapa |
| Médio | AGENDAMENTO elegível | Aumenta o volume das ligações do dia; medir antes de ativar |
| Médio | Trava manual de nome/telefone | Correção legítima da origem deixa de entrar; por isso a trava é por campo e reversível |
| Médio | TTL do token | Mexer no TTL global quebraria os links de 30 dias em uso; o E20 precisa de caminho próprio |
| Baixo | Parar de gravar `lead_sincronizado` | Evento puramente informativo |
| Baixo | Remover "Reenviar boas-vindas" e templates fictícios do composer | Conversa humana e Central de Templates permanecem |

## 6. Ordem recomendada de implementação

- **FASE 1 — Higiene e identidade** (sem estrutura nova): parar eventos falsos de sincronização; PENDENTE só em NOVOS não processado; regra NOVOS+tag alimentando `resolveEntryFlow`; remoção do "Reenviar boas-vindas" e dos templates fictícios de cadência; AGENDAMENTO elegível; edição manual de nome/telefone com prioridade reversível e registro no histórico; primeiro nome derivado do cadastro corrigido.
- **FASE 2 — Instâncias e E20**: camada de instância (estado atual = instância 1); OPORTUNIDADE/COF encerram e cancelam pendências; RE0–RE3 assistidos nas AÇÕES DO DIA; ação GERAR E20 no card pausando a cadência corrente; E27 derivado (+7 dias corridos, deslocado para dia útil); link E20 por instância com TTL de 7 dias e página de expirado.
- **FASE 3 — Biblioteca e jornada**: reorganização aprovada do mapa (realocação de grupos, criação de E20/E27, preenchimento de FINALIZACAO/RE1/RE2); versionamento com versão ativa e histórico; snapshot no envio; jornada consolidada com prévia "…" e card de conteúdo completo; notas manuais e automáticas separadas dos eventos.
- **FASE 4 — Integrações**: eventos de remarketing na jornada compartilhada (mesma pessoa, ambiente separado); telefone individual em `executive_profiles`; botão dinâmico "Falar com o Executivo"; resposta automática dentro da janela de 24h; agenda de retorno de OPORTUNIDADE como prioridade máxima do dia.

## 7. O que ainda precisa da sua decisão (não bloqueia a FASE 1)

1. Aprovar as **realocações de grupo** da seção 3.4 (associar o vídeo de finalização a `FINALIZACAO`, e os dois vídeos a `RE1`/`RE2`) — é associação, não duplicação e não muda texto.
2. `FINALIZACAO`, `RE1` e `RE2` continuam sem conteúdo próprio além dessas realocações? Se sim, as etapas de encerramento seguem bloqueadas até haver material.
3. E4 deve passar a anexar o vídeo já cadastrado, ou o vídeo sai de E4?
