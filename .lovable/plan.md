# Micro-reset seletivo da homologação temporal — Financeira `/f`

## Objetivo
Desconectar da operação normal da Financeira apenas o relógio ambiental, o gate do Workspace/Portal, a allowlist dos quatro leads e seus controles visuais. Manter intactas as regras comerciais, dados, histórico e correções reais posteriores ao ZIP 27.

## Alterações

1. **Restaurar o tempo real na operação normal**
   - Fazer `productionEngine()` usar `realClock` diretamente.
   - Substituir `envNow()` por `new Date()` somente nos consumidores produtivos atuais da Financeira.
   - Retirar do scheduler e da Ação do Dia a atualização explícita do relógio ambiental.
   - Nos arquivos com correções misturadas — especialmente estado V2, repositório e log da Ação do Dia — alterar apenas a fonte do “agora”, sem restaurar versões antigas nem modificar decisões de negócio.

2. **Desconectar os controles temporais da interface**
   - Remover da Central de Homologação a montagem dos cartões de relógio e gate.
   - Manter arquivos e registros históricos de homologação inertes quando não houver necessidade segura de apagá-los.
   - Não criar funções, tabelas ou migrations substitutas.

3. **Liberar a entrada normal GreenSales → Workspace → Portal**
   - Remover dos caminhos produtivos as chamadas ao gate de materialização.
   - Eliminar a dependência operacional da allowlist `59034`, `59037`, `59081`, `59279`.
   - Preservar deduplicação, identidade, sincronização, follow-up, notas e toda a lógica normal de criação/atualização de cards.

4. **Preservar o produto atual**
   - Não alterar definições E0–E8, R, RE, RF ou V.
   - Não tocar Biblioteca, modal, clipboard, E5/RE2 manuais, claims, posição 1, continuidade, `result.queue`, compromissos, follow-up, notas, identidade, alertas ou calendário.
   - Não alterar migrations nem escrever no banco.
   - Não apagar leads, filas, eventos, cadências ou histórico.

## Validação objetiva

- Executar verificação de tipos e apenas testes relacionados aos arquivos modificados.
- Confirmar por busca que consumidores produtivos não usam mais `environmentClock()`, `envNow()` ou atualização do relógio ambiental.
- Confirmar que `productionEngine()` usa `realClock`.
- Confirmar que os caminhos normais de materialização não chamam o gate nem a allowlist.
- Consultar em modo somente leitura a existência dos quatro leads antes e depois, sem alterar seus registros.
- Verificar o build automático e registrar quaisquer arquivos de laboratório que permanecerem intencionalmente inertes.
