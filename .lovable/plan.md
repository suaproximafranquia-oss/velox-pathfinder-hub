# Diagnóstico — Ação do Dia, compromissos futuros, alerta e fuso (somente `/f`)

Nada foi alterado: nenhuma ação executada, nenhum lead tocado, nenhuma migration, nenhum dado modificado.

## 1. Dados reais de Michel e Marco Antônio

| | Michel | Marco Antônio |
|---|---|---|
| Lead (GreenSales) | 59115 | 59142 |
| `stage_key` | `agendamentos` | `agendamentos` |
| `follow_up` na origem | `2026-09-09 11:00:00` (horário da operação) | `2026-09-09 16:00:00` |
| Registro espelhado | `gsfu_59115` | `gsfu_59142` |
| Guardado no banco (UTC) | `2026-09-09 14:00:00+00` | `2026-09-09 19:00:00+00` |
| Convertido para o horário local | 11:00 | 16:00 |
| Origem | `greensales` | `greensales` |

Conversão: o `follow_up` é lido como horário de São Paulo e gravado em UTC (`parseFollowUp`, com deslocamento real do fuso). 11:00 local = 14:00 UTC e 16:00 local = 19:00 UTC — exatamente o que está gravado. A exibição volta a converter para São Paulo.

**Fuso não é a causa.** Não há conversão dupla, nem divergência entre horário exibido, guardado e usado para priorizar.

## 2. Causa real

A função que classifica um compromisso está em `src/lib/crm/daily-actions.ts`, em `resolveBucket`. A regra atual é:

- começou há mais de 5 minutos → "atrasada";
- já começou ou começa em até 5 minutos → "agora";
- começa depois disso, **mas no mesmo dia** → "hoje";
- só cai em "futura" quando é de **outro dia**.

Ou seja: "futuro" hoje significa "outro dia", não "ainda não chegou a hora". Um compromisso de hoje às 11:00 ou às 16:00, às 08:18, já entra como "Para hoje".

Em seguida, a ordenação (`actionRank`, mesmo arquivo) dá a compromissos de prioridade máxima o posto 1 — acima do primeiro contato (E0) e de qualquer ligação/mensagem. Resultado: Michel assume a posição 1 às 08:18 e Marco Antônio vem logo atrás, ambos horas antes da hora.

Respostas diretas:
1. Michel aparece antes da hora porque um compromisso do próprio dia nunca é classificado como futuro.
2. Marco Antônio, pelo mesmo motivo — e por prioridade máxima ele sobe acima das ações reais do dia.
3. Erro de fuso: **NÃO**.
4. A classificação "futuro" funciona apenas para outro dia; para hoje, **não**.
5. A prioridade ignora a hora do compromisso: **SIM** (ela só olha se é prioridade máxima e se é de hoje).
6. Lista lateral e card principal usam a mesma lista oficial; a tela escolhe como card ativo o primeiro item que não seja "futura" — como Michel está em "Para hoje", ele é escolhido. Nenhuma segunda fila existe.
7. Existe mecanismo de alerta de reunião: `evaluateMeetingReminders` em `src/lib/workspace-alerts.ts`, que gera lembrete das reuniões nas próximas 24h.
8. Ele não apareceu hoje porque lê a lista de reuniões guardada no próprio navegador (`listMeetings`, `src/lib/meetings.ts`), e os compromissos do GreenSales vivem no banco (`portal_meetings`) — o alerta simplesmente não os enxerga.

## 3. Caminho confirmado

GreenSales (`stage_key = agendamentos` + `follow_up`) → sincronização (`src/server/crm/greensales-followup.server.ts`) → `portal_meetings` (`gsfu_<id>`, origem `greensales`) → Ação do Dia (`src/server/crm/daily-actions.server.ts`) → classificação (`resolveBucket`) → ordem (`actionRank`) → tela. Nenhuma tag foi usada como substituto de `stage_key`.

## 4. Menor correção necessária (para decisão futura, não executada)

Uma única mudança de regra, em `src/lib/crm/daily-actions.ts`:

- em `resolveBucket`, um compromisso com hora marcada que ainda está a mais de 5 minutos de distância passa a ser "futura", mesmo sendo hoje (a regra T-5 continua idêntica: dentro de 5 minutos vira "agora"; passou da hora vira "atrasada");
- consequência automática: ele sai da disputa da posição 1 e passa a aparecer em "Próximos compromissos", sem tocar em `actionRank`, fila, motor, GreenSales, posição 1 ou T-5.

Testes existentes de classificação/ordem precisariam apenas de conferência.

## 5. Alerta de próximo compromisso

Pode ser aproveitado o que já existe: a leitura oficial dos compromissos do dia já traz Michel e Marco com hora. O aviso visual seria uma faixa lendo o primeiro compromisso de hoje ainda não iniciado — sem novo motor, sem nova consulta, sem novo armazenamento. O mecanismo antigo (`workspace-alerts.ts`) não serve como está, porque lê apenas o armazenamento local do navegador.

Arquivos envolvidos numa construção futura:
- `src/lib/crm/daily-actions.ts` (regra de classificação);
- `src/components/crm/daily-actions-overlay.tsx` (faixa de aviso, opcional);
- `src/routes/f.executivo.dashboard.tsx` (faixa no Portal dos Leads, opcional).

