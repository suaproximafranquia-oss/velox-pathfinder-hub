# Auditoria Profunda do Estado Real — antes da PARTE B

Nada foi implementado, alterado ou migrado. Todas as afirmações vêm de leitura de arquivos e consultas ao banco nesta rodada.

---

## BLOCO 1 — DOMÍNIO E ARQUITETURA INSTITUCIONAL

**1–2. Diferenciação de host** — NÃO EXISTE para conteúdo.
O único mecanismo é `src/server/environment.server.ts`, que lê `getRequest().headers.get("host")` apenas para decidir homologação x produção (fail-closed: host desconhecido = produção). Nenhuma rota decide conteúdo por host.

**3–5. O que "/" serve hoje**: `src/routes/index.tsx`, a Home do Portal do Investidor Financeiro (hero, Manual, Revista, Estrutura, Princípios, Simulador, Gateway de identificação). Existe dependência real de que "/" é esse portal: `f.$slug.tsx`, `s.$slug.tsx`, `seg.$slug.tsx`, `origem.$channel.tsx` e `portal.convite.$token.tsx` **todos redirecionam para "/" com search de contexto**.
CONSEQUÊNCIA: trocar "/" por institucional sem tratar esses cinco redirects quebra links personalizados, links de campanha e o convite E20.

**4. Coexistência com /f** — VIÁVEL. `/f` é prefixo próprio, com layout neutro (`f.tsx`) e guard nos layouts operacionais. Desde que a ativação institucional dependa de host declarado (vazio por padrão), preview e localhost continuam idênticos.

**6. Quem depende de "/"**: os cinco redirects acima, mais toda a navegação interna da Home e os overlays.

**7. Acesso a /f/executivo, /f/crm, /f/remarketing, /f/portal-leads pelo domínio institucional** — hoje funcionam normalmente em QUALQUER host; o único filtro é `OperationalGuard` (sessão no navegador, `ssr: false`), que redireciona para `/f/executivo` quando não há sessão.

**8. 404 por host** — tecnicamente seguro, desde que feito no servidor e com host institucional explicitamente configurado. Risco: se o host de preview for interpretado como institucional, o time perde acesso ao Workspace.

**9. Rotas públicas que precisam continuar no domínio institucional**: `/origem/$channel`, `/portal/convite/$token`, `/f/$slug`, `/s/$slug`, `/seg/$slug`, `/e/$slug`, `/manual/*`, `/api/public/*` e o próprio Portal do Investidor.

**10. /origem/tiktok e /origem/meta** — QUEBRAM conceitualmente: hoje redirecionam para "/" com `?m=manual&o=TikTok&ch=tiktok`, contando que "/" seja o Portal. Se "/" virar institucional, precisam apontar para o novo endereço do Portal Financeiro.

---

## BLOCO 2 — LINKS PERSONALIZADOS

**11–13.** `src/routes/f.$slug.tsx` só faz `beforeLoad → redirect({to:"/", search:{e:slug, m:"manual", o:brand.origin, b:brand.key}})`. Não renderiza nada. Se "/" virar institucional, o investidor cai na página do Grupo em vez do Portal — **o link continua resolvendo, mas entrega a página errada**. É a decisão mais urgente do bloco.

**14. Confusão com rotas estáticas** — NÃO EXISTE. O roteador do TanStack prioriza segmentos estáticos sobre `$slug`.

**15–16. Slugs reservados** — BLOQUEIA PERSISTÊNCIA, não só a interface. `validateExecutiveSlug` (`src/lib/business-unit.ts`) normaliza (minúsculo, sem acento) e rejeita `executivo`, `crm`, `remarketing`, `portal-leads`. Chamada na UI (`f.executivo.usuarios.tsx:147`) **e** no ponto central de gravação (`src/lib/executive-auth.ts:345`, `saveUsers`). `safeExecutiveSlug` sobrou como alias deprecado, sem uso.
RESSALVA: a persistência dos usuários é `localStorage`, não banco — não há trava equivalente no servidor.

---

## BLOCO 3 — UNIDADE DE NEGÓCIO

**17–18.** `unitPath()` continua **sem uso real** (apenas definição e comentários). Restam **153 literais `/f/...`**.

**19.** Críticos: os `to=` de `Link`/`navigate` dentro do shell executivo e os 34 stubs legados de redirecionamento. Legítimos: comentários, textos de documentação e a própria definição do helper.

