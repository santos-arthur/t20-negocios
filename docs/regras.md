# As regras, como o módulo as implementa

Anotações de referência sobre as regras de Negócios de
**Jornada Heroica - Fim dos Tempos Arco 2: Valkaria**, e sobre as decisões que o
módulo tomou ao traduzi-las para o Foundry.

Isto não substitui o livro: é o registro do que virou código e por quê.

## Fundação

Um mês de trabalho, T$ 1.000 e um teste de Ofício ou Nobreza contra CD 20.
Passando, nasce um negócio de nível 1. Falhando, o mês e o dinheiro se perdem e a
tentativa pode ser repetida ao custo de outro mês e outros mil tibares.

O módulo rola o teste **antes** de criar o documento, justamente porque a falha
não produz negócio nenhum.

## Níveis e expansão

Os níveis vão de 1 a 7 e medem tamanho, influência e prosperidade. O módulo permite
elevar esse teto por configuração do mundo, para campanhas que queiram ir além.

| Faixa | Porte |
| --- | --- |
| 1–2 | poucos empregados, mercadoria barata |
| 3–5 | vários empregados ou mercadoria valiosa |
| 6–7 | estabelecimento proeminente, mercadoria cara |

Subir um nível custa um mês de trabalho, **T$ 1.000 × o próximo nível**, e um
teste de Ofício ou Nobreza contra **CD 20 + 2 × o próximo nível**.

Dois ativos alteram essa conta, e o módulo já mostra os valores corrigidos:
o **Estúdio** reduz a CD em 5 e o **Escritório** corta o custo pela metade.

## Ativos

Um ativo por nível. Cada um descreve o que o negócio é e concede um benefício a
quem o frequenta — o proprietário e o resto do grupo.

O benefício vale enquanto o personagem tem acesso ao negócio e por até um mês
depois. "Longe do negócio" é longe o bastante para não poder frequentá-lo ao
menos uma vez por semana.

Benefícios de ativos são **benefícios de estruturas**: acumulam com habilidades,
perícias, itens, magias, parceiros e ambiente, mas não com outras estruturas,
como dádivas, domínios e bases. O módulo exibe esse aviso na aba de benefícios,
mas não tem como verificar o acúmulo sozinho — isso fica com a mesa.

### O que o módulo aplica sozinho

Vinte e dois ativos são atendidos pelo módulo. Eles se dividem em
dois grupos, conforme a natureza do bônus.

**Somados na ficha** — valem o tempo todo, então viram Active Effects comuns.
Um efeito por ativo, para o jogador ver de onde cada bônus vem e poder desligar
um sem perder os outros.

| Ativo | Efeito na ficha | Caminho no sistema |
| --- | --- | --- |
| Alfaiataria | +1 item vestido | `system.equipamentos.limiteVestido` |
| Altar | +2 PM (conjurador divino) | `system.attributes.pm.bonus.total` |
| Círculo de Poder | +2 PM (conjurador arcano) | `system.attributes.pm.bonus.total` |
| Clínica | +3 PV | `system.attributes.pv.bonus.total` |
| Guilda de Aventureiros | +2 PV e +2 PM por patamar (só na variante por marcos) | `pv`/`pm.bonus.total` |
| Logística | +5 espaços de carga | `system.attributes.carga.bonus` |
| Salão de Marah | +1 PM por patamar | `system.attributes.pm.bonus.total` |

**Oferecidos na rolagem** — bônus de perícia e de ataque usam o mecanismo de
efeito "ao usar" do sistema: aparecem como opção no diálogo daquela rolagem e
quem não está no caso desmarca.

Vêm **marcados** quando o caso comum é o efeito valer — a Botica vale em todo
teste de Fortitude de quem frequenta o negócio. Vêm **desmarcados** quando
aparecem em muitas rolagens mas só se aplicam de vez em quando, como o Plano de
Carreira, que vale para buscas e seria somado sem querer a cada teste.

A diferença não é de conveniência, é de regra. O +1 em Fortitude da Botica vale
por frequentar o negócio, não é um bônus permanente do personagem; oferecê-lo na
rolagem deixa visível de onde vem e permite recusá-lo quando a situação não
couber — o herói longe da cidade, a perícia usada por outro motivo.