Nada mais seria tocado; `/s`, `/s/portal` e `/seg` ficam fora.

---

# Diagnóstico 2 — Modo Editor de imagens do Portal `/f` (somente leitura)

Nada foi alterado: sem código, sem tabela, sem migration, sem mexer no Portal.

## 1. Universo real de imagens do Portal `/f`

| # | Onde aparece | Arquivo | Chave estável hoje | Origem | Classe |
|---|---|---|---|---|---|
| 1 | Capa da Home (hero) | `investor-portal-home.tsx` | `home-capa` (já editável) | registro de assets/CDN | A |
| 2 | Capas dos 6 cards de módulo (Manual, Material institucional, Simulador, Nossa Estrutura, Revista, Princípios) | `investor-portal-home.tsx` | `modulo-*` (já editáveis) | registro de assets/CDN | A |
| 3 | Galeria Nossa Estrutura (matriz, recepção, unidade) | `estrutura-overlay.tsx` | `estrutura-*` (já editáveis) | registro/CDN | A |
| 4 | Capa Princípios Velox | `principios-overlay.tsx` | `principios-capa` (já editável) | registro/CDN | A |
| 5 | Material Institucional (`/universo`) — cerca de 19 fotografias editoriais (sede, fundador, unidades, treinamento, embaixador, equipe, parceiros, home office etc.) | `src/routes/universo.tsx` | têm chave no registro, mas **não** têm slot de substituição | registro/CDN | B |
| 6 | Revista Velox — capa da edição e páginas de mídia (imagem/vídeo) | `magazine-overlay.tsx`, `magazine-reader.tsx` | por edição/página, no banco | armazenamento privado com link assinado | já administrável (Central da Revista) |
| 7 | Manual do Investidor (13 capítulos) | `src/routes/manual/*`, `src/components/journey/*` | — | **não usa imagens**: é texto editorial + espaços de vídeo | — |
| 8 | Vídeos da Nossa Estrutura / Manual | `video-slot.tsx`, `estrutura-overlay.tsx` | — | vídeo, não imagem | fora do escopo |
| 9 | Tela de homologação, ícones desenhados em código, degradês, marca no cabeçalho | `homologation-gate.tsx` e outros | — | decorativo/técnico | D |
| 10 | Cards da versão Solar | `investor-portal-home.tsx` | por unidade | arquivos próprios do Solar | fora do escopo `/f` |

## 2. Respostas objetivas

1. **Grupos de imagens:** 6 grupos de conteúdo real (capa da Home, capas de módulo, galeria da Estrutura, capa de Princípios, fotografias do Material Institucional, mídia da Revista) + 1 grupo decorativo/técnico.
2. **Locais editáveis em potencial:** Home, cards, Nossa Estrutura, Princípios, Material Institucional e Revista.
3. **Já com chave estável e substituíveis hoje:** 11 imagens (itens 1–4).
4. **Sem chave de substituição:** as ~19 fotografias do Material Institucional (têm nome no registro, faltam apenas os slots).
5. **Em PDF:** **nenhuma.** O Manual do Investidor é página web, não PDF; não há imagens presas dentro de arquivo. A capa do Manual é uma imagem separada e já editável.
6. **Editáveis por simples substituição:** itens 1–4 (já funcionam) e, com o mesmo mecanismo, as fotografias do Material Institucional.
7. **Exigem adaptação:** o Material Institucional — cada foto precisa ganhar um nome de slot e passar a ler a camada de substituição (uma linha por imagem, sem mudar layout).
8. **Uma única camada para todo o Portal:** **SIM.** A camada criada (`unidade + chave da imagem + arquivo + autor/data`) já é genérica; ampliar é só declarar novos slots.
9. **Armazenamento/upload existente pode ser reutilizado:** SIM — o mesmo usado pela Revista, com link assinado e acesso protegido.
10. **Menor arquitetura necessária:** manter a camada atual e (a) ampliar a lista de slots com as fotos do Material Institucional; (b) trocar a leitura direta do registro pela leitura com substituição nesses pontos; (c) manter o painel do editor agrupado por seção. Sem nova tabela, sem migration, sem novo motor.
11. **Não deve ser editável:** ícones e degradês desenhados em código, tela de homologação, marca institucional, páginas da Revista (já têm central própria) e qualquer imagem de outra unidade.
12. **Arquivos de uma construção futura:** `src/lib/portal/asset-overrides.ts` (novos slots), `src/routes/universo.tsx` (leitura com substituição), `src/components/portal/portal-asset-editor.tsx` (agrupamento e miniatura da imagem original), e nada além disso.
13. **Esforço adicional:** **pouco a moderado** — é repetição do padrão já pronto, concentrada no Material Institucional; a arquitetura não muda.

## 3. Permissão

A autorização já existente serve: o servidor confirma a permissão administrativa antes de listar controles, aceitar envio, substituir, restaurar ou salvar. `?modo=editor` apenas sinaliza intenção; sem permissão do servidor, nada aparece e nada é aceito. A substituição é sempre por unidade — `/f` não afeta Solar nem Seguradora — e a imagem original nunca é apagada: remover a substituição faz o Portal voltar ao original.
