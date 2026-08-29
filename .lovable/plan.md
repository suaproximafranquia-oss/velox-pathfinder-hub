# Etapa 3 — Plano Definitivo de Implantação

Ordem obrigatória. Nada aqui altera Portal dos Leads, GreenSales, identidade atômica,
Remarketing estrutural, snapshots históricos ou a regra NOVO/EM ANDAMENTO/ENCERRADO.

## Passo 1 — Camada de rótulos oficiais (sem tocar em chaves técnicas)

Criar um mapa único Word → chave técnica usado só para exibição:

```text
E0 → E0        E1 → E1        E2 → E3        E3 → E4
E5 → E12       E6 → E20 ("E6 — Apresentação Digital")
E7 → (finalização, hoje sem executor)
R1/R2/R3, RE0–RE3, RF0/RF1 → iguais
```

As chaves gravadas em fila, decisões, snapshots e histórico permanecem
inalteradas. Nenhum rename em banco. A UI (Biblioteca, Ação do Dia, ficha)
passa a mostrar o rótulo oficial do Word ao lado da chave técnica.

## Passo 2 — Importação oficial do Word (idempotente)

Rodar a importação já existente para preencher a Biblioteca com o texto do Word,
com e sem nome, versionando apenas quando o texto mudar. E20, E27 e resposta
automática continuam sem texto oficial e permanecem bloqueadas para envio.

## Passo 3 — Higiene dos vínculos de conteúdo

Revisar caso a caso os vínculos duplicados (E1, E3, R2, V3) e definir posição
determinística de rotação. Nenhum conteúdo é apagado — apenas desativado quando
for legado comprovado.

## Passo 4 — Executor de E27 e FINALIZAÇÃO

Hoje a E20 grava `checkpoint_due_at` e `finalization_due_on`, mas nada executa
essas datas. Implementar no motor oficial:

- E27 no vencimento do checkpoint da ocorrência E20 vigente;
- FINALIZAÇÃO no dia útil seguinte;
- cancelamento automático por nova E20 ou por OPORTUNIDADE;
- uma única instância por ocorrência (idempotência por lead + ocorrência + etapa);
- passagem obrigatória pelo motor de mensagens: snapshot, executivo responsável
  e modo de ambiente.

Enquanto não houver texto oficial aprovado para E27/FINALIZAÇÃO, as tarefas
nascem bloqueadas com motivo legível — nunca com texto inventado.

## Passo 5 — Ação do Dia: E20, E27 e FINALIZAÇÃO

Incluir as três como fontes de leitura, respeitando a precedência atual
(Agenda/Reunião > Mensagem > Ligação), um card por lead e demais pendências em
secundário. A Ação do Dia continua somente leitura.

## Passo 6 — Encerramento dos legados

- Remover a chamada de `processWelcome` na entrada de leads e o `retryCrmWelcome`;
- retirar `CRM_FIRST_CONTACT`/`CRM_TEMPLATES` como fonte de texto de envio;
- substituir o `WHATSAPP_NUMBER` fixo pelos destinos resolvidos no servidor nos
  cinco pontos públicos que ainda o usam como fallback.

## Passo 7 — Limpeza visual

- Aba "Jornada do Investidor" some da ficha do CRM (o agregador de servidor
  continua ativo);
- "Pendências de Identidade" some do menu (rota e motor intactos);
- Central de Templates sai do menu; o cadastro técnico do template Meta da E0
  permanece;
- limpeza dos textos apontados no Remarketing, sem alterar regra de campanha.

## Passo 8 — Testes antes do reset

Fluxo completo simulado E0 → E1 → E3 → E4 → E12, E20 com reemissão, E27,
FINALIZAÇÃO, OPORTUNIDADE encerrando tudo, retry sem duplicar mensagem externa
e conferência de que produção real não recebeu nada.

## Passo 9 — Reset de homologação

Somente depois dos passos 1 a 8 aprovados. Registrar contagens antes e depois
das tabelas protegidas para provar que nada real foi tocado.

## Passo 10 — Testes depois do reset

Lead novo deve nascer em NOVO, com E0 como única etapa automática, sem fila de
acompanhamento até a primeira ação humana.

## Migrations necessárias

Apenas uma, no Passo 4: tabela/colunas de controle das tarefas de E27 e
FINALIZAÇÃO com chave única por ocorrência. Nenhuma outra migration é necessária.

## O que não pode ser feito junto

O reset nunca entra no mesmo comando que alterações de motor. O executor de
E27/FINALIZAÇÃO nunca entra junto com a limpeza de legados.
