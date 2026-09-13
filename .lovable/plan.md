# Lapidação final das jornadas R e RE — Financeira `/f`

## Escopo preservado

- Alterar somente a organização editorial de R e a ampliação de RE no motor V2 e na Biblioteca existentes.
- Manter intactos `/s`, `/s/portal`, `/seg`, GreenSales, CRM, tags/colunas, regra de entrada comercial, E0–E8, agendamentos, alertas, prioridades, calendário, histórico e filas.
- Não criar tabela, motor, fila, cadência ou fonte de verdade paralela.

## Implementação

### 1. Jornada R e Biblioteca

- Ampliar o fluxo para `R1 → R2 → R3 → R4 → R5`, tornando somente R5 terminal.
- Manter R1 como primeira tentativa após o não comparecimento e R2 como segunda tentativa para definir continuidade, reagendamento ou encerramento.
- Configurar R3 com `SEM_CONTATO` e `MATERIAL_ENVIADO`: no primeiro contexto, oferecer a apresentação; no segundo, reconhecer o envio anterior e definir o interesse.
- Não criar envio automático após R3. Quando a oferta for aceita, o executivo fará o envio manual, registrando-o na fonte estruturada existente.
- Liberar R4 somente no caminho em que houve envio a partir de R3, após sete dias corridos, para solicitar feedback.
- Configurar R5 como encerramento definitivo com `SEM_CONTATO` e `MATERIAL_ENVIADO`, preservando `COM_NOME` e `SEM_NOME`.
- Organizar a Biblioteca em R1, R2, R3, R4, R5 e publicar as mensagens humanizadas já preparadas, sem deixar as novas combinações inativas.

### 2. Ampliação da jornada RE no motor V2

- Ampliar a identidade operacional para `RE0 → RE1 → RE2 → RE3 → RE4 → RE5`, tornando apenas RE5 terminal.
- Preservar RE0→RE1 e usar as transições existentes do motor: RE2 como oferta, RE3 como envio efetivo, RE4 após sete dias como feedback e RE5 como encerramento.
- Manter a abertura atual por nova entrada comercial, a reutilização do mesmo lead, o isolamento por instância de reentrada e a fila atual da Ação do Dia.

### 3. Histórico de apresentação e contextos RE

- Usar o mesmo histórico estruturado de `CONTENT_SENT` já consumido pela jornada E para recalcular, em cada ciclo RE, se material foi enviado anteriormente.
- Fazer RE2 selecionar `SEM_CONTATO` ou `MATERIAL_ENVIADO` sem inferência por texto; ambas as combinações mantêm `COM_NOME` e `SEM_NOME`.
- Fazer a aceitação da oferta conduzir ao envio em RE3 pelo mecanismo existente, sem alterar a jornada E nem criar outro prazo.

### 4. Biblioteca da jornada RE

- Organizar RE0–RE5 na ordem operacional, sem posicionar RE4/RE5 apenas ao final por data de criação.
- Reutilizar as mensagens já preparadas para retomada, critérios, oferta, envio, feedback e encerramento.
- Preservar histórico/versionamento: novas combinações ou etapas sem mensagem aprovada nascem inativas e não enviam nada.

## Validação

- Cobrir transições R/RE, terminais R5/RE5, envio manual no R, histórico com/sem material, contextos editoriais, ações internas e isolamento de ciclos RE.
- Confirmar abertura de RE0 por entrada comercial sem dependência de coluna/tag e sem duplicar lead ou reiniciar E0.
- Executar testes direcionados, verificação de tipos e conferir a compilação automática.
