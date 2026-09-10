# Diagnóstico — registro da Jornada do investidor em /f

## Ponto exato onde o fluxo quebra

**Entre `pushPortalProgress()` e a obtenção do token, antes da chamada a `trackPortalProgress()`.**

No caminho de lead reconhecido em `/f`, a sessão recebe corretamente o `investorId` devolvido pelo servidor, mas não preenche o cache de leads. A emissão do token ainda depende desse cache. Sem o lead nele, `ensurePortalToken()` retorna `null` antes de chamar `issuePortalToken()`, e `pushPortalProgress()` não envia o evento.

**Dados reais consultados de Rafael (`gs_59275`):** existem somente `commercial.submitted` e `identity.recognized`, em 10/09/2026 às 09:31:52 e 09:31:58 de São Paulo. Não existem eventos de Manual, Material ou Simulador, nem registro em `portal_engagement`; `journey_percent` está em 0 e os horários de primeiro/último acesso estão vazios. Também não foram encontrados eventos sob o ID externo ou o identificador canônico consultados.

O defeito desse caminho está comprovado no código e é compatível com esses dados. **Não foi capturada a requisição da sessão original de Rafael:** a prévia consultada estava sem sessão de investidor. Portanto, não é possível afirmar retrospectivamente qual resposta de token ocorreu naquele navegador.

## Arquivo/função

| Ponto | Arquivo / função |
|---|---|
| Associação correta do ID | `src/components/portal/gateway-overlay.tsx:188–195` passa `result.investorId` para `startPortalSession()`; `src/lib/portal-session.ts:213–230` conserva esse ID na sessão. `getCurrentInvestorId()`, linhas 141–143, lê esse mesmo vínculo. |
| Dependência que interrompe a emissão | `src/lib/portal-token.ts:33–58` — `ensurePortalToken()` consulta `loadLeads()` e retorna `null` na linha 43 se não encontrar e-mail/WhatsApp. |
| Evento deixa de sair do navegador | `src/lib/portal-access.ts:121–130` — `pushPortalProgress()` esvazia o agrupamento e só chama `trackPortalProgress()` se receber token. |
| Validação adicional do token | `src/lib/portal-token.functions.ts:20–31` — `issuePortalToken()` exige que e-mail **e** telefone coincidam com o cadastro oficial. Reconhecimento, isoladamente, não garante essa condição. |
| Gravação e leitura oficiais | `src/lib/portal-access.functions.ts:138–200` — `trackPortalProgress()` valida token/ID e grava progresso, eventos e engajamento. `getInvestorJourneyState()`, linhas 266–290, lê essas mesmas três fontes pelo mesmo `investorId`; a Jornada em `src/components/executive/workspace/investor-profile-view.tsx:625` chama essa função. |

## Causa

A proteção que impede uma visita reconhecida de recriar/mover o card em `/f` retorna cedo em `startPortalSession()`. Isso está correto para preservar o cadastro, mas deixou exposta uma dependência antiga: **o transporte dos eventos exige um lead no armazenamento local, mesmo após reconhecimento válido no servidor.**

`trackJourney()` já encaminha eventos mesmo sem jornada local (`src/lib/journey/engine.ts:440–458`); o bloqueio vem depois, na obtenção da credencial. Sem ela, `trackPortalProgress()` não recebe nenhum `investorId` — não se trata, nesse caminho, de receber o ID errado.

Há dois agravantes no mesmo transporte:
- O retorno por falta de contatos ocorre antes do `try/finally`, deixando a promessa resolvida com `null` em `pending`. Novos eventos podem continuar recebendo esse resultado durante a mesma execução da página.
- O evento é retirado do agrupamento antes da confirmação e não é recolocado quando falta token ou o envio falha. O comentário sobre reenvio não corresponde a uma tentativa real daquele evento.

**Não há troca de fonte entre gravação e Jornada:** a leitura usa `portal_leads`, `portal_journey_events` e `portal_engagement`, exatamente os destinos do registro server-side. Os dois eventos de identificação encontrados são gravados por outro trecho da identificação; sua existência não comprova que o tracking dos conteúdos tenha funcionado.

## Correção mínima necessária

**Desacoplar a autorização do tracking do cache de leads, somente no fluxo `/f`.** Obter e entregar a credencial assinada no fluxo de identificação validado no servidor, vinculada ao `investorId` oficial, antes de liberar o envio dos eventos. Não recriar/adotar um card nem usar `localStorage` como autoridade para viabilizar isso.

Preservar a verificação da credencial: conhecer um ID ou receber `recognized: true` por correspondência parcial não deve, sozinho, autorizar gravação. Eventuais contatos alternativos não devem substituir os oficiais.

No transporte existente, liberar `pending` também nos retornos sem token e não descartar silenciosamente o evento antes de uma confirmação de gravação, sem criar tabela ou fonte paralela.

Nenhuma alteração de código ou dados foi realizada. PDF, identidade oficial, responsável, cadência e demais ambientes ficaram fora da investigação e da correção sugerida; este documento é somente diagnóstico, não autorização de implementação.
