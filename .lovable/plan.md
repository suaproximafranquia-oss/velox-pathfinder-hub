# Diagnóstico — Por que a E0 parou de ser disparada

Investigação feita sobre os 3 leads reais e sobre os registros do motor. Nada foi alterado.

## Os 3 leads

| Lead | ID | Criado (UTC) | E0 |
|---|---|---|---|
| Rodrigo Felipe | gs_58725 | 29/08 09:44 | bloqueada, repetidamente |
| Maia | gs_58729 | 29/08 11:50 | bloqueada |
| Lucas | gs_58735 | 29/08 13:56 | bloqueada |

Respostas ponto a ponto (iguais para os três):

1. Lead criado corretamente — sim, em `portal_leads`, com telefone e responsável `usr_thiago`.
2. Evento de início ocorreu — sim; o motor avalia esses leads a cada ciclo.
3. Motor acionado — sim. O ciclo roda a cada ~6 min (`ciclo_motor`, último às 14:07, 60 leads avaliados).
4. Etapa E0 identificada — sim; o fluxo chega até `dispatchFirstContact`.
5. Versão ativa da E0 na Biblioteca — não chegou a ser consultada: o bloqueio ocorre antes.
6. Mensagem com/sem nome — não chegou a ser selecionada.
7. Número do investidor — não chegou a ser usado.
8. Provedor de WhatsApp chamado — não. Nunca houve tentativa de envio.
9. Resposta do provedor — inexistente.
10. Bloqueio/erro — sim, bloqueio explícito e determinístico.
11. Registro da tentativa — sim: `relationship_engine_log`, ação `e0_bloqueada`, dezenas de linhas hoje.
12. Onde parou — na resolução dos destinos dos botões, antes da Biblioteca e antes do envio.

## CAUSA ENCONTRADA

A E0 passou a exigir **dois destinos obrigatórios** que hoje não existem em lugar nenhum do sistema:

- **WhatsApp do executivo responsável** — a coluna `executive_profiles.whatsapp` está **nula para todos os 7 executivos** (Thiago, Larissa, Milton, Paulo, Carlos, Talita, Marton). Nenhuma tela grava esse campo: o único ponto que escreve em `executive_profiles` é o login (`executive-auth.server.ts`), que salva apenas nome e e-mail. A tela de Gestão de Usuários não possui campo de WhatsApp.
- **Link personalizado do Portal** — depende de `portal_leads.responsible_executive_slug`, que está **nulo em todos os leads vindos do GreenSales**, inclusive nos que receberam E0 com sucesso antes.

Como o envio exige os dois, 100% das E0 de produção passaram a ser bloqueadas.

## EVIDÊNCIA

Log real, repetido a cada ciclo (ex.: 14:07:05, lead `gs_58725`):

```text
action: e0_bloqueada
reason:  "Link personalizado do Portal não disponível para o executivo responsável."
blockers: ["Link personalizado do Portal não disponível...",
           "WhatsApp do executivo responsável ainda não está configurado."]
executiveId: usr_thiago   portalMissing: true   contactMissing: true
```

Para `gs_58735` (Lucas) o primeiro ciclo registrou ainda "Lead sem executivo responsável definido" — o responsável foi gravado depois, na sincronização seguinte; a partir daí ele cai no mesmo bloqueio dos outros.

Corte temporal: a última E0 realmente registrada foi de André Barbosa (`gs_58707`) em 28/08 20:58. Esse lead também tem slug nulo — ou seja, o envio funcionava **antes** da regra de destinos obrigatórios entrar; nenhum dado do lado dos leads mudou.

## ONDE O FLUXO ESTÁ PARANDO

`registerFirstContact` → `dispatchFirstContact` → `resolveLeadDestinations(..., { portalRequired: true, contactRequired: true })` → retorna `available: false` → `return { registered: false }`. A Biblioteca, o template da Meta e o provedor nunca são alcançados.

## ARQUIVO/FUNÇÃO ENVOLVIDO

- `src/server/relationship/e0.server.ts` — `dispatchFirstContact` (linhas 94-111: os dois requisitos ligados).
- `src/server/relationship/destinations.server.ts` — `resolveLeadDestinations` (monta o link a partir do slug).
- `src/lib/relationship/e0-destinations.ts` — `resolveDestinations` (gera os bloqueios).
- `src/server/relationship/executive-identity.server.ts` — lê `executive_profiles.whatsapp` (sempre nulo).
- `src/server/executive-auth.server.ts` — único gravador de `executive_profiles`, não grava WhatsApp.
- `src/lib/greensales-sync.functions.ts` / `src/server/crm/workspace-card.server.ts` — não preenchem `responsible_executive_slug`.

Nada na alteração recente da Biblioteca, dos rótulos E6/E7 ou da taxonomia participa desse ponto — o bloqueio ocorre antes de qualquer leitura de conteúdo.

## CORREÇÃO NECESSÁRIA (não executada)

Duas frentes, ambas de dados/cadastro, sem tocar na regra da E0:

1. **Origem oficial do WhatsApp do executivo**: incluir o campo WhatsApp na Gestão de Usuários e persistir em `executive_profiles.whatsapp`, respeitando a regra já firmada de fonte única. Sem isso, nenhum executivo consegue satisfazer o requisito.
2. **Slug do responsável**: definir/gravar o slug do executivo (no perfil e/ou na atribuição do lead), para que o link personalizado do Portal exista para leads do GreenSales.

Opcionalmente, decidir explicitamente se o **link do Portal** deve mesmo ser obrigatório na E0 ou apenas o contato — hoje ele é obrigatório por código, não por cadastro.

## RISCO DA CORREÇÃO

- Ao destravar, o motor reavalia os leads acumulados e pode disparar E0 em lote para leads que estão parados desde 28/08 — inclusive fora do momento desejado. Precisa de decisão sobre reprocessar ou marcar como perdidos.
- Números de executivo cadastrados errados passariam a ser destino real de botão em template aprovado da Meta; a validação/normalização do número é obrigatória antes de liberar.
- Alterar o slug de um lead já atendido muda o link personalizado; snapshots antigos permanecem congelados, mas os envios futuros mudam de destino.

## O QUE NÃO FOI POSSÍVEL CONFIRMAR

- Se a exigência do link do Portal foi decisão de produto ou efeito colateral do refino: o comentário no código a descreve como regra fechada, mas não há registro de aprovação.
- Se algum executivo já teve WhatsApp cadastrado e o valor foi perdido — não há histórico da coluna.
