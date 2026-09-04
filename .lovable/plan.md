# Auditoria TEST-20260904-B + correção mínima do gerador de leads de teste

## A) Diagnóstico (somente leitura — nada foi alterado)

**Onde o lead B está agora: não existe.** Nenhum registro foi criado em nenhuma tabela.

Evidências:

- `crm_leads`: nenhuma linha com `test_batch_id = 'TEST-20260904-B'` nem `external_id LIKE 'TEST-20260904-B%'`. Só existe o lead do lote A (`f99b30ef-…`, `TEST-20260904-A-01`, `[TESTE] Ana Teste 01`, `is_test=t`, `stage_key=novos`, `entered_entry_stage_at=2026-09-04 01:57:27Z`, `canonical_investor_id=NULL`, `environment=NULL`).
- `portal_leads`: **nenhum card** `gs_TEST-20260904-B-01` — e também **nenhum** `gs_TEST-20260904-A-01`. Os únicos `is_test=true` no Portal são três registros antigos de 24/08 (`ld_test4a_*`).
- `workspace_e0_actions`, `crm_messages` (`msg_e0_*`), `relationship_cadences`, `relationship_queue`: nada para B.
- `test_batches`: o lote `TEST-20260904-B` existe (criado 02:14:55Z por thiago.rodrigues), com `lead_count = 1` — contagem otimista do laboratório, não prova de lead criado.

**Último ponto confirmado do fluxo e causa exata:**

`crm_lead_events` registra, às 02:14:56Z, no lead **do lote A**:

> `duplicidade_evitada` — "Entrada TEST-20260904-B-01 ignorada pela trava de telefone: este lead já existe como TEST-20260904-A-01. Nenhum registro foi criado, fundido ou apagado."

Ou seja: o laboratório **passou sim** pelo `intakeLead` esperado, mas o fluxo parou na **segunda trava de deduplicação por telefone** (`src/server/crm/lead-service.server.ts`, bloco `if (!existing)` → comparação de `normalizePhone`), que retorna `deduplicated: true` **antes** de qualquer criação de card.

**Por que os telefones colidem:** `buildSyntheticLead` (`src/lib/testing/test-lab.ts`) gera o telefone de forma determinística **apenas pelo índice**, sem o lote:

```
`${TEST_PHONE_PREFIX}${String(900000000 + index).slice(0, 9)}`
```

O primeiro lead de qualquer lote tem `index = 0` e, portanto, **sempre o mesmo telefone**. O lote B nasceu com o telefone idêntico ao da Ana Teste 01.

**Diferença concreta entre A e B:** nenhuma diferença de configuração, cenário ou responsável. A única diferença é que A foi o **primeiro** a usar aquele telefone; B chegou depois e foi barrado pela trava. Observação importante: **A também não aparece no Portal de Leads** — A foi criada antes da correção do fluxo de E0 adiada, quando o card só nascia depois da janela; ela ficou em `e0_adiada` sem card.

**Arquivo/função responsável pelo desvio:** `src/lib/testing/test-lab.ts` → `buildSyntheticLead` (telefone e e-mail não incluem o identificador do lote no telefone). A trava em `lead-service.server.ts` funcionou corretamente — ela protegeu a base.

**A correção anterior está sendo exercitada?** Não. O lote B nunca chegou à criação de card, porque a trava de telefone atua antes disso. A correção do card-antes-da-janela continua **não validada** na prática.

**É seguro criar o próximo lead?** Só depois de corrigir o gerador de telefone: qualquer novo lote com 1 lead vai colidir de novo com a Ana Teste 01 e repetir exatamente este resultado.

## B) Correção proposta (mínima, um arquivo)

Escopo: `src/lib/testing/test-lab.ts`, função `buildSyntheticLead`.

- Derivar o telefone fictício do **par lote + índice**, não só do índice: incorporar um sufixo numérico determinístico extraído do `batchId` (data + letra do lote) ao número gerado, mantendo o `TEST_PHONE_PREFIX` e o formato de 11 dígitos.
- Manter inalterado o caso `telefone_invalido` (continua `"000"`).
- E-mail já contém o `batchId` — permanece como está.
- Nada mais é tocado: `intakeLead`, trava de duplicidade, janela de E0, cadência, Biblioteca, Ação do Dia, Safety Lock, Portal, GreenSales e demais ambientes permanecem intactos.

Validação: apenas typecheck, build e os testes já existentes do laboratório/CRM. Nenhum sync, tick, cron, envio, novo lote ou limpeza.

## C) Depois da correção

Um novo lote (ex.: `TEST-20260904-C`, cenário `sem_acao_humana`, responsável Thiago) passará pela trava e permitirá validar, pela primeira vez, o comportamento corrigido: `crm_leads` → card `gs_<external_id>` com responsável e `is_test`/`test_batch_id` → `e0_adiada` (se fora da janela) → retomada às 07:00 preservando contexto.

O lote `TEST-20260904-B` fica como registro vazio em `test_batches`; nada a limpar, nada foi criado.
