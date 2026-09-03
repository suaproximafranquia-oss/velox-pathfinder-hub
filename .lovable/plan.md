# Unificar TikTok e Meta no mesmo motor de E0

## Objetivo

Fazer com que leads vindos de `/origem/tiktok` e `/origem/meta` percorram
exatamente o mesmo caminho já usado por GreenSales e Portal do Investidor:

```text
lead novo → origem registrada → Workspace → card → responsável → E0 → manual ou automático
```

Nada de motor novo. O motor de E0 (`resolveExecutiveE0Mode` →
`createPendingE0Action` | `registerFirstContact`) permanece exatamente como está.

## O problema em uma frase

O canal do link (`tiktok`/`meta`) é gravado no navegador, mas o Gateway do
Portal não o envia ao servidor. O lead nasce como "Portal genérico, sem dono",
e por isso a E0 cai sempre em manual — mesmo para um executivo com E0
automático liberado. Hoje não existe nenhum lead com carteira TikTok ou Meta
no banco.

## Decisões confirmadas

- Responsável inicial de TikTok e Meta: **sempre o Administrador (Thiago)**.
- TikTok e Meta viram **carteiras próprias** no Workspace, separadas da
  carteira Portal.
- Esses leads **não entram em rodízio** entre os demais executivos.
- Thiago precisa ver e operar essas carteiras **também no perfil Colaborador
  Híbrido**.

## O que será feito

### 1. O canal chega ao servidor
No Gateway do Portal, o contexto de entrada passa a ser lido junto com os
dados de identificação. Quando o visitante veio por um link oficial de canal:
- a carteira enviada é `tiktok` ou `meta` (em vez de `portal`);
- o responsável enviado é o Administrador do Portal.

Link personalizado de executivo continua vencendo o canal: quem tem dono
explícito não é reatribuído.

### 2. O card nasce com dono
Com responsável informado, o registro do lead já nasce com
`responsible_executive_id` preenchido — deixa de depender do espelhamento
posterior da sessão, que hoje só ocorre depois da decisão de E0.

### 3. A E0 passa a poder ser automática
Nenhuma alteração no motor. Com responsável resolvido, `resolveExecutiveE0Mode`
decide normalmente: automático se o responsável tiver CRM ON, Portal dos Leads
ON e E0 automático ligado; manual em qualquer outro caso. A Global WhatsApp
Safety Lock continua intacta e nada é enviado de verdade.

### 4. A Ação do Dia mostra a origem certa
A ação pendente de primeiro contato passa a registrar a origem real
(`tiktok` / `meta`) em vez de "portal", e passa a carregar os mesmos
metadados que o caminho GreenSales já envia (vínculo com o espelho do CRM e
marca de reentrada), para que as duas origens fiquem idênticas na auditoria.

### 5. Carteiras visíveis no Workspace
Os escopos `tiktok` e `meta` passam a aparecer como carteiras próprias nas
telas do Workspace, com acesso do Administrador **e** do perfil Colaborador
Híbrido do mesmo usuário.

## Fora do escopo desta entrega

- Motor de cadência (E1 em diante) e numeração E20/E27.
- Origem "GreenSales" fixa no card de leads do CRM.
- Cobertura de backup de `workspace_e0_actions`.
- Correções de navegação/Home e limpeza do menu.

Esses itens continuam registrados como pendências da auditoria.

## Detalhes técnicos

- `src/components/portal/gateway-overlay.tsx` — incluir `entry.channel` no
  payload de `resolvePortalIdentity`; derivar `scope` (`tiktok`/`meta`) e
  `executiveId = getPortalAdministratorId()` quando houver canal e não houver
  link personalizado.
- `src/lib/portal-identity.functions.ts` — aceitar e validar os escopos
  `tiktok`/`meta` no validador de entrada; repassar `_scope` e `_executive_id`
  à RPC `resolve_portal_identity` (a RPC já grava `responsible_executive_id`).
- `src/server/crm/portal-first-contact.server.ts` — usar `input.scope` como
  `origin` da ação pendente (hoje fixo em `"portal"`) e repassar
  `reactivation`; `SCOPE_ORIGIN_LABEL` já cobre TikTok e Meta.
- `src/lib/portal-workspace.ts` / telas de carteira — incluir `tiktok` e `meta`
  na lista de escopos operacionais e liberá-los para o usuário híbrido.
- Verificação prévia: confirmar se `portal_leads.scope` tem CHECK/enum
  restringindo valores. Se tiver, será necessária uma migration para incluir
  `tiktok` e `meta`; caso contrário, nenhuma alteração de banco é necessária.
- Sem mudanças em `first-contact-mode.server.ts`, `e0-actions.server.ts`,
  `first-contact.server.ts` ou na Safety Lock.

## Como validar

1. Abrir `/origem/tiktok`, identificar-se com dados novos e conferir que o
   card nasce com carteira TikTok, origem TikTok e responsável Thiago.
2. Com E0 automático ligado para Thiago (CRM + Portal ON), confirmar E0
   registrada como simulada, sem envio real.
3. Com E0 manual, confirmar a ação "Primeiro contato (E0)" na Ação do Dia com
   origem `tiktok`.
4. Repetir para `/origem/meta`.
5. Confirmar que um lead GreenSales e um lead de link personalizado continuam
   com o comportamento atual, sem regressão.
