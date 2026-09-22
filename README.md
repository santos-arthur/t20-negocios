# Negócios — Tormenta 20

Um módulo para **Foundry VTT** que põe em jogo as regras de negócios de
**Tormenta 20**. O herói funda uma taverna, uma forja, uma botica; o negócio
cresce em níveis, contrata ativos, rende tibares — e quem frequenta o lugar leva
os benefícios para a própria ficha, sem ninguém ter que lembrar de somar nada.

As regras de negócios são da [**Jambô Editora**](https://jamboeditora.com.br) e
foram publicadas em **Jornada Heroica - Fim dos Tempos Arco 2: Valkaria**. Este
módulo não traz o texto do livro — só as põe para rodar. Para entender o sistema
por completo, adquira o livro na [loja da Jambô](https://jamboeditora.com.br).

> Módulo **não oficial**, feito por fã, sem vínculo com a Jambô Editora.
> Tormenta 20 é marca da Jambô Editora.

---

## O que o módulo faz

- **Ficha própria para o negócio**, com as abas Visão geral, Ativos, Benefícios
  e Registro.
- **Fundação e expansão em níveis**, com custo, CD e prazo calculados — já
  corrigidos pelo Estúdio e pelo Escritório.
- **Catálogo completo dos 45 ativos**, com bônus e condições de cada um.
- **Rendimentos** com ou sem mês dedicado, direto para o cofre do negócio.
- **Benefícios aplicados nos personagens com acesso**: os bônus aparecem na
  ficha e no diálogo de rolagem, com o nome do negócio de onde vieram.
- **Permissões por proprietário**: o jogador dono administra o próprio negócio,
  sem depender do mestre.

---

## O princípio: o negócio não é um bônus permanente

As regras de negócios são boas e quase nunca entram em jogo, por um motivo
administrativo: são 45 ativos, cada um com um bônus e uma condição. O jogador
contrata uma Botica, anota num canto da ficha, e três sessões depois ninguém
lembra que ele tem +1 em Fortitude.

Só que um personagem com a Botica não tem +1 em Fortitude. Ele tem acesso a uma
botica **enquanto frequenta o negócio**. Por isso os bônus de perícia e de
ataque não entram somados na ficha: aparecem **no diálogo de rolagem**, já
marcados, com o nome do negócio.

```
  Teste de Fortitude
  ☑ Taverna do Corvo: Botica     +1
```

Você desmarca quando o caso não se aplicar. Bônus que valem sempre — PV, PM,
limite de carga — esses sim entram como efeito comum na ficha.

O que o módulo não sabe decidir (proficiências, magias adicionais, permissões
narrativas) ele não automatiza: vira lembrete. Uma ficha silenciosamente errada
custa mais caro do que uma linha de texto que o jogador lê.

---

## Requisitos

| | |
|---|---|
| Foundry VTT | versão 14 |
| Sistema | [`tormenta20`](https://gitlab.com/vizael/Tormenta20), 1.6 ou maior |
| Outros módulos | nenhum |

Não funciona em outro sistema: os bônus vão para campos da ficha do Tormenta 20
e as janelas vestem o estilo dele.

---

## Instalação

No Foundry, vá em **Configurações → Gerenciar Módulos → Instalar Módulo** e
procure por **Negócios — Tormenta 20**, ou cole a URL do manifesto:

```
https://github.com/santos-arthur/t20-negocios/releases/latest/download/module.json
```

---

## Usando

A janela **Negócios** abre pelo botão no topo do diretório de Atores ou pela
ferramenta de notas na barra do mapa. Cada negócio é um Actor de tipo próprio.

### Fundando e crescendo

Fundar custa um mês, T$ 1.000 e um teste de Ofício ou Nobreza contra CD 20 —
gastos mesmo se falhar. Cada nível novo custa outro mês, `T$ 1.000 × o próximo
nível`, um teste contra `CD 20 + 2 × o próximo nível`, e abre **uma vaga de
ativo**.

O **Estúdio** tira 5 da CD e o **Escritório** corta o custo pela metade; a ficha
já mostra os valores corrigidos. Os testes saem pela ficha do personagem, no
diálogo de rolagem do próprio sistema.

Escolha um proprietário ao fundar — é ele quem administra depois. Sem
proprietário, só o mestre mexe.

### Rendendo

| | Quanto |
|---|---|
| Sem dedicação | T$ 100 × o nível, por aventura ou mês |
| Com um mês dedicado | resultado do teste × 10 × o nível |
| Com o Empório | dez vezes isso, porque a conta passa a ser em TO |

O dinheiro entra no **cofre** do negócio, separado da bolsa do proprietário.

### Dando acesso

Na aba **Benefícios**, adicione os personagens que frequentam o lugar. Alguns
ativos só valem para conjuradores ou devotos — marque isso em cada um, porque o
módulo não adivinha.

> **Depois de atualizar o módulo, use "Sincronizar as fichas" uma vez.**

### Quem pode o quê

| | Mestre | Proprietário | Demais |
|---|:---:|:---:|:---:|
| Ver a ficha | ✓ | ✓ | ✓ |
| Administrar o negócio | ✓ | ✓ | — |
| Ajustar o nível sem teste | ✓ | — | — |
| Sincronizar as fichas | todas | todas | **só as suas** |

### Configurações do mundo

| Configuração | O que muda |
|---|---|
| **Aplicar benefícios automaticamente** | Desligue para usar o módulo só como referência |
| **O grupo avança por marcos** | Muda o benefício da Guilda de Aventureiros, que em XP o módulo não consegue aplicar |
| **Nível máximo de um negócio** | As regras vão até 7; aumente se a sua campanha permitir |

---

## Solução de problemas

| Sintoma | Causa provável |
|---|---|
| Os bônus não aparecem na ficha | Use **Sincronizar as fichas**, na aba Benefícios |
| Um ativo aparece como "sem efeito para este personagem" | Falta marcar a condição dele (conjurador, devoto) |
| O jogador não consegue mexer no negócio | Ele não é o proprietário. Defina-o no cabeçalho da ficha |
| A opção do ativo não aparece na rolagem | O teste precisa ser rolado **pela ficha**; um `/r` no chat não enxerga os efeitos |
| O botão de expandir sumiu | O negócio chegou ao nível máximo configurado no mundo |
| A ficha abre sem nada | Dê F5. Se persistir, rode o [script de diagnóstico](https://github.com/santos-arthur/t20-negocios/blob/main/docs/diagnostico.js) no console (F12) |

Encontrou um bug? Abra uma [issue no GitHub](https://github.com/santos-arthur/t20-negocios/issues).

---

## Créditos e licença

- **Regras de negócios:** [Jambô Editora](https://jamboeditora.com.br), em
  *Jornada Heroica - Fim dos Tempos Arco 2: Valkaria*. Todos os direitos sobre
  as regras e sobre Tormenta 20 pertencem à Jambô.
- **Sistema Tormenta20 para Foundry:** [vizael e colaboradores](https://gitlab.com/vizael/Tormenta20).
- **Módulo:** Arthur Santos — projeto pessoal, escrito para a própria mesa e
  liberado para quem quiser usar.

O código do módulo está sob a licença
[MIT](https://github.com/santos-arthur/t20-negocios/blob/main/LICENSE). A
licença cobre apenas o código, não as regras nem a marca Tormenta 20.