**20. Migrar tudo agora — NÃO RECOMENDADO.** `Link to=` é tipado por literal no TanStack; substituir por chamada de função perde a verificação de rota em 153 pontos, sem ganho funcional na Parte B. Recomendação: helper só em código novo e navegação dinâmica.

**21.** Nada depende hoje da diferença `/f` x `/s` x `/seg` além de `portal-brands` (marca/origem no redirect). Não há ambiente operacional Solar/Seguros.

---

## BLOCO 4 — PÁGINA INSTITUCIONAL

**22.** NÃO EXISTE página do Grupo. `universo.tsx` é institucional da Financeira, não do Grupo.

**23. Reaproveitável da Home atual**: shell visual, tipografia/paleta, cartões de capa (`assetUrl`), padrão de overlay (`portal-overlay-shell`). Não reaproveitar: Gateway de identificação, Simulador, Revista e a lógica de jornada — são do Portal Financeiro.

**24. Captação embutida na Home**: sim — Gateway (`gateway-overlay`), registro de telefone (`phone-registry-overlay`) e a leitura dos parâmetros `e/m/o/b/ch/lead`. Toda essa lógica precisa continuar viva no endereço que for o Portal Financeiro.

**25.** Sim, é possível criar a Home institucional sem interferir no Portal — desde que o Portal ganhe um endereço próprio e os cinco redirects apontem para ele.

---

## BLOCO 5 — CAPTAÇÃO FINANCEIRA / SOLAR / SEGUROS

**26–27. Financeira hoje**: formulário → `src/server/crm/lead-intake.server.ts` → `resolve_portal_identity` (SECURITY DEFINER, com `pg_advisory_xact_lock` por telefone e por e-mail, chave de identidade única, registro de conflito e de alternativas) → `portal_leads` (56 linhas). Deve permanecer exatamente assim, com GreenSales e reconciliação intocados.

**28–30. Solar/Seguros fora de `portal_leads`** — CONFIRMADO como necessário. `group_leads` **não existe** (zero referências no código, tabela ausente no banco). Estrutura mínima: modalidade, nome, telefone, e-mail, origem, data, status (NOVO/ATENDIDO), atendido_por, atendido_em — sem FK para leads financeiros, sem gatilhos financeiros.

**31. Modalidade sem confiar no navegador**: derivada da rota/handler no servidor (o handler de `/solar` grava "solar"), nunca de campo do formulário.

**32. Deduplicação cruzada** — resolvida por construção: a deduplicação financeira roda dentro de `resolve_portal_identity`/`portal_leads`. Tabela separada = zero chance de um lead Solar ser absorvido por um financeiro com o mesmo telefone.

**33–36. Acesso e estados** — NÃO DETERMINÁVEL PELO CÓDIGO, precisa de decisão. Tecnicamente: dois estados (NOVO/ATENDIDO) bastam; marcar como atendido é atualização de status + `atendido_por` + `atendido_em`; nunca excluir. Exclusão não é necessária e seria incoerente com a política de preservação do projeto.

---

## BLOCO 6 — AÇÕES DO DIA

**37. Fonte real**: `src/lib/agenda.functions.ts` lê três fontes — `workspace_agenda_events` (0 linhas), `portal_meetings` (somente leitura) e a função `agenda_cadence_tasks`, que consulta `crm_cadence_tasks` filtrando `status = 'pendente'` e `l.responsible_executive_id = current_executive_id()`.

**38. Por que só 5 tarefas**: `crm_cadence_tasks` tem 5 linhas no total e a função ainda filtra por `status = 'pendente'` e por responsável; `relationship_queue` (motor de mensagens) tem 24 itens e **não é lida pela Agenda**. Não é bug de exibição: são bases distintas.

**39–40. Fonte oficial** — hoje são duas, por finalidade: ligações em `crm_cadence_tasks`, mensagens em `relationship_queue`. Não há risco de disparo duplicado porque o canal `message` do motor antigo está desligado por configuração (`CADENCE_CONFIG.message.enabled = false`). O risco é de **leitura incompleta**, não de execução dupla.

**41–44.** Mensagens devem entrar por leitura da fila do motor novo (com etapa e data de vencimento, sem horário); ligações continuam vindo da função de cadência. Ações de cadência: data sem horário (já é assim — `startsAt/endsAt` nulos, faixa própria do dia). Compromissos e reuniões: com horário.

**45. Diferenciação interna** — já existe parcialmente: `AgendaItem.kind` = `compromisso | reuniao | acao`. Falta separar `acao` em ligação x mensagem.

