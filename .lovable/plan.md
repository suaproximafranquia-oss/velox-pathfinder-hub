# Lapidação final das jornadas R e RE — Financeira `/f`

## Escopo preservado

- Alterar somente a organização editorial de R e a ampliação de RE no motor V2 e na Biblioteca existentes.
- Manter intactos `/s`, `/s/portal`, `/seg`, GreenSales, CRM, tags/colunas, regra de entrada comercial, E0–E8, agendamentos, alertas, prioridades, calendário, histórico e filas.
- Não criar tabela, motor, fila, cadência ou fonte de verdade paralela.

## Implementação

### 1. Biblioteca da jornada R

- Manter a transição atual `R1 → R2 → R3 → R4` e apenas organizar a apresentação nessa ordem.
- Configurar R3 e R4 com os contextos existentes `SEM_CONTATO` e `MATERIAL_ENVIADO`, cada um preservando as variantes `COM_NOME` e `SEM_NOME`.
- Reaproveitar somente mensagens R já existentes; qualquer combinação sem texto aprovado ficará como slot inativo, sem conteúdo inventado.

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

- Cobrir transições R/RE, terminal RE5, histórico com/sem material, contextos editoriais, ações internas e isolamento de ciclos RE.
- Confirmar abertura de RE0 por entrada comercial sem dependência de coluna/tag e sem duplicar lead ou reiniciar E0.
- Executar testes direcionados, verificação de tipos e conferir a compilação automática.
