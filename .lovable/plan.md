# Financeira /f — Diagnóstico da jornada de relacionamento x regra de negócio

Somente leitura. Nada foi alterado: nem código, nem banco, nem configuração, nem fila, nem mensagens.

## 1. Fluxo REAL que o motor executa hoje

A autoridade é `src/lib/relationship/config.ts` (`STEPS` + `FLOW_SEQUENCE`) e `src/lib/relationship/decide.ts`.

- Sem resposta: E0 (ou E0_V1 pelo Portal) → E1 → E3 → E4 → E12 → E30
  (E30 travada por `E30_ENABLED`; com ela desligada, **E12 encerra o fluxo**)
- Visualização (2 leituras sem resposta): E0 → E1 → V3 → V4 (fim)
- Reengajamento (o investidor respondeu): R1 → R2 → R3 (fim)
- Reentrada (lead conhecido que se cadastra de novo): RE0 → RE1 → RE2 → RE3
- Relacionamento frio: RF0 → RF1

Não existem no motor: **E2, E5, E6, E7, E8, R4**. Também **não existe** nenhuma condição de "entrou no caminho do material" nem qualquer tratamento automático de não comparecimento em reunião. Ou seja: a régua de negócio E0→E1→E2→E3→E4→(E5/E6 | E7/E8) **não está implementada** — o motor tem uma régua mais curta, de 5 etapas, com um único caminho.

Como o motor decide: `nextStep` pega a primeira etapa da sequência do fluxo que ainda não foi executada; se a data de vencimento ainda não chegou, agenda; se chegou fora da janela, reagenda para a próxima abertura; se o lead está agendado, interrompido ou encerrado, nada é criado.

## 2. Prazos reais hoje

Cada prazo é contado em **dias úteis a partir da última saída** (última mensagem enviada) ou, quando maior, a partir do momento em que o lead saiu da coluna NOVOS. Não são dias acumulados desde o cadastro.

| Etapa | Prazo (dias úteis após a referência) | Próxima etapa |
|---|---|---|
| E0 / E0_V1 | 0 (imediato) | E1 |
| E1 | 1 | E3 |
| E3 | 2 | E4 |
| E4 | 3 | E12 |
| E12 | 5 | fim (E30 desligada) |
| E30 | 22 a partir do início da jornada | fim (desligada) |
| V3 | 2 | V4 |
| V4 | 3 | fim |
| R1 / R2 / R3 | 2 cada (valor global de reengajamento) | R2 / R3 / fim |
| RE0 / RE1 / RE2 / RE3 | 0 / 2 / 3 / 5 | fim |
| RF0 / RF1 | 1 / 3 | fim |

Etapas E2, E5, E6, E7, E8 e R4 **não têm prazo** porque não existem na configuração.

Janelas: E1+ envia Seg–Sex 09:00–21:00 e Sábado 09:00–12:00; E0 tem janela própria 07:00–22:30 (Sáb até 12:00, domingo não). Feriados nacionais e de SP não contam como dia útil, mais as datas extras cadastradas pela gestão.

## 3. Casos de retorno do investidor — hoje x regra desejada

| Caso | Hoje | Regra desejada | Coincide? |
|---|---|---|---|
| a) Responde em E1/E2/E3/E4 | Fluxo vira reengajamento, estado RESPONDED, automação para; volta só após 2 dias úteis de silêncio, em R1→R2→R3 | Deveria seguir para o caminho do material (E5/E6) quando aceita | Não |
| b) Responde depois do encerramento | Cadência encerrada bloqueia tudo; nenhuma etapa nova é criada | Deveria reabrir em E5 → E6 e encerrar sem repetir a finalização | Não |
| c) Já recebeu material e responde | Nenhuma memória de "já recebeu material" existe; cai no mesmo R1→R2→R3 | Não reofertar material | Não |
| d) Agendou e não compareceu | Agendamento coloca em SCHEDULED e bloqueia tudo; o não comparecimento é apenas registrado no histórico da Ação do Dia, sem nenhuma transição automática | Deveria iniciar R1→R2→R3→R4 | Não |
| e) Já estava em R e não comparece de novo | Nada acontece automaticamente | Continuar de onde parou, sem reiniciar | Não |

Ponto importante: hoje o "R" do sistema é o fluxo de **reengajamento por resposta**, não o fluxo de **não comparecimento**. São duas coisas diferentes usando as mesmas letras.

## 4. A Ação do Dia está preparada?

Já funciona corretamente:
- é apenas leitura da fila persistida; não inventa etapa nem decide jornada;
- mostra a etapa que veio da fila;
- o botão COPIAR busca, no clique, a versão ativa vigente da Biblioteca — não há texto paralelo nem cópia congelada;
- se não existir versão ativa, a ação aparece com o motivo e o COPIAR fica bloqueado, sem inventar conteúdo;
- CONCLUÍDO grava snapshot imutável (texto, id e versão da mensagem, autor, origem), com chave determinística — reconcluir não duplica;
- prazos, dias úteis, feriados e janelas são respeitados pelo motor antes de a obrigação virar item da fila;
- ligação e reunião registram desfecho e observação no histórico.

Ainda não existe:
- criação de obrigação para etapas que não existem no motor (E2, E5, E6, E7, E8, R4);
- ramificação condicional (aceitou material x não evoluiu);
- memória de jornada do tipo "já recebeu o material", "já foi finalizado uma vez";
- transição automática a partir de "não compareceu à reunião";
- retomada pós-encerramento em E5/E6.

## Resumo

1. **Correto hoje:** a arquitetura. Motor decide → fila registra → Ação do Dia executa → Biblioteca fornece o texto vigente → conclusão grava snapshot. Prazos em dias úteis, janelas e calendário funcionam.
2. **Divergente:** a régua. O motor tem 5 etapas lineares (E0, E1, E3, E4, E12) e nenhuma bifurcação; a regra de negócio tem 9 etapas com dois caminhos, retomada pós-finalização e fluxo de não comparecimento com salto condicional.
3. **Falta:** criar as etapas ausentes com prazos próprios, criar as condições de entrada em cada caminho, criar a memória de jornada do lead, criar a transição de não comparecimento e a regra de reabertura pós-encerramento — além dos textos oficiais de cada etapa nova na Biblioteca.
4. **Tamanho:** é **mudança estrutural**, não correção pequena. Muda a definição de fluxo (de lista fixa para caminho condicional) e exige um novo registro do que o lead já recebeu.
5. **Arquivos envolvidos numa futura construção:**
   - `src/lib/relationship/config.ts` (STEPS, FLOW_SEQUENCE, prazos)
   - `src/lib/relationship/decide.ts` (bifurcação e condições de entrada)
   - `src/lib/relationship/machine.ts` e `types.ts` (memória da jornada, eventos de material e de não comparecimento)
   - `src/lib/relationship/flow-plan.ts` e `src/server/relationship/flow-versions.server.ts` (versionamento do novo fluxo)
   - `src/server/relationship/closure.server.ts` e `scheduler.server.ts` (encerramento e reabertura)
   - `src/server/crm/daily-actions*.ts` (desfecho da reunião passando a gerar transição)
   - Biblioteca de Mensagens: textos oficiais das novas etapas
   - Uma migration apenas para a memória da jornada e o versionamento do novo fluxo — sem tocar em histórico existente

Nenhuma dessas mudanças foi feita. Este documento é só o diagnóstico e a recomendação.
