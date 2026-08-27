# Consolidação da Parte 1 — Templates, Biblioteca e Jornada × Engajamento

Respostas às três perguntas e o que muda em cada frente. Nada do Portal dos Leads é tocado; nenhum dado é apagado.

## 1. Central de Templates — confirmado

Sim: a Biblioteca de Conteúdo permanece; a Central de Templates deixa de participar da lógica normal da cadência.

Situação atual verificada: o motor já decide `requiresTemplate = !windowOpen` (`src/lib/relationship/decide.ts`), ou seja, template só é exigido quando a janela de 24h está fechada. Existe também a trava `config.requireOfficialTemplate` e o modo `virtualTemplates` usado na homologação. Portanto a regra já está correta no núcleo — o que sobra é a exigência operacional na interface.

O que muda:
- A Central de Templates sai do menu operacional e passa a ser uma área técnica restrita (administração), contendo apenas os templates realmente obrigatórios para reabertura de janela.
- Nenhuma etapa de conteúdo (E1, E2, E3, E15, E22…) passa a exigir cadastro de template para poder ser enviada dentro da janela.
- A integração técnica com a Meta (envio por template, binding, versão) permanece intacta.
- Quando a janela estiver fechada e não houver template para aquele propósito, o motor continua bloqueando o envio e explicando o motivo — sem inventar template.

## 2. Biblioteca de Conteúdo — confirmado

Sim: a estrutura correta é ETAPA → mensagem → conteúdos elegíveis, e o dia de disparo fica exclusivamente na camada de cadência.

O que muda:
- A Biblioteca passa a ser organizada por ETAPA (E0, E1, E2, E3, E15, E22, E30 e as etapas de reengajamento/finalização já existentes), com rótulos que descrevem a finalidade, sem qualquer referência a "dia".
- A mensagem da etapa vem da Biblioteca de Mensagens versionada (já existente); o conteúdo complementar é vinculado à etapa e pode ser nenhum, um ou vários.
- Seleção entre conteúdos elegíveis: não repetir o que o investidor já recebeu enquanto houver alternativa; havendo um único conteúdo, ele é reutilizado normalmente. Essa regra já existe em `src/lib/relationship/content.ts` e será mantida.
- O uso do conteúdo é registrado no próprio registro da mensagem enviada (etapa, texto congelado, conteúdo/link). Não será criada nenhuma estrutura paralela redundante só para "qual vídeo foi usado".
- Etapa sem conteúdo é um estado válido: o motor envia a mensagem normalmente.
- Nenhum vínculo, conteúdo ou arquivo existente é removido; apenas reorganizados e renomeados conceitualmente.

## 3. Jornada × Engajamento — confirmado

Sim, como regra estrutural: ação do executivo nunca é engajamento do investidor. Só entra como atividade/engajamento aquilo produzido pelo investidor.

Situação atual verificada: `executive-contact-dialog.tsx` emite `lead.status.changed` em contexto de abertura, e `src/lib/executive-data.ts` já filtra esse evento por gambiarra de leitura ("é emitido quando o card é aberto"). Ou seja, o evento errado continua sendo produzido e apenas escondido depois.

O que muda:
- Corrigir na origem: abrir card/ficha/conversa deixa de emitir qualquer evento de alteração de lead. O sinal de "card aberto" vira presença/telemetria interna, não evento de jornada.
- Remover o filtro corretivo em `executive-data.ts` assim que a origem parar de emitir.
- Três camadas explícitas e separadas:
  - Jornada do Investidor: entrada, mensagem enviada, ligação realizada/atendida/não atendida, material/apresentação/calculadora acessados, retorno, reentrada, mudança real de etapa.
  - Engajamento: interações mensuráveis do investidor (acesso ao Portal, abertura de material, clique em link, acesso a conteúdo externo) — alimentam o indicador, sem poluir a jornada.
  - Auditoria Técnica: sincronizações, logs, decisões do motor, simulações. Continua completa e acessível pelo alternador já existente na ficha.
- Eventos de "atividade no portal" repetidos passam a ser agrupados por sessão/recurso na Jornada (um item legível), mantendo cada ocorrência individual na camada de engajamento/auditoria.
- Semântica distinta preservada: MENSAGEM ENVIADA ≠ VISUALIZADA ≠ LINK CLICADO ≠ RECURSO ACESSADO.

## Detalhes técnicos

Arquivos previstos:
- `src/routes/executivo.templates.tsx` e config de módulos — reclassificar a Central de Templates como área técnica restrita.
- `src/lib/relationship/content.ts`, `src/routes/executivo.biblioteca.tsx` — reorganização por etapa, rótulos sem referência a dia.
- `src/components/shared/executive-contact-dialog.tsx`, `src/lib/executive-data.ts`, `src/lib/crm/timeline.ts` — parar de emitir evento de alteração ao abrir card e remover o filtro paliativo.
- `src/server/relationship/journey.server.ts` — agrupamento de atividades repetidas e classificação de camada.
- `src/lib/crm/portal-activity.ts`, `src/lib/portal-session.ts` — atividade do investidor roteada para engajamento.

Fora do escopo desta etapa: Portal dos Leads (intocável), configuração temporal da cadência, backup horário, nome manual/validação de nome — entram nos próximos blocos da consolidação.

Nenhuma migration destrutiva. Nenhum dado histórico apagado.
