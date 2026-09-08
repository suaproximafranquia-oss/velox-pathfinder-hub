# Régua editorial atual × chaves técnicas (/f) — diagnóstico final, somente leitura

Nada foi alterado. Encontrei a prova documental que faltava: o arquivo **"Biblioteca de Mensagens — Jornada do Investidor V2"**, que está no projeto e é a origem dos textos. Ele resolve quase todas as dúvidas.

## A. RÉGUA ATUAL CONFIRMADA

O documento V2 registra a régua na versão anterior: E0, E1, E2, E3, **E5, E6, E7** (sem E4 e sem E8), R1–R3, RE0–RE3, RF0–RF1. Ele diz textualmente: "E5 é a oferta da apresentação digital; E6 é o acompanhamento sete dias depois; E7 é a finalização".

Depois disso a régua foi **renumerada e ampliada** para a versão que você usa hoje, e essa é a que está gravada nos títulos da Biblioteca:

E0 → E1 → E2 → E3 → **E4 (oferta da apresentação)** → **E5 (apresentação liberada, 7 dias)** → **E6 (acompanhamento da apresentação)** → **E7 (última tentativa)** → **E8 (finalização)**
R1 → R2 → R3 → R4 · RE0 → RE1 → RE2 → RE3 · RF0 → RF1

A diferença entre as duas versões é coerente: a antiga E6 foi dividida em duas (liberação + acompanhamento) e entrou uma "última tentativa" nova, o que empurrou a finalização para E8. Isso bate exatamente com a lista `CURRENT_FLOW_E` dos históricos. **A régua atual é legítima e está completa.**

## B. MAPA EDITORIAL → TÉCNICO

| Etapa atual | Chave técnica | Mensagem que está lá | Evidência | Confiança |
|---|---|---|---|---|
| E0 | E0 | Primeiro contato | texto = E0 do documento | confirmado |
| E1 | E1 | Primeiro acompanhamento | texto = E1 do documento | confirmado |
| E2 | E3 | "continuar te ajudando… separei mais um conteúdo" | texto = E2 do documento | confirmado |
| E3 | E12 | **texto duplicado do E2** | não corresponde ao E3 do documento | **lacuna** |
| E4 | **E2** | Oferta da apresentação digital | texto idêntico ao E5 do documento (a oferta) | confirmado |
| E5 | **RE0** | "deixei disponível… sete dias" | texto idêntico ao E6 do documento | confirmado |
| E6 | E20 | "já se passaram alguns dias desde o envio" | variante posterior de acompanhamento | forte |
| E7 | E27 | Última tentativa de contato | etapa criada depois do documento | forte |
| E8 | **RE1** | Finalização | texto idêntico ao E7 do documento | confirmado |
| R1 | R1 | texto do **RE3** | não corresponde ao R1 do documento | **lacuna** |
| R2 | **E4** | "conversa sem continuidade… [CONTEÚDO R2]" | texto = R2 do documento | confirmado |
| R3 | **E5** | oferta digital como alternativa | família R, texto de encerramento com oferta | forte |
| R4 | **RE2** | "tentei retomar… você chegou a me responder" | encerramento do reengajamento | forte |
| RE0 | **E6** | "voltou a demonstrar interesse" | texto = RE0 do documento | confirmado |
| RE1 | **E7** | critérios para avaliar uma franquia | texto = RE1 do documento | confirmado |
| RE2 | **FINALIZACAO** | estrutura e suporte | texto = RE2 do documento | confirmado |
| RE3 | **R1** | encerramento com oferta digital | texto = RE3 do documento | confirmado |
| RF0 | **R2** | reagendar a conversa combinada | texto = RF0 do documento | confirmado |
| RF1 | **R3** | encerramento com alternativa digital | texto = RF1 do documento | confirmado |

**A causa está provada:** os textos foram carregados na ordem do documento sobre as chaves técnicas disponíveis, e a lista de chaves não tinha a mesma quantidade nem a mesma ordem. Resultado: quase toda a Biblioteca ficou deslocada. Nada foi perdido — só está guardado na gaveta errada.

## C. AS QUATRO MENSAGENS ÓRFÃS