**46–47. Rótulo D{n}** — sim, em `src/lib/agenda.functions.ts:96` (`D${t.step_day} · Ligação/Mensagem`). E `step_day` é tratado como identidade de etapa em `crm_cadence_tasks` (chave de conflito `lead_id,channel,cycle_date,step_day`), em `agenda_cadence_tasks` e em `buildCadenceQueue`.

---

## BLOCO 7 — IDENTIDADE DAS ETAPAS

**48.** Convivem os dois: `step_day` (inteiro) no motor de ligações; `step_key`/`step` (texto) na Biblioteca, nos envios e nos vínculos de conteúdo.

**49. Recomendação**: acrescentar `step_key` textual às tarefas de cadência **mantendo** `step_day` como está. Nada de reescrever histórico.

**50.** Sim — adotar E0/E1/E2/E3/E5/E6/E7/R0–R3/RF0/RF1 como identificação puramente textual, desacoplada de dias, é compatível com o modelo atual (a Biblioteca já é assim).

**51–52. Registros que dependem de E20/E27**: a Biblioteca tem os slots E20, E27, FINALIZACAO (vazios/inativos) e `relationship_e20_occurrences` está **vazia**. Como não há histórico E20 real, tanto faz tecnicamente; o caminho de menor risco é **manter E20/E27 como chave interna e exibir E6/E7 na interface**, evitando renomear colunas e funções.

---

## BLOCO 8 — E0

**53–57.** O E0 tem texto ativo na Biblioteca (496 caracteres) e caminho de envio pronto (`dispatch.server.ts` → `renderFromLibrary` → `crm_messages` com id determinístico anti-duplicidade). **Mas `crm_meta_templates` está vazia (0 linhas)** e o motor está com `virtualTemplates: E0_SIMULATION_ENABLED` — enquanto a simulação estiver ligada, nada sai de verdade. Falta: cadastrar o template Meta aprovado e desligar a simulação. Manter o E0 como único envio automático da primeira cadência é coerente com o desenho atual.

---

## BLOCO 9 — E1/E2/E3/E5 E CONTEÚDO

**58–59. Com texto ativo (V1)**: E0, E0_V1, E1, E3, E4, E12, V3, V4, R1, R2, R3, RE0, RE1, RE2, RE3, RF0, RF1. **Vazios e inativos**: E20, E27, FINALIZACAO. **Não existem**: E2, E5, E6, E7, R0.

**60. Bloqueio correto** — sim: `renderFromLibrary` devolve `ok:false` com "Etapa X sem versão ativa na Biblioteca — envio bloqueado". Nada é inventado.

**61–66. Conteúdo complementar**: `relationship_step_content_bindings` (vínculo declarado etapa → conteúdo em `relationship_contents`, 17 itens); o motor consulta pela etapa, nunca por nome de arquivo ou posição. Sem vínculo, sorteia dentro do grupo de conteúdo autorizado. **O banco permite apenas UM vínculo ativo por etapa (índice único)** — cinco vídeos E1 hoje não são possíveis como vínculos ativos. Há `active` no vínculo e no conteúdo; trocar o conteúdo vinculado muda o próximo envio sem tocar no texto. A distinção obrigatório x opcional existe indiretamente (`requires_video` na Biblioteca).

---

## BLOCO 10 — NOMES

**67–70.** `src/lib/relationship/names.ts` está em uso real: o envio passa por `dispatch.server.ts` → `renderFromLibrary` → `renderMessageSpec`, que resolve `{{nome_investidor}}` **somente com nome confirmado**; e `src/server/crm/automation.server.ts:101` aplica `looksLikeName ? firstName : NEUTRAL_TREATMENT`. Há tratamento de nome composto (`compoundTreatment`) e checagem de plausibilidade. Não existe adivinhação nem dicionário de nomes. Risco residual: um nome plausível porém errado na origem (ex.: apelido) seria usado.

---

## BLOCO 11 — E6 / APRESENTAÇÃO DIGITAL

