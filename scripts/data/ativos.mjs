/**
 * Catálogo dos ativos que um negócio pode ter.
 *
 * Cada entrada carrega, além do texto de apresentação, o que o módulo precisa
 * para trabalhar: pré-requisitos, escolhas que o jogador faz na hora de
 * contratar o ativo, e — quando o benefício é um número que o sistema sabe
 * somar — os `changes` de Active Effect correspondentes.
 *
 * O que NÃO vira Active Effect vira lembrete: proficiências, magias extras,
 * permissões narrativas e efeitos que dependem da situação de jogo. Forçar
 * automação nesses casos produziria fichas erradas em silêncio, que é pior do
 * que uma linha de texto que o jogador lê.
 *
 * Fonte das regras: Jornada Heroica - Fim dos Tempos Arco 2: Valkaria.
 */

/** CONST.ACTIVE_EFFECT_MODES.ADD — literal porque este arquivo é lido no import. */
const ADD = 2;

/**
 * Atalho para um bônus que o sistema oferece no diálogo de rolagem.
 *
 * O Tormenta 20 chama isso de efeito "ao usar": ele fica fora da conta até que
 * alguém o marque naquela rolagem. É o lugar certo para os bônus condicionais —
 * o Dojo só vale em ataque desarmado, o Pátio só com a arma treinada — que de
 * outra forma seriam somados em todo teste.
 *
 * `automatic: true` deixa o efeito já marcado quando a rolagem abre: quem não
 * está no caso desmarca, em vez de precisar lembrar de marcar.
 */
const aoUsar = ({
  tipos = ["skill"], pericias = [], nomes = [], chave = "roll", valor = null,
  automatico = true, custo = null
}) => ({
  tipos,
  pericias,
  nomes,
  // O sistema soma isto ao custo de ativação da habilidade, então um número
  // negativo é desconto de PM.
  custo,
  // Vem marcado quando o caso comum é o efeito valer. Um bônus que aparece em
  // toda perícia mas só se aplica de vez em quando começa desmarcado, senão
  // seria somado sem querer a cada rolagem.
  automatico,
  // Sem valor, o efeito aparece na rolagem e não altera nada: serve de
  // lembrete no momento exato em que a regra se aplica, para quem ajusta o
  // resultado à mão.
  changes: valor === null ? [] : [{ key: chave, value: String(valor), type: "add", priority: 0 }]
});

/** Atalho para um bônus de PV/PM, que o sistema lê como fórmula. */
const recurso = (qual, formula) => ({
  key: `system.attributes.${qual}.bonus.total`,
  mode: ADD,
  value: String(formula)
});

export const CATEGORIAS = {
  estrutura: "T20NEG.CatEstrutura",
  pessoal: "T20NEG.CatPessoal",
  producao: "T20NEG.CatProducao",
  mistico: "T20NEG.CatMistico",
  treino: "T20NEG.CatTreino",
  social: "T20NEG.CatSocial",
  comercio: "T20NEG.CatComercio"
};

/**
 * Ícone de cada categoria, para as listas se parecerem com as da ficha do
 * sistema. São imagens que acompanham o Foundry, então não há o que empacotar.
 */
export const ICONES = {
  estrutura: "icons/environment/settlement/house-manor.webp",
  pessoal: "icons/environment/people/group.webp",
  producao: "icons/tools/smithing/anvil.webp",
  mistico: "icons/magic/symbols/runes-star-blue.webp",
  treino: "icons/weapons/swords/greatsword-crossguard-blue.webp",
  social: "icons/environment/settlement/tavern.webp",
  comercio: "icons/commodities/currency/coins-assorted-mix-copper-silver-gold.webp"
};

/** O ícone de um ativo, pela categoria dele. */
export function iconeDe(ativo) {
  return ICONES[ativo?.categoria] ?? ICONES.estrutura;
}

/**
 * Condições que o benefício exige do personagem. O módulo não tenta adivinhar
 * quem é conjurador — quem administra o negócio marca isso na aba Benefícios.
 *
 * O valor é o nome curto da condição, que serve de rótulo para o checkbox. Onde
 * ela aparece como exigência, `exigencia()` monta a frase.
 */
export const CONDICOES = {
  conjuradorArcano: "T20NEG.CondArcano",
  conjuradorDivino: "T20NEG.CondDivino",
  devoto: "T20NEG.CondDevoto"
};

