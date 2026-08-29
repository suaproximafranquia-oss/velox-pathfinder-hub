# Refino e consolidação — auditoria aplicada

Auditoria feita sobre o código atual. Abaixo apenas o que está **confirmado** por leitura de arquivo e o que será corrigido. Nada de reconstrução, nada de reclassificação automática de vídeos.

## O que a auditoria confirmou

**Inconsistência central (Biblioteca x Motor).** Existem hoje duas taxonomias vivas:
- O motor amarra conteúdo por **etapa** (`relationship_step_content_bindings`, chaves de `src/lib/relationship/step-registry.ts`: etapas de `STEPS` + E20, E27, FINALIZACAO, RESPOSTA_AUTOMATICA), com rótulos editáveis (`step-labels.ts`).
- A tela da Biblioteca (`src/routes/f.executivo.biblioteca.tsx`) ainda edita **grupos antigos** (`CONTENT_GROUPS` em `src/lib/relationship/content.ts`: E1, E2, E3, E4, E12, R1, R2, R3, RE1, RE2, V3, V4, FINALIZACAO).
- Consequência: grupos que o motor não usa (E2, E4, R3, V3, V4, E12) aparecem como se fossem destino válido, e etapas reais do motor (E0, E0_V1, E30, RE0, RE3, RF0, RF1, E20, E27, RESPOSTA_AUTOMATICA) não aparecem. Rótulos alterados manualmente nas mensagens não refletem na Biblioteca.

**"Sem vínculo" hoje não é sem vínculo.** `src/server/relationship/step-media.server.ts` documenta e aplica o fallback: sem vínculo explícito, o motor volta ao sorteio dentro do grupo (`selectContent` em `content.ts`). Isso contraria a regra desta rodada.

**Já correto — não será tocado:** raiz `/` institucional sem formulário e sem números fabricados (nenhuma ocorrência de "+800", "400 mil" ou "16 Bi" no código); `/f`, `/s`, `/seg` existentes e isolados; guard único `OperationalGuard`; E20/E27 com snapshot, versão, expiração e cancelamento na abertura; deduplicação e histórico das unidades; publicação/versionamento da Apresentação Digital; motor de Remarketing; redirects legados.

**Não confirmado (vira investigação, não correção às cegas):**
- Dupla autenticação: a sessão fica em `localStorage` (`atlas:session:v3`), compartilhada entre abas, e o CRM só pede login quando não há sessão ou após ~4h de inatividade. A causa relatada não é reproduzível pela leitura do código — precisa ser observada em execução antes de qualquer mudança.
- E0 sem disparo: o caminho já registra bloqueio, tentativa, sucesso e erro (`e0.server.ts` + `relationship_engine_log`). Vou ler os registros reais antes de mexer em qualquer linha do fluxo.

## O que será feito

1. **Fonte única de taxonomia.** A Biblioteca passa a usar as **etapas do motor** (`step-registry`) com os rótulos de `step-labels`, em vez de `CONTENT_GROUPS`. Os grupos antigos deixam de ser oferecidos na interface, mas nada é apagado no banco: os vínculos existentes continuam gravados e visíveis como "vínculo legado" até revisão manual.
2. **Sem vínculo é sem vínculo.** Remoção do fallback por sorteio de grupo quando a etapa não tem vínculo explícito: o motor envia a mensagem sem conteúdo e registra o motivo. Etapas com mais de um conteúdo vinculado mantêm a rotação determinística atual.
3. **Nenhuma migração de dados destrutiva.** Sem `UPDATE` em massa, sem reclassificação por nome ou por IA. Se for necessária migração, será apenas para marcar vínculos antigos como pendentes de revisão.
4. **Resposta automática (24h)** permanece exatamente como está cadastrada — sem vídeo, sem conteúdo da Biblioteca, sem abrir etapa.
5. **Investigação da E0** com leitura de `relationship_engine_log`, versão ativa da mensagem, ambiente/modo de execução e retorno do provedor. Correção só depois do diagnóstico, e apenas no ponto exato da falha.
6. **Investigação da dupla autenticação**, com reprodução no navegador. Nenhuma proteção será removida.
7. **Ajustes visuais confirmados:** Princípios Velox reduzido a três quadros (Missão, Valores, Visão) com o conteúdo administrável já existente; Capítulos 1 e 7 da Apresentação Digital sem vídeo (somente conteúdo estático), alterando o roteiro, não o motor de emissão; narrativa "Origem Velox" fica **estruturada como ponto editável antes do Primeiro Passo**, sem texto inventado.

## Fora do escopo desta rodada

Motor E20/E27, Remarketing, `authorization.server.ts`, isolamento Solar/Seguros, carteira das unidades, redirects legados, classificação individual de vídeos.

## Entrega

Ao final: build, typecheck, testes, validação de rotas, dos grupos/etapas, de conteúdo sem vínculo, da E0 e das permissões — com relatório objetivo (inconsistências, correções, não alterado, riscos, testes, arquivos, migrações, decisões manuais pendentes).