**71–85.** Infraestrutura completa em `src/server/relationship/e20.server.ts` + `relationship_e20_occurrences` / `relationship_e20_accesses` + rota `/portal/convite/$token` (`ssr: false`):
- token aleatório URL-safe de 24 bytes, individual por ocorrência;
- validade de exatamente 7 dias corridos contados do instante da geração (`SEVEN_DAYS_MS`), mais checkpoint em +7 dias e finalização no dia útil seguinte;
- nova emissão encerra a anterior com motivo `encerrada_por_nova` e abre nova instância de cadência (OPORTUNIDADE é terminal e bloqueia);
- vínculo ao `lead_id` real; registra `generated_at`, `generated_by`, `generated_by_name` e `generated_by_executive_id`;
- link vencido ou substituído não abre: a rota valida no servidor e mostra explicação legível na própria página (não há tela separada de "expirado"), sem entregar conteúdo interno.
FALTA: o botão "Gerar apresentação digital" no card do investidor e o estado pós-geração ("copiar link/mensagem"), além do **texto oficial da E20, que está vazio e inativo**.
Local tecnicamente mais seguro para o botão: a ficha do investidor (`src/components/crm/crm-lead-ficha.tsx`), chamando a função de servidor existente — nunca gerando token no cliente.
O token não é pessoal-intransferível: quem tiver o link entra. Se isso for inaceitável, é decisão nova.

---

## BLOCO 12 — E7

**86–88.** `completeCadenceTask` (`src/server/crm/cadence.server.ts:183`) faz `const outcome = input.outcome ?? "SIM"` — **o padrão "SIM" ainda existe**. Grava upsert em `crm_cadence_tasks` com status DONE + `outcome` e insere `CADENCE_TASK_DONE` em `crm_lead_events`. Enquanto a tarefa não é concluída (`status ≠ DONE`, `outcome` nulo) o "ainda não informado" É distinguível — mas no instante da conclusão sem informar desfecho, o sistema **grava "atendeu" sem que isso tenha acontecido**.

**89.** Sim, a regra E6 → +7 dias → ligação → cancelar/liberar E7 é implementável sem segundo motor: reaproveita `checkpoint_due_at` da ocorrência, a fila de ligações existente e o campo `outcome`.

**90.** Não existe hoje fluxo que dispare E7 automaticamente — E7 sequer existe na Biblioteca.

---

## BLOCO 13 — REENGAJAMENTO E RETOMADA

**91–95.** No banco (todos V1 ativos): R1, R2, R3, RE0, RE1, RE2, RE3, RF0, RF1. **R0 não existe.**
RF0 = `relacionamento_frio_retomada` ("tínhamos combinado um horário e não evoluímos… me envie duas opções"); RF1 = `relacionamento_frio_encerramento`, com conteúdo do grupo FINALIZACAO. Ou seja, RF0/RF1 estão sim ancorados em **agendamento não concretizado**, enquanto RE0–RE3 tratam do lead que voltou pela origem. A diferença é semântica (chave + texto), não uma máquina de estados separada.

**96–97.** `NON_AUTOMATED_STAGES = [novos, agendamento, video, oportunidade]` e `TERMINAL_STAGES = [oportunidade]` — agendamento e oportunidade são estados distintos e OPORTUNIDADE é terminal, então manter oportunidade fora do fluxo é o comportamento atual, não algo a construir.

---

## BLOCO 14 — NOTAS DO EXECUTIVO

**98–100.** `crm_lead_events` (lead_id, type, message, data JSON, created_at) é alimentado por conclusão de cadência, tentativa manual por WhatsApp e serviço de leads. `relationship_message_sends` grava o snapshot do envio (rendered_body, template_body, library_id/version/code, etapa, ator, conteúdo, canal, `simulated`). A consolidação por lead já existe em `src/server/relationship/journey.server.ts`, com whitelist relacional, deduplicação lógica e separação Jornada x Auditoria Técnica.

**101–103.** A distinção ligação x mensagem é derivável do tipo/origem, mas **não há hoje card clicável com preview truncado + modal**; é trabalho de apresentação em `src/components/crm/crm-lead-journey.tsx`, sem dependência de banco. Nota manual do executivo não existe como tipo próprio.

**104–105.** Sim: o histórico exibe `rendered_body`, o texto efetivamente enviado, com `library_version` congelada. Editar E3 para V2 amanhã não altera o envio de ontem.

**106.** A lacuna estrutural é só a nota manual; o resto é interface.

---

## BLOCO 15 — CENTRAL DE TEMPLATES

**107–110.** `relationship_message_library`: id, step_key, code, title, purpose, body, version, active, supersedes_id, content_group, button_kind, requires_template, requires_video, meta_template_name, scope, notes, created_by/created_by_name, timestamps. Uma única versão ativa por etapa (índice único); editar cria a próxima versão e desativa a anterior; o passado fica preservado pelo snapshot do envio. Etapa, finalidade, status, versão e conteúdo são todos identificáveis. Hoje **todas as 20 linhas estão em V1** — o caminho V1→V2 existe no código mas nunca foi exercido em produção.

