# Diagnóstico da obrigação E0 na Financeira

## Escopo
- Somente a criação da obrigação E0 para os leads atualmente em NOVOS.
- Comparar Carlos (`gs_59464`) e Império (`gs_59468`) com os demais leads sem E0.
- Não alterar código, dados, configurações ou outros fluxos.

## Verificação
1. Confirmar, nos registros atuais, quais leads possuem pendência E0, evento de abertura e item na fila.
2. Rastrear o ponto funcional que decide se a entrada passa pelo caminho operacional que cria E0 ou somente permanece como lead/card já existente.
3. Confrontar datas de entrada e criação dos registros para identificar a condição comum aos excluídos.
4. Entregar somente a condição responsável e a função/arquivo onde ela é aplicada, registrando qualquer divergência entre a quantidade informada e o estado atual.