| Ativo | Aparece ao rolar | Efeito |
| --- | --- | --- |
| Botica | Fortitude | +1 |
| Integração | qualquer teste de atributo | +2 |
| Jardim | Forma Selvagem, Aprimorada e Superior | −1 PM no custo |
| Laboratório Alquímico | ao usar um consumível | +1 dado do mesmo tipo |
| Cassino | Jogatina | +1 |
| Dojo | qualquer rolagem de ataque | +1 no acerto |
| Ginásio | qualquer rolagem de ataque | +1 no dano |
| Fachada | Furtividade | +1 |
| Livraria | Conhecimento | +1 |
| Oficina | cada Ofício | +1 |
| Plano de Carreira | qualquer perícia (desmarcado) | +2 |
| Pátio de Treinamento | ataque com a arma escolhida | +1 |
| Propaganda | Diplomacia ou Enganação, à escolha | +1 |
| Salão Comunal | Diplomacia, Enganação, Intimidação, Investigação | + nível do negócio |
| Salão de Baile | Nobreza | +1 |

Isso depende de a rolagem sair pela ficha do personagem. Um teste rolado à mão
no chat não enxerga esses efeitos.

Alguns desses efeitos não somam num teste, e sim no **custo em PM** da
habilidade: o sistema soma o custo do efeito ao da ativação, então um valor
negativo vira desconto. É como o Jardim tira 1 PM da Forma Selvagem.

Os demais 23 aparecem como lembretes. Proficiências, magias adicionais, trocas
de perícia, descontos de compra e permissões narrativas dependem de julgamento
na mesa; aplicá-los automaticamente produziria fichas erradas em silêncio.

### Condições

Alguns ativos só beneficiam quem cumpre uma condição — ser conjurador arcano,
conjurador divino, ou devoto da divindade do santuário. O módulo não tenta
adivinhar: cada beneficiário tem caixas de seleção na aba de benefícios, e quem
não cumpre a condição vê o ativo listado como sem efeito, em vez de receber um
bônus que não existe.

### Espionagem Industrial

O ativo copia outro que o negócio não tem mas cujos pré-requisitos cumpre. No
módulo, ele é contratado primeiro e o alvo é escolhido depois, num seletor que
confere os pré-requisitos. O ativo copiado aparece na lista de benefícios com a
marca de origem.

## Rendimentos e as duas moedas

O capítulo conta em duas unidades, e a diferença é de dez para um:

- **T$** (tibar) — rendimento comum, custo de fundação e de expansão.
- **TO** (tibar de ouro) — Empório e Cassino. Um TO vale dez tibares.

| Fonte | Fórmula | Em tibares |
| --- | --- | --- |
| Rendimento comum | T$ 100 × nível | 100 × nível |
| Mês dedicado (com teste) | resultado × 10 × nível | idem |
| Com Empório | TO 100 × nível | 1.000 × nível |
| Com Empório, mês dedicado | resultado × 10 × nível, em TO | resultado × 100 × nível |
| Cassino, dado par | TO 10 × nível² | 100 × nível² |
| Cassino, dado ímpar | perde metade | −50 × nível² |
| Mercado Multinivelado | T$ 100 × nível × NPCs recrutados | idem |

É a troca de unidade que dá sentido ao Empório: sem ela, o ativo gastaria uma
vaga e exigiria o Bazar para repetir a fórmula que o negócio já tinha.

O multiplicador do Mercado Multinivelado sobe um degrau por NPC com nome
recrutado, limitado ao nível do negócio.

Quando o Cassino perde mais do que há em caixa, o que falta vira dívida e é
abatido do próximo ganho — o módulo guarda esse saldo e mostra o aviso.

## O que fica com a mesa

- Quem conta como tendo acesso ao negócio, e quando o acesso se perde.
- O acúmulo entre benefícios de estruturas diferentes.
- Todo efeito narrativo: a má fama de frequentar certos lugares, as tramas contra
  o negócio, o que é preciso para recrutar um NPC específico.
- A concessão de XP da Guilda de Aventureiros, que o Foundry não centraliza.