**111–112.** Recomendação técnica: E0 aparece na Central como a linha que **aponta** para o template Meta (`meta_template_name`, `requires_template`), e o cadastro do template aprovado permanece em `crm_meta_templates`. As demais etapas são biblioteca operacional do motor, fora do domínio Meta.

**113. Slots a criar**: E2, E5, E6, E7, R0 — e preencher E20, E27, FINALIZACAO, hoje vazios.

---

## BLOCO 16 — AGENDA

**114–118.** Mostra compromissos próprios, reuniões de `portal_meetings` em modo somente leitura com id prefixado (`meeting:`, canceladas ignoradas — sem duplicação) e ações de cadência. **Só ligações**: as mensagens do motor novo não são lidas. Prioridades `maxima | media | minima` com check no banco; ações entram como `minima`, sem horário.

**119. Fuso** — INCOERENTE. Servidor agrupa por `America/Sao_Paulo`; `agenda-dock.tsx` cria com `new Date("YYYY-MM-DDTHH:mm:00")` e exibe com `toLocaleString("pt-BR")` **sem `timeZone`** — ambos no fuso do navegador.

**120–122.** Interseção real é verificada: no banco, `EXCLUDE USING gist (executive_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE priority='maxima'`, mais `ends_at > starts_at` — isso protege contra gravação concorrente **entre eventos**. O conflito **evento x reunião** é checado apenas em código, antes da gravação: sujeito a corrida.
Observação: a proteção é por executivo; dois executivos diferentes podem, por desenho, ocupar o mesmo horário.

**123–124.** A Agenda **não aceita** identificador do cliente: resolve `current_executive_id()` no servidor em todas as funções, e a RLS tem quatro políticas (`authenticated`) restringindo ver/criar/editar/remover aos próprios compromissos.

---

## BLOCO 17 — SEGURANÇA E RLS

**125.** Já protegidas e reutilizáveis: `workspace_agenda_events`, `portal_leads`, `crm_cadence_tasks`, `relationship_*`. A nova `group_leads` precisará de GRANTs e políticas próprias desde a criação.

**126.** Não há ponto conhecido onde o frontend informe `executive_id` e leia dados alheios: a identidade vem de `current_executive_id()` (SECURITY DEFINER sobre `executive_profiles`). Exceção controlada: `agenda_cadence_tasks` aceita `_executive_id`, **mas só honra o parâmetro se o chamador for admin**.

**127–130.** NÃO DETERMINÁVEL PELO CÓDIGO — precisa de decisão. Hoje o modelo é: admin vê tudo; manager (Gestora) vê leads; executivo vê o que é dele (`can_access_investor`). O isolamento de Solar/Seguros por modalidade não existe e precisa ser definido.

---

## BLOCO 18 — PRESERVAÇÃO

**131–133.** A Parte B **não exige** alterar `portal_leads`, e a recomendação é não tocar: Solar/Seguros em tabela própria resolve isolamento, deduplicação e RLS de uma vez.

**134–136.** GreenSales, deduplicação financeira e Backup só quebram se `portal_leads` for alterada ou se as novas filas escreverem nela. Mantendo a separação física, o risco é nulo. Lembrete: `portal_leads` tem gatilhos de blindagem (`guard_lead_delete`, `guard_lead_truncate`) que bloqueiam exclusão e esvaziamento.

**137.** Sim: qualquer link personalizado já publicado (`/f/{slug}`) pode passar a abrir a página errada se "/" virar institucional sem redirecionar o destino.

**138.** Risco baixo na E6: a estrutura está pronta e sem uso (0 ocorrências); o que toca o Portal é o destino do convite após o resgate.

---

## BLOCO 19 — DECISÕES E MATRIZ

**139. Precisam de decisão humana**: host institucional; destino do Portal Financeiro e dos redirects; textos oficiais das etapas; regra de seleção com vários conteúdos por etapa; acesso às filas Solar/Seguros; se a Agenda passa a ler mensagens.

**140. Resolvo tecnicamente sem perguntar**: remover o padrão "SIM" do desfecho; fixar `America/Sao_Paulo` na Agenda; criar os slots vazios da Biblioteca; criar `group_leads` com RLS; adicionar `step_key` textual às tarefas; diferenciar ligação x mensagem no item de agenda.

**141. ALTO risco de regressão**: mudar o que "/" serve; migrar os 153 literais para `unitPath()`; renomear E20/E27; qualquer escrita nova em `portal_leads`; desligar a simulação do E0 sem template Meta cadastrado.