- **chave E2** → é a etapa editorial **E4** (oferta da apresentação digital). Confirmado pelo documento, onde esse texto é a oferta. Não é E20.
- **chave E5** → é a etapa editorial **R3**. Forte: o texto ativo é da família R (o investidor já respondeu e sumiu) e oferece a apresentação como alternativa final, exatamente como o documento prevê para R3.
- **chave E6** → é a etapa editorial **RE0**. Confirmado: texto idêntico ao RE0 do documento.
- **chave E7** → é a etapa editorial **RE1**. Confirmado: texto idêntico ao RE1 do documento.
- **chave TESTE** → corpo "TESET", sem envio, sem fila. Só histórico.

## D. MENSAGENS NA CHAVE ERRADA

Praticamente todas, conforme a tabela B: E3, E12, E2, RE0, RE1, E4, E5, RE2, FINALIZACAO, R1, R2, R3, E6, E7. As únicas alinhadas são E0 e E1.

## E. TÍTULOS ERRADOS

Nenhum título está "errado" no sentido editorial — eles estão certos e são hoje a única pista correta da régua. O que está errado é a chave por baixo. As exceções são as chaves esvaziadas, cujo título virou lixo: RF0, RF1, V3, RESPOSTA_AUTOMATICA ("Liberado para novas mensagem"), E0_V1 ("Livre"), RE3 e V4 ("ER0/ER2 - Etapa de RMK").

## F. ETAPAS SEM MENSAGEM CORRETA

- **E3 editorial**: o texto original ("os dias passam rapidamente e sei que a rotina pode dificultar…") não está ativo em nenhuma chave; a posição foi ocupada por uma cópia do E2.
- **R1 editorial**: o texto original ("vi que conseguimos iniciar nossa conversa, mas não evoluímos…") não está ativo em nenhuma chave.
- Ambos existem no documento V2 e podem ser recuperados de lá, sem invenção.
- Chaves técnicas hoje com conteúdo de rascunho: RE3, V3, V4, RF0, RF1, RESPOSTA_AUTOMATICA, E0_V1, E30.

## G. ER0–ER3

Confirmado: não existem. Não aparecem no documento, na configuração, no motor nem como chave gravada. São apenas títulos digitados sobre RE3, V4 e TESTE. O Remarketing funciona sem eles.

## H. POSIÇÕES

Atuais (com duplicidades em 50, 110, 130, 140, 200): 10 E0 · 20 E1 · 30 E3 · 40 E12 · 50 E2 e RE0 · 60 E20 · 70 E27 · 80 RE1 · 90 E4 · 100 RE2 · 110 E5 e FINALIZACAO · 120 R1 · 130 E6 e R2 · 140 E7 e R3 · 150 RE3 · 160 V4 · 170 RESPOSTA_AUTOMATICA · 180 RF0 · 190 RF1 · 200 TESTE e V3 · 210 E30 · 220 E0_V1.

Ordem editorial desejada: E0–E8 = 10 a 90 · R1–R4 = 100 a 130 · RE0–RE3 = 140 a 170 · RF0–RF1 = 180 e 190 · especiais (V3, V4, resposta automática, E0 V1, E30) a partir de 200 · histórico no fim.

## I. O QUE PODE SER CONSTRUÍDO COM SEGURANÇA

1. Criar uma **camada editorial explícita**: uma lista única que diga "E4 do negócio = chave E2", e fazer a Biblioteca e a Ação do Dia exibirem só o nome editorial. O código atual já separa rótulo de chave (`step-labels.ts`), então isso é possível **sem tocar no motor** — basta a lista virar a fonte oficial dos rótulos e da ordem, em vez de cada título ser digitado à mão.
2. Com essa camada, a caixa "Histórico fora da configuração" some para E2, E5, E6 e E7, porque elas passam a ser reconhecidas como etapas da régua.
3. Repor os dois textos faltantes (E3 e R1) a partir do documento V2, como nova versão, sem apagar nada.
4. Renumerar as posições em bloco, na ordem editorial.
5. Manter TESTE apenas como histórico.
6. Aplicar a exceção temporária de domingo em `resolveOperationalWindow` — é o único ponto; não há segunda checagem no servidor.

## J. O QUE PRECISA DA SUA DECISÃO

1. **E6 e E7 editoriais** (chaves E20 e E27) não existem no documento V2 — nasceram depois. Preciso que você confirme que os textos atuais delas são os oficiais.
2. **R4** (chave RE2) também não está no documento. Confirmar o texto atual.
3. Repor E3 e R1 com os textos do documento V2: confirmar que é isso mesmo que deve ir para o ar.
4. Se prefere que a interface mostre **apenas** o nome editorial, ou o nome editorial com a chave técnica discreta ao lado, para rastreio.
