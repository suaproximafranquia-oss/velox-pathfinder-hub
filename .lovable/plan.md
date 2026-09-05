# AUDITORIA — Identificação dos códigos `vendedor_id` GreenSales (Financeira /f)

Somente leitura. Nada foi construído, alterado, sincronizado ou executado.

## 1. Onde nasce `vendedor_id`

- A integração (`src/server/greensales.server.ts`) usa apenas 3 chamadas à API GDigital (`https://back.gdigital.com.br/`):
  - `POST /login` — autenticação;
  - `POST /lead/list` — listagem paginada de leads;
  - `GET /lead/{id}` — detalhe do lead.
- O tipo `GreenSalesLead` declara `vendedor_id?: number | null`, ou seja, o campo é esperado no **payload do lead** (listagem e/ou detalhe).
- O extrator do Bloco 2 (`greenSalesVendorId` em `src/server/crm/responsible.server.ts`) lê `raw["vendedor_id"]` ou `raw["vendedor"]["id"]`.
- Não há no projeto nenhum endpoint/consulta de "usuários", "vendedores", "owners" ou "sellers" do GreenSales — apenas leads.

## 2. Existe lista de vendedores GreenSales?

**Não.** Nenhuma estrutura ID|Nome de vendedores existe no código ou no banco. O projeto nunca consumiu nome de vendedor da origem.

## 3. Dados históricos aproveitáveis — DESCOBERTA CENTRAL

`crm_leads.raw_payload` (jsonb) guarda o payload bruto mesclado (listagem + detalhe) de 639 leads. Auditoria das chaves presentes:

- **`vendedor_id` NÃO existe em nenhum payload armazenado** — nem `vendedor` aninhado.
- O que existe é **`user_id`**: presente em 637 dos 639 leads, **sempre com o valor `37193`**, e `pre_user_id` sempre `0`.

Ou seja: o payload real da origem identifica o dono do lead pelo campo **`user_id`**, não `vendedor_id`. Hoje, todos os leads sincronizados pertencem ao mesmo usuário GreenSales `37193`.

## 4. Algum lead existente permite identificar o vendedor?

Parcialmente: qualquer lead com `raw_payload` revela `user_id = 37193`. Mas o payload **não traz o nome do vendedor**, então o projeto não consegue provar a quem pertence `37193`.

Evidência indireta forte: a **única conexão GreenSales** cadastrada (`crm_connections`) pertence a **usr_thiago (Thiago Rodrigues)** — todos os leads entraram por essa conta. Isso sugere que `37193` pode ser o próprio usuário da conta conectada, mas **não é prova**: pode ser o dono atribuído aos leads, não o dono da conta.

## 5. Relação com os 7 executivos

- Nenhum `greensales_vendor_id` cadastrado (todos os 7: NULL) — confirmado no banco.
- Nenhum dado histórico relaciona Carlos, Marton, Paulo, Larissa, Milton ou Talita a qualquer código da origem — eles nunca apareceram em payload porque, até aqui, **todos os leads vieram com o mesmo `user_id`**.
- Não foi feita nenhuma inferência por igualdade de IDs.

## 6. Gestão de Usuários (Bloco 3)

Confirmado: a coluna `executive_profiles.greensales_vendor_id` existe, o campo "Código do vendedor na origem (GreenSales)" está na tela `/f/executivo/usuarios`, com bloqueio de duplicidade. O local de cadastro manual está pronto.

## 7. Cenário final: conseguimos descobrir os códigos pelo projeto?

**Resposta: D — NÃO está disponível dentro do projeto**, com um agravante importante:

1. O histórico só conhece **um** usuário da origem (`37193`), sem nome.
2. O campo que o Bloco 2 lê (`vendedor_id` / `vendedor.id`) **nunca apareceu** em payload real armazenado — o campo real observado é `user_id`.
3. O projeto não tem endpoint de listagem de vendedores.

### O que precisamos obter externamente

Da **Administração GreenSales/GDigital** (tela de usuários/equipe do app.gdigital.com.br):

- A lista **ID | Nome** de cada vendedor (Thiago, Carlos, Marton, Paulo, Larissa, Milton, Talita).

E uma validação conceitual antes de ativar a redistribuição:

- Confirmar se o identificador do vendedor no lead é o campo **`user_id`** (observado em 637 payloads) e não `vendedor_id`. Se for, o extrator `greenSalesVendorId` precisará ler `user_id` — ajuste futuro, fora desta auditoria.

## 8–10. Escopo respeitado

Nenhuma automação, tela nova, sincronização, cron, lead de teste ou redistribuição foi criada/executada. `/s`, `/seg` e `/` intocados. Safety Lock intacto.

## 11. Recomendação do próximo passo

1. **Admin obtém no painel GreenSales** a lista ID|Nome dos 7 executivos (manual, única vez).
2. **Admin cadastra** os códigos na Gestão de Usuários (Bloco 3 já pronto).
3. **Antes do primeiro teste de redistribuição**, validar com um lead fictício de lote de teste qual campo o payload fresco entrega (`user_id` vs `vendedor_id`) e, se necessário, corrigir o extrator — construção mínima, somente após autorização.