/** O nome curto de uma condição: "Conjurador Arcano". */
export function nomeDaCondicao(chave) {
  return game.i18n.localize(CONDICOES[chave] ?? chave);
}

/** A condição como exigência: "Exige Conjurador Arcano". */
export function exigencia(chave) {
  return game.i18n.format("T20NEG.Exige", { requisitos: nomeDaCondicao(chave) });
}

/**
 * @typedef {object} Ativo
 * @property {string} id
 * @property {string} nome
 * @property {keyof CATEGORIAS} categoria
 * @property {string} resumo      Como o ativo se parece na ficção.
 * @property {string} efeito      O que ele faz em regras, sem rodeios.
 * @property {object} [requisitos] `{ nivel, ativos: [ids] }`
 * @property {object} [escolha]   Decisão que o jogador toma ao contratar.
 * @property {string} [condicao]  Chave de CONDICOES.
 * @property {Function} [changes] `(ctx) => AEChange[]`
 * @property {object} [usos]      `{ por: "aventura", max: n }`
 * @property {string} [nota]      Observação do módulo sobre o texto da regra.
 */

/** @type {Record<string, Ativo>} */
export const ATIVOS = {
  academia: {
    id: "academia",
    nome: "T20NEG.AtivoAcademiaNome",
    categoria: "pessoal",
    resumo: "T20NEG.AtivoAcademiaResumo",
    efeito: "T20NEG.AtivoAcademiaEfeito",
    requisitos: { nivel: 7 },
    escolha: { tipo: "texto", label: "T20NEG.EscolhaParceiro" }
  },

  alfaiataria: {
    id: "alfaiataria",
    nome: "T20NEG.AtivoAlfaiatariaNome",
    categoria: "producao",
    resumo: "T20NEG.AtivoAlfaiatariaResumo",
    efeito: "T20NEG.AtivoAlfaiatariaEfeito",
    requisitos: { ativos: ["oficina"] },
    // O sistema guarda quantos itens vestidos cabem no personagem e expõe essa
    // chave para efeitos. Ela só entra em jogo com a opção "Espaços de
    // equipamento" ligada; sem ela o limite não é conferido e o efeito fica
    // inócuo, sem atrapalhar.
    changes: () => [{ key: "system.equipamentos.limiteVestido", mode: ADD, value: "1" }]
  },

  alojamentos: {
    id: "alojamentos",
    nome: "T20NEG.AtivoAlojamentosNome",
    categoria: "estrutura",
    resumo: "T20NEG.AtivoAlojamentosResumo",
    efeito: "T20NEG.AtivoAlojamentosEfeito"
  },

  altar: {
    id: "altar",
    nome: "T20NEG.AtivoAltarNome",
    categoria: "mistico",
    resumo: "T20NEG.AtivoAltarResumo",
    efeito: "T20NEG.AtivoAltarEfeito",
    condicao: "conjuradorDivino",
    changes: () => [recurso("pm", 2)]
  },

  arena: {
    id: "arena",
    nome: "T20NEG.AtivoArenaNome",
    categoria: "treino",
    resumo: "T20NEG.AtivoArenaResumo",
    efeito: "T20NEG.AtivoArenaEfeito",
    escolha: { tipo: "texto", label: "T20NEG.EscolhaArma" }
  },

  bazar: {
    id: "bazar",
    nome: "T20NEG.AtivoBazarNome",
    categoria: "comercio",
    resumo: "T20NEG.AtivoBazarResumo",
    efeito: "T20NEG.AtivoBazarEfeito"
  },

  botica: {
    id: "botica",
    nome: "T20NEG.AtivoBoticaNome",
    categoria: "treino",
    resumo: "T20NEG.AtivoBoticaResumo",
    efeito: "T20NEG.AtivoBoticaEfeito",
    aoUsar: () => aoUsar({ pericias: ["fort"], valor: 1 })
  },

  cassino: {
    id: "cassino",
    nome: "T20NEG.AtivoCassinoNome",
    categoria: "comercio",
    resumo: "T20NEG.AtivoCassinoResumo",
    efeito: "T20NEG.AtivoCassinoEfeito",
    aoUsar: () => aoUsar({ pericias: ["joga"], valor: 1 }),
    usos: { por: "aventura", max: 1 }
  },

  "centro-de-pesquisa": {
    id: "centro-de-pesquisa",
    nome: "T20NEG.AtivoCentroPesquisaNome",
    categoria: "producao",
    resumo: "T20NEG.AtivoCentroPesquisaResumo",
    efeito: "T20NEG.AtivoCentroPesquisaEfeito",
    requisitos: { ativos: ["oficina"] }
  },

  "circulo-de-poder": {
    id: "circulo-de-poder",
    nome: "T20NEG.AtivoCirculoPoderNome",
    categoria: "mistico",
    resumo: "T20NEG.AtivoCirculoPoderResumo",
    efeito: "T20NEG.AtivoCirculoPoderEfeito",
    condicao: "conjuradorArcano",
    changes: () => [recurso("pm", 2)]
  },

  clinica: {
    id: "clinica",
    nome: "T20NEG.AtivoClinicaNome",
    categoria: "treino",
    resumo: "T20NEG.AtivoClinicaResumo",
    efeito: "T20NEG.AtivoClinicaEfeito",
    changes: () => [recurso("pv", 3)]
  },

  cocheira: {
    id: "cocheira",
    nome: "T20NEG.AtivoCocheiraNome",
    categoria: "pessoal",
    resumo: "T20NEG.AtivoCocheiraResumo",
    efeito: "T20NEG.AtivoCocheiraEfeito"
  },

  conservatorio: {
    id: "conservatorio",
    nome: "T20NEG.AtivoConservatorioNome",
    categoria: "social",
    resumo: "T20NEG.AtivoConservatorioResumo",
    efeito: "T20NEG.AtivoConservatorioEfeito"
  },

  cozinha: {
    id: "cozinha",
    nome: "T20NEG.AtivoCozinhaNome",
    categoria: "producao",
    resumo: "T20NEG.AtivoCozinhaResumo",
    efeito: "T20NEG.AtivoCozinhaEfeito"
  },

  creche: {
    id: "creche",
    nome: "T20NEG.AtivoCrecheNome",
    categoria: "pessoal",
    resumo: "T20NEG.AtivoCrecheResumo",
    efeito: "T20NEG.AtivoCrecheEfeito",
    usos: { por: "aventura", max: 1 }
  },

  dojo: {
    id: "dojo",
    nome: "T20NEG.AtivoDojoNome",
    categoria: "treino",
    resumo: "T20NEG.AtivoDojoResumo",
    efeito: "T20NEG.AtivoDojoEfeito",
    // Oferecido na rolagem de ataque, sem filtrar por arma: o sistema não
    // distingue ali um ataque desarmado de um armado. Quem ataca com espada
    // desmarca.
    aoUsar: () => aoUsar({ tipos: ["attack"], chave: "ataque", valor: 1 })
  },

  emporio: {
    id: "emporio",
    nome: "T20NEG.AtivoEmporioNome",
    categoria: "comercio",
    resumo: "T20NEG.AtivoEmporioResumo",
    efeito: "T20NEG.AtivoEmporioEfeito",
    requisitos: { ativos: ["bazar"] }
    // Sem Active Effect: o Empório muda o rendimento do negócio, não a ficha de
    // ninguém. O cálculo vive em `regras.rendimentoBase`.
  },

  escritorio: {
    id: "escritorio",
    nome: "T20NEG.AtivoEscritorioNome",
    categoria: "comercio",
    resumo: "T20NEG.AtivoEscritorioResumo",
    efeito: "T20NEG.AtivoEscritorioEfeito"
  },

  "espionagem-industrial": {
    id: "espionagem-industrial",
    nome: "T20NEG.AtivoEspionagemNome",
    categoria: "comercio",
    resumo: "T20NEG.AtivoEspionagemResumo",
    efeito: "T20NEG.AtivoEspionagemEfeito",
    requisitos: { nivel: 3 },
    escolha: { tipo: "ativo", label: "T20NEG.EscolhaAtivoCopiado" },
    usos: { por: "aventura", max: 1 }
  },

  estagiarios: {
    id: "estagiarios",
    nome: "T20NEG.AtivoEstagiariosNome",
    categoria: "pessoal",
    resumo: "T20NEG.AtivoEstagiariosResumo",
    efeito: "T20NEG.AtivoEstagiariosEfeito",
    requisitos: { ativos: ["oficina"] }
  },

  estudio: {
    id: "estudio",
    nome: "T20NEG.AtivoEstudioNome",
    categoria: "comercio",
    resumo: "T20NEG.AtivoEstudioResumo",
    efeito: "T20NEG.AtivoEstudioEfeito"
  },

  fachada: {
    id: "fachada",
    nome: "T20NEG.AtivoFachadaNome",
    categoria: "social",
    resumo: "T20NEG.AtivoFachadaResumo",
    efeito: "T20NEG.AtivoFachadaEfeito",
    aoUsar: () => aoUsar({ pericias: ["furt"], valor: 1 })
  },

  forjaria: {
    id: "forjaria",
    nome: "T20NEG.AtivoForjariaNome",
    categoria: "producao",
    resumo: "T20NEG.AtivoForjariaResumo",
    efeito: "T20NEG.AtivoForjariaEfeito",
    requisitos: { ativos: ["oficina"] }
  },

  fortificacao: {
    id: "fortificacao",
    nome: "T20NEG.AtivoFortificacaoNome",
    categoria: "estrutura",
    resumo: "T20NEG.AtivoFortificacaoResumo",
    efeito: "T20NEG.AtivoFortificacaoEfeito"
  },

  "galeria-de-arte": {
    id: "galeria-de-arte",
    nome: "T20NEG.AtivoGaleriaNome",
    categoria: "social",
    resumo: "T20NEG.AtivoGaleriaResumo",
    efeito: "T20NEG.AtivoGaleriaEfeito"
  },

  ginasio: {
    id: "ginasio",
    nome: "T20NEG.AtivoGinasioNome",
    categoria: "treino",
    resumo: "T20NEG.AtivoGinasioResumo",
    efeito: "T20NEG.AtivoGinasioEfeito",
    // Bônus de dano, e não de acerto: o sistema trata isso com a chave `dano`
    // num efeito de ataque — o mesmo caminho das munições que aumentam dano.
    // Sem filtrar por arma, como o Dojo: quem ataca armado desmarca.
    aoUsar: () => aoUsar({ tipos: ["attack"], chave: "dano", valor: 1 })
  },

  "guilda-de-aventureiros": {
    id: "guilda-de-aventureiros",
    nome: "T20NEG.AtivoGuildaNome",
    categoria: "pessoal",
    resumo: "T20NEG.AtivoGuildaResumo",
    efeito: "T20NEG.AtivoGuildaEfeito",
    requisitos: { ativos: ["salao-comunal"] },
    // A variante por marcos é a única com números somáveis; a de XP é um
    // lembrete, porque o Foundry não centraliza a concessão de experiência.
    changes: (ctx) => (ctx.avancoPorMarcos
      ? [recurso("pv", "2*@patamar"), recurso("pm", "2*@patamar")]
      : [])
  },

  integracao: {
    id: "integracao",
    nome: "T20NEG.AtivoIntegracaoNome",
    categoria: "pessoal",
    resumo: "T20NEG.AtivoIntegracaoResumo",
    efeito: "T20NEG.AtivoIntegracaoEfeito",
    requisitos: { nivel: 3 },
    // O treinamento é resolvido por um teste de atributo, e qual atributo
    // depende do que se treina — daí a oferta em todos eles, sem lista de
    // nomes. Quem não está treinando desmarca.
    aoUsar: () => aoUsar({ tipos: ["ability"], valor: 2 })
  },

  jardim: {
    id: "jardim",
    nome: "T20NEG.AtivoJardimNome",
    categoria: "mistico",
    resumo: "T20NEG.AtivoJardimResumo",
    efeito: "T20NEG.AtivoJardimEfeito",
    // O desconto sai pelo custo do próprio efeito, que o sistema soma ao custo
    // de ativação — negativo, portanto, é desconto. Vale nas três formas do
    // poder. Sem tipo: o filtro passa a ser só o nome.
    aoUsar: () => aoUsar({
      tipos: [],
      nomes: ["Forma Selvagem", "Forma Selvagem Aprimorada", "Forma Selvagem Superior"],
      custo: -1
    })
  },

  "laboratorio-alquimico": {
    id: "laboratorio-alquimico",
    nome: "T20NEG.AtivoLabAlquimicoNome",
    categoria: "producao",
    resumo: "T20NEG.AtivoLabAlquimicoResumo",
    efeito: "T20NEG.AtivoLabAlquimicoEfeito",
    requisitos: { ativos: ["oficina"] },
    // "1d" é como o sistema escreve "mais um dado do mesmo tipo": um fogo
    // alquímico de 1d6 passa a rolar 1d6+1d6.
    aoUsar: () => aoUsar({ tipos: ["consumable"], chave: "dano", valor: "1d" })
  },

  "laboratorio-secreto": {
    id: "laboratorio-secreto",
    nome: "T20NEG.AtivoLabSecretoNome",
    categoria: "mistico",
    resumo: "T20NEG.AtivoLabSecretoResumo",
    efeito: "T20NEG.AtivoLabSecretoEfeito",
    requisitos: { nivel: 5, ativos: ["fachada"] },
    escolha: { tipo: "texto", label: "T20NEG.EscolhaPoderTormenta" }
  },

  livraria: {
    id: "livraria",
    nome: "T20NEG.AtivoLivrariaNome",
    categoria: "social",
    resumo: "T20NEG.AtivoLivrariaResumo",
    efeito: "T20NEG.AtivoLivrariaEfeito",
    aoUsar: () => aoUsar({ pericias: ["conh"], valor: 1 })
  },

  logistica: {
    id: "logistica",
    nome: "T20NEG.AtivoLogisticaNome",
    categoria: "estrutura",
    resumo: "T20NEG.AtivoLogisticaResumo",
    efeito: "T20NEG.AtivoLogisticaEfeito",
    changes: () => [{ key: "system.attributes.carga.bonus", mode: ADD, value: "5" }]
  },

  "mercado-multinivelado": {
    id: "mercado-multinivelado",
    nome: "T20NEG.AtivoMercadoNome",
    categoria: "comercio",
    resumo: "T20NEG.AtivoMercadoResumo",
    efeito: "T20NEG.AtivoMercadoEfeito",
    requisitos: { nivel: 3 }
  },

  oficina: {
    id: "oficina",
    nome: "T20NEG.AtivoOficinaNome",
    categoria: "producao",
    resumo: "T20NEG.AtivoOficinaResumo",
    efeito: "T20NEG.AtivoOficinaEfeito",
    // Ofício não é uma perícia só: o sistema guarda uma chave por ofício, e o
    // bônus é oferecido em todos eles.
    aoUsar: (ctx) => aoUsar({ pericias: ctx.oficios, valor: 1 })
  },

  ourivesaria: {
    id: "ourivesaria",
    nome: "T20NEG.AtivoOurivesariaNome",
    categoria: "producao",
    resumo: "T20NEG.AtivoOurivesariaResumo",
    efeito: "T20NEG.AtivoOurivesariaEfeito",
    usos: { por: "aventura", max: 1 }
  },

  palco: {
    id: "palco",
    nome: "T20NEG.AtivoPalcoNome",
    categoria: "social",
    resumo: "T20NEG.AtivoPalcoResumo",
    efeito: "T20NEG.AtivoPalcoEfeito"
  },

  "patio-de-treinamento": {
    id: "patio-de-treinamento",
    nome: "T20NEG.AtivoPatioNome",
    categoria: "treino",
    resumo: "T20NEG.AtivoPatioResumo",
    efeito: "T20NEG.AtivoPatioEfeito",
    escolha: { tipo: "texto", label: "T20NEG.EscolhaArma" },
    // A arma treinada é a escolha do ativo; sem ela não há o que oferecer.
    aoUsar: (ctx) => (ctx.escolha
      ? aoUsar({ tipos: ["attack"], nomes: [ctx.escolha], chave: "ataque", valor: 1 })
      : null)
  },

  "plano-de-carreira": {
    id: "plano-de-carreira",
    nome: "T20NEG.AtivoPlanoCarreiraNome",
    categoria: "pessoal",
    resumo: "T20NEG.AtivoPlanoCarreiraResumo",
    efeito: "T20NEG.AtivoPlanoCarreiraEfeito",
    requisitos: { nivel: 3 },
    // Uma busca pode usar qualquer perícia, então o efeito é oferecido em
    // todas — e desmarcado, porque a maioria das rolagens não é uma busca.
    aoUsar: () => aoUsar({ valor: 2, automatico: false })
  },

  propaganda: {
    id: "propaganda",
    nome: "T20NEG.AtivoPropagandaNome",
    categoria: "social",
    resumo: "T20NEG.AtivoPropagandaResumo",
    efeito: "T20NEG.AtivoPropagandaEfeito",
    requisitos: { nivel: 2 },
    escolha: {
      tipo: "opcoes",
      label: "T20NEG.EscolhaPericiaSocial",
      opcoes: { dipl: "T20NEG.PericiaDiplomacia", enga: "T20NEG.PericiaEnganacao" }
    },
    aoUsar: (ctx) => (ctx.escolha ? aoUsar({ pericias: [ctx.escolha], valor: 1 }) : null)
  },

  "salao-comunal": {
    id: "salao-comunal",
    nome: "T20NEG.AtivoSalaoComunalNome",
    categoria: "social",
    resumo: "T20NEG.AtivoSalaoComunalResumo",
    efeito: "T20NEG.AtivoSalaoComunalEfeito",
    // Quem já tem Mestre dos Sussurros soma o nível do negócio nos testes de
    // perícia feitos com o poder — perícias sociais, conforme a conversa.
    aoUsar: (ctx) => aoUsar({ pericias: ["dipl", "enga", "inti", "inve"], valor: ctx.nivel })
  },

  "salao-de-baile": {
    id: "salao-de-baile",
    nome: "T20NEG.AtivoSalaoBaileNome",
    categoria: "social",
    resumo: "T20NEG.AtivoSalaoBaileResumo",
    efeito: "T20NEG.AtivoSalaoBaileEfeito",
    aoUsar: () => aoUsar({ pericias: ["nobr"], valor: 1 })
  },

  "salao-de-marah": {
    id: "salao-de-marah",
    nome: "T20NEG.AtivoSalaoMarahNome",
    categoria: "mistico",
    resumo: "T20NEG.AtivoSalaoMarahResumo",
    efeito: "T20NEG.AtivoSalaoMarahEfeito",
    changes: () => [recurso("pm", "@patamar")]
  },

  santuario: {
    id: "santuario",
    nome: "T20NEG.AtivoSantuarioNome",
    categoria: "mistico",
    resumo: "T20NEG.AtivoSantuarioResumo",
    efeito: "T20NEG.AtivoSantuarioEfeito",
    requisitos: { ativos: ["altar"] },
    condicao: "devoto",
    escolha: { tipo: "texto", label: "T20NEG.EscolhaDivindade" }
  },

  "torre-arcana": {
    id: "torre-arcana",
    nome: "T20NEG.AtivoTorreArcanaNome",
    categoria: "mistico",
    resumo: "T20NEG.AtivoTorreArcanaResumo",
    efeito: "T20NEG.AtivoTorreArcanaEfeito",
    requisitos: { ativos: ["circulo-de-poder"] },
    condicao: "conjuradorArcano"
  }
};

/** Lista ordenada alfabeticamente pelo nome já traduzido. */
export function listarAtivos() {
  return Object.values(ATIVOS).sort((a, b) =>
    game.i18n.localize(a.nome).localeCompare(game.i18n.localize(b.nome), "pt-BR")
  );
}

/**
 * Verifica se um ativo pode ser contratado por um negócio.
 * Devolve `{ ok, faltando: { nivel, ativos: [Ativo] } }`.
 */
export function checarRequisitos(ativo, { nivel, ativosContratados }) {
  const req = ativo.requisitos ?? {};
  const faltando = { nivel: null, ativos: [] };

  if (req.nivel && nivel < req.nivel) faltando.nivel = req.nivel;
  for (const id of req.ativos ?? []) {
    if (!ativosContratados.includes(id)) faltando.ativos.push(ATIVOS[id]);
  }

  return { ok: !faltando.nivel && !faltando.ativos.length, faltando };
}

/** Ativos que outros ativos exigem — usado para avisar antes de demitir um. */
export function dependentesDe(id, ativosContratados) {
  return ativosContratados
    .filter((outro) => (ATIVOS[outro]?.requisitos?.ativos ?? []).includes(id))
    .map((outro) => ATIVOS[outro]);
}