**142. BAIXO risco**: fuso da Agenda (tabela vazia); slots novos na Biblioteca; `group_leads` (tabela nova); botão da E6; cards clicáveis na Jornada.

**143–145. Ordem segura**:
1. Migração de fundação: `group_leads` + `step_key` textual nas tarefas + slots novos da Biblioteca (+ nota manual, se aprovada).
2. Correções sem interface: padrão de `outcome`, fuso da Agenda, conflito evento x reunião.
3. Filas Solar/Seguros (tela própria).
4. Ações do Dia unificadas (ligação + mensagem) e Agenda lendo a fonte única.
5. E6: botão, texto e encadeamento com a ligação de +7 dias; depois E7.
6. Por último, e só com host definido: institucional do Grupo e realocação do Portal Financeiro.
As migrações do passo 1 precedem qualquer frontend que dependa delas.

**146. REUTILIZAR**: `relationship_message_library`, `relationship_message_sends`, `relationship_step_content_bindings`, `relationship_contents`, `relationship_e20_occurrences`/`_accesses` + `/portal/convite/$token`, `workspace_agenda_events` + EXCLUDE, `agenda_cadence_tasks`, `current_executive_id`, `can_access_investor`, `set_lead_operational`, `crm_lead_events`, `journey.server.ts`, `names.ts`, `business-unit.ts`, `OperationalGuard`.

**147. NÃO REUTILIZAR**: `portal-leads-board` para Solar/Seguros; `src/lib/crm/templates.ts` (textos legados); o canal `message` do motor antigo; `resolve_portal_identity` para leads Solar/Seguros.

**148. Isolar/desligar antes**: nada precisa ser desligado — o canal de mensagens do motor antigo já está desativado por configuração. Atenção apenas à simulação do E0, que deve permanecer ligada até haver template Meta.

**149. Contradições com o código atual**: "Ações do Dia" x componente que só faz ligações; vocabulário E-n x rótulo `D{n}`; "/" institucional x cinco redirects que dependem de "/" ser o Portal.

---

## MATRIZ FINAL

| PONTO | ESTADO ATUAL | DECISÃO NECESSÁRIA |
|---|---|---|
| Host institucional | Sem diferenciação por host | ⚠️ Qual host e o que serve "/" |
| Destino dos redirects (`/f/$slug`, `/origem/*`, convite) | Todos apontam para "/" | 🔴 Definir novo endereço do Portal |
| Slugs reservados | Rejeitam na UI e na persistência | ✅ |
| `unitPath()` / 153 literais | Helper sem uso | ⚠️ Não migrar em massa (recomendado) |
| Agenda x motor de mensagens | Lê só ligações (5 tarefas) | ⚠️ Fonte única |
| Rótulo D{n} / `step_day` | Ainda em uso | 🔴 Adicionar `step_key` textual |
| Slots E2/E5/E6/E7/R0 | Não existem | 🔴 Criar + textos oficiais |
| E20/E27/FINALIZAÇÃO | Slots vazios e inativos | 🔴 Textos oficiais |
| `crm_meta_templates` | Vazia; simulação E0 ligada | ⚠️ Cadastrar template Meta |
| Versionamento + snapshot | Completo (`supersedes_id`, `rendered_body`) | ✅ |
| Vários conteúdos por etapa | Um vínculo ativo (índice único) | ⚠️ Regra de seleção |
| Tratamento de nomes | `names.ts` em uso, conservador | ✅ |
| E6 infraestrutura (token, 7 dias, expiração) | Pronta, 0 ocorrências | ✅ |
| Botão "Gerar apresentação digital" | Não existe | ⚠️ Local: ficha do investidor |
| `outcome` padrão "SIM" | Ativo | 🔴 Remover padrão |
| Notas do Executivo | Eventos + snapshot existem; nota manual não | ⚠️ Criar tabela? |
| `group_leads` | Não existe | 🔴 Criar isolada |
| RLS Solar/Seguros | Inexistente | ⚠️ Quem vê e atende |
| Agenda: EXCLUDE no banco | Implementado (prioridade máxima) | ✅ |
| Agenda: conflito com reuniões | Só em código | ⚠️ Levar ao banco? |
| Agenda: fuso horário | Navegador na criação/exibição | 🔴 Fixar America/Sao_Paulo |
| Identidade da Agenda | `current_executive_id()` no servidor | ✅ |
| Blindagem de `portal_leads` | Gatilhos ativos | ✅ Não tocar |
