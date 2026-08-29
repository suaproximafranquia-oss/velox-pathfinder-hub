# Regra de negócio da E0 — comparação entre a regra antiga e a atual

Investigação feita no código, no histórico de commits e nos registros do banco. Nada foi alterado.

## O que o histórico mostra

| Momento | Estado do código |
|---|---|
| até 28/08 23:51 | E0 montada por `buildWelcomeMessage` e enviada como **texto livre** (`sendWhatsappText`). Slug e WhatsApp do executivo eram **opcionais** (havia fallback de executivo padrão e de link institucional). |
| 28/08 23:51 (`f518d394`) | Nascem `e0-destinations.ts` e `destinations.server.ts` — conceito de destinos por lead. |
| 28/08 23:52 (`316201ae`) | Nasce `e0.server.ts`: E0 passa a ser **template oficial da Meta com botões dinâmicos**. Já entra com `portalRequired: true` e `contactRequired: Boolean(contactButton)` (contato só bloqueava se o botão existisse no template). |
| 29/08 01:40 (`20e7863e`) | **Alteração que fechou o bloqueio**: `contactRequired: true` fixo, com o comentário "Refino Final §2 — requisito operacional da E0". Nesse mesmo commit entra o log `e0_bloqueada`. |

Os leads de hoje (Rodrigo 09:44, Maia 11:50, Lucas 13:56) são todos posteriores ao commit das 01:40 — nenhum passou pela regra antiga.

## Fatos adicionais verificados no banco

- `relationship_message_sends` **não tem nenhuma linha de E0**: nenhuma E0 chegou a passar pelo caminho novo.
- `crm_meta_templates` está **vazia** (nenhum template com `purpose = 'primeiro_contato'`). Sem esse cadastro, mesmo destravando os destinos, a entrega real é impossível — o código devolve "Template oficial da Meta para a E0 não cadastrado".
- A "última E0 real" de 28/08 20:58 (gs_58707) **não foi entregue**: a timeline registra "Entrega externa pendente: Canal oficial do WhatsApp não configurado para este ambiente". O mesmo vale para gs_58705. Antes disso, tudo estava marcado como "TESTE — E0 SIMULADA".
- A versão ativa da E0 na Biblioteca tem `button_kind = 'portal'`. Em `renderMessageSpec`, `button === "portal"` sem link ainda bloqueia com "Variável {{link_portal}} sem valor" — ou seja, **remover só o `portalRequired` não destrava**: a Biblioteca continua exigindo o link.

## Respostas objetivas

**REGRA ANTIGA** (até 28/08 23:51): E0 = texto livre montado no CRM, enviado por `sendWhatsappText`. Sem executivo responsável válido usava-se executivo padrão; sem slug usava-se `materialUrl` ou link institucional. Nada bloqueava: a mensagem sempre era registrada em `crm_messages` + `crm_timeline`, e a falha de canal virava apenas "entrega pendente".

**REGRA ATUAL**: E0 = template aprovado da Meta com dois botões de URL cujos sufixos são resolvidos por lead. Exige, antes de qualquer coisa: executivo responsável com perfil, `executive_profiles.whatsapp` válido e `responsible_executive_slug` no lead. Faltando qualquer um, a E0 inteira é abortada — nem registro interno acontece.

**ALTERAÇÃO QUE INTRODUZIU O BLOQUEIO**: o par `316201ae` (portal obrigatório, contato condicional) + `20e7863e` (contato obrigatório sempre). O bloqueio total de hoje vem do segundo.

**FINALIDADE DO WHATSAPP DO EXECUTIVO**: destino do botão "falar com o consultor" do template. Não é usado para enviar a mensagem (o remetente é o número oficial único da Velox) nem para a janela de 24h — a resposta automática usa outro caminho (`inbound.server.ts`). É destino de botão, não requisito de envio.

**FINALIDADE DO SLUG DO PORTAL**: gera o link personalizado do Portal do Investidor, usado tanto no botão "portal" do template quanto no corpo da mensagem da Biblioteca (`button_kind: portal`). Serve para rastrear qual executivo originou o acesso.

**ELES DEVEM BLOQUEAR A E0?**
- WhatsApp do executivo: **NÃO** como bloqueador de envio. Deve bloquear apenas o botão de contato — e, se o template aprovado exigir esse botão, aí sim o envio real fica pendente (com motivo legível), mas a E0 continua registrada e a cadência continua nascendo.
- Slug do Portal: **SIM, condicionalmente**. O texto oficial ativo da E0 contém o link do Portal; enviar sem ele produziria uma mensagem incompleta. Porém o certo é o slug **existir sempre** (derivado do executivo responsável), não ser um bloqueio que trava a operação.

## CORREÇÃO MÍNIMA RECOMENDADA

Três frentes, na ordem:

1. **Garantir o slug sempre** — derivar o slug do executivo responsável no momento da resolução de destinos (a partir do próprio `executive_profiles`), em vez de depender de `portal_leads.responsible_executive_slug`, que o GreenSales nunca preenche. Com isso, o link personalizado deixa de faltar e o bloqueio do Portal desaparece por dado correto, não por afrouxamento de regra.
2. **Rebaixar o WhatsApp do executivo de bloqueador para condição de botão** — voltar `contactRequired` a depender do botão realmente existir no template aprovado (estado do commit `316201ae`) e, quando faltar, registrar a E0 com entrega pendente e motivo legível, em vez de abortar.
3. **Cadastrar o WhatsApp na Gestão de Usuários** — persistir em `executive_profiles.whatsapp`, respeitando a regra já firmada de fonte única. Sem isso o botão de contato nunca existirá, mesmo destravado.

Observação obrigatória antes de qualquer expectativa de envio real: **não há template da Meta cadastrado com finalidade `primeiro_contato`**. Enquanto essa linha não existir e estiver aprovada, toda E0 seguirá registrada internamente com "entrega externa pendente" — exatamente como já acontecia em 28/08.

## Decisões que preciso de você

1. Ao destravar, o motor reavaliará os leads parados desde 28/08 e pode disparar E0 em lote. Reprocessar todos, só os de hoje, ou nenhum (marcar como perdidos)?
2. Confirma a frente 1 (slug derivado do perfil do executivo) ou prefere manter o slug gravado no lead na atribuição?
