# AUDITORIA — Qual campo representa o vendedor/responsável no payload GDigital (Financeira /f)

Somente leitura. Nada construído, alterado ou executado. Nenhuma chamada externa feita.

## 1–2. Contrato inspecionado

- `GreenSalesLead` (`src/server/greensales.server.ts`, linhas 31–45): declara `vendedor_id?: number | null` e **não declara `user_id` nem `pre_user_id`** — mas o tipo termina com `[key: string]: unknown`, ou seja, qualquer campo extra da origem passa pelo tipo sem ser nomeado.
- `POST /lead/list` e `GET /lead/{id}` não têm parser de responsável: o código mescla `{ ...listed, ...detail }` e grava tudo em `crm_leads.raw_payload`.
- `normalizeGreenSalesLead` (`src/lib/greensales/normalize.ts`) extrai apenas nome, e-mail, whatsapp, cidade, campanha e material/origem. **Nenhum campo de responsável é normalizado.**

## 3. Onde `user_id` existe

`user_id` **não faz parte formal do tipo nem do mapeamento** — existe apenas dentro do `raw_payload` histórico: 637 dos 639 leads com `user_id = 37193`, `pre_user_id = 0`, e nenhum `vendedor_id`/`vendedor`.

## 4. Outros campos candidatos no payload

Chaves presentes nos 639 payloads: `user_id`, `pre_user_id`, `user_updated_at`, `event_id`, `qualification`, `situations`, `journey`, `activities_*`, `products`, `companies`, `notes`, `address`, `register`, `register_form`, `follow_up`, `soft_bounce_*`. Os únicos com semântica de pessoa/dono são **`user_id`** e **`pre_user_id`** ("pré-usuário", provável responsável anterior ou usuário de pré-atendimento — o código não define). Nenhum outro campo representa vendedor/executor/dono.

## 5. Comparação com base apenas no contrato existente

| Campo | No tipo? | Nos dados? | Significado comprovável pelo código |
|---|---|---|---|
| `vendedor_id` | Sim (declarado) | **Nunca** apareceu | Nenhum — campo esperado mas nunca observado |
| `vendedor.id` | Não | **Nunca** apareceu | Nenhum |
| `user_id` | Não (cai no índice genérico) | 637/639 leads, valor único `37193` | Único identificador de usuário presente em todo payload real |
| `pre_user_id` | Não | Sempre `0` | Indefinido; nome sugere "usuário anterior/pré", sem prova |

## Respostas objetivas

**A) `user_id` é o campo correto?**
É o **único campo real observado** que identifica um usuário da origem por lead. O código não prova que ele seja "responsável atual" — mas também não existe nenhum outro candidato no payload real.

**B) Há evidência suficiente no código para afirmar isso?**
**Não.** O código prova apenas que `user_id` existe e é estável; não prova a semântica (responsável atual vs. criador/importador). O tipo declara `vendedor_id`, que nunca se materializou — ou seja, o tipo foi escrito por expectativa, não por observação.

**C) Precisamos de confirmação externa?**
**Sim.** Antes de alterar o extrator, é necessário confirmar com a GDigital/Admin GreenSales (documentação ou painel): (1) o que `user_id` representa no lead; (2) qual campo representa o vendedor responsável atual; (3) a lista ID|Nome dos 7 executivos.

**D) Menor alteração, SE `user_id` for confirmado como responsável:**
Adicionar uma única linha ao extrator `greenSalesVendorId` em `src/server/crm/responsible.server.ts`, aceitando `raw["user_id"]` como terceira fonte (após `vendedor_id` e `vendedor.id`). Uma função, um arquivo, sem migration, sem mudança de schema — a coluna `greensales_vendor_id` e o cadastro do Bloco 3 permanecem. (Não executar agora.)

**E) `greensales_vendor_id` continua representando o mesmo identificador?**
Sim. A coluna é texto livre e já guarda "o identificador do vendedor na origem"; seja ele `vendedor_id` ou `user_id`, o cadastro manual do Bloco 3 e o resolvedor `resolveResponsibleByVendorId` não mudam.

**F) Risco de `user_id` ser criador/importador e não responsável?**
**Existe e é real.** Em CRMs desse tipo, `user_id` pode ser o dono atual OU o usuário que cadastrou o lead — e a presença de `pre_user_id` e `user_updated_at` sugere que a origem distingue papéis. Como 100% dos leads históricos têm o mesmo valor, não há variação nos dados para diferenciar os significados. Por isso a confirmação externa (item C) é bloqueadora: cadastrar os 7 códigos contra o campo errado faria a redistribuição mover leads para o executivo errado.

## Conclusão

O projeto hoje **não consegue afirmar** qual campo é o responsável: o campo esperado (`vendedor_id`) nunca chegou; o campo real (`user_id`) tem semântica não comprovada. O próximo passo não é código — é obter da Administração GreenSales/GDigital: **(1)** o significado de `user_id` no lead e **(2)** a lista oficial ID|Nome dos vendedores. Só depois disso autoriza-se a alteração mínima do extrator (item D) e o cadastro dos códigos.
