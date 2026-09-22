/**
 * As ações que mudam um negócio: fundar, expandir, apurar rendimento, girar a
 * roleta do Cassino, fechar a folha do Mercado Multinivelado.
 *
 * Cada função é o par "rola o teste, grava o resultado, registra no chat" —
 * mantidas fora das aplicações de interface para que a ficha do negócio cuide
 * só de desenhar, e para que uma macro possa chamá-las diretamente.
 *
 * Fonte das regras: Jornada Heroica - Fim dos Tempos Arco 2: Valkaria.
 */

import { CONFIGS, ICONE_PADRAO, MODULO, TIPO_NEGOCIO, nivelMaximo } from "../constants.mjs";
import * as Regras from "../data/regras.mjs";
import * as Chat from "./chat.mjs";
import { criarComApoio } from "./socket.mjs";
import * as T20 from "./t20-adapter.mjs";

/* -------------------------------------------- */
/*  Fundação                                    */
/* -------------------------------------------- */

/**
 * Funda um negócio. O teste já deve ter sido rolado pela interface, porque a
 * regra permite tentar de novo — gastando outro mês e mais mil tibares — e essa
 * decisão é do jogador, não do código.
 *
 * @param {object} dados `{ nome, ramo, local, proprietarioId, resultado }`
 * @returns {Promise<{sucesso: boolean, negocio: Actor|null, delegado: boolean}>}
 *   `delegado` indica que o Mestre é quem vai materializar o documento.
 */
export async function fundar({ nome, ramo = "", local = "", proprietarioId = null, resultado }) {
  const proprietario = proprietarioId ? game.actors.get(proprietarioId) : null;

  if (!resultado.sucesso) {
    await Chat.publicar({
      negocio: { name: nome, img: ICONE_PADRAO, system: { atorProprietario: proprietario } },
      titulo: game.i18n.format("T20NEG.ChatFundacaoTitulo", { nome }),
      texto: game.i18n.localize("T20NEG.ChatFundacaoFalha"),
      linhas: [
        { rotulo: game.i18n.localize("T20NEG.CD"), valor: String(Regras.CD_CRIACAO) },
        { rotulo: game.i18n.localize("T20NEG.Resultado"), valor: String(resultado.total) },
        { rotulo: game.i18n.localize("T20NEG.Investimento"), valor: Chat.tibares(Regras.CUSTO_CRIACAO) }
      ],
      roll: resultado.roll,
      desfecho: "falha"
    });
    return { sucesso: false, negocio: null, delegado: false };
  }

  const negocio = await criarComApoio({
    name: nome,
    type: TIPO_NEGOCIO,
    img: ICONE_PADRAO,
    folder: await pastaDeNegocios(),
    ownership: montarOwnership(proprietario),
    system: {
      nivel: 1,
      ramo,
      local,
      proprietario: proprietario?.id ?? null,
      registro: [
        {
          tipo: "fundacao",
          texto: game.i18n.format("T20NEG.RegistroFundacao", { resultado: resultado.total }),
          valor: -Regras.CUSTO_CRIACAO,
          timestamp: Date.now()
        }
      ],
      beneficiarios: proprietario
        ? [{ actorId: proprietario.id, conjuradorArcano: false, conjuradorDivino: false, devoto: false }]
        : []
    }
  });

  await Chat.publicar({
    negocio: negocio ?? { name: nome, img: ICONE_PADRAO, system: { atorProprietario: proprietario } },
    titulo: game.i18n.format("T20NEG.ChatFundacaoTitulo", { nome }),
    texto: game.i18n.localize("T20NEG.ChatFundacaoSucesso"),
    linhas: [
      { rotulo: game.i18n.localize("T20NEG.CD"), valor: String(Regras.CD_CRIACAO) },
      { rotulo: game.i18n.localize("T20NEG.Resultado"), valor: String(resultado.total) },
      { rotulo: game.i18n.localize("T20NEG.Investimento"), valor: Chat.tibares(Regras.CUSTO_CRIACAO) }
    ],
    roll: resultado.roll,
    desfecho: "sucesso"
  });

  return { sucesso: true, negocio, delegado: !negocio };
}

/** Dá ao jogador do proprietário o controle do próprio negócio. */
function montarOwnership(proprietario) {
  const ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER };
  if (!proprietario) return ownership;

  for (const [userId, nivel] of Object.entries(proprietario.ownership)) {
    if (userId === "default") continue;
    if (nivel === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
      ownership[userId] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    }
  }
  return ownership;
}

/** A pasta onde os negócios se juntam no diretório de Atores. */
async function pastaDeNegocios() {
  const guardado = game.settings.get(MODULO, CONFIGS.pastaNegocios);
  const existente = guardado ? game.folders.get(guardado) : null;
  if (existente) return existente.id;
  if (!game.user.isGM) return null;

  const pasta = await Folder.create({ name: game.i18n.localize("T20NEG.PastaNegocios"), type: "Actor" });
  await game.settings.set(MODULO, CONFIGS.pastaNegocios, pasta.id);
  return pasta.id;
}

/* -------------------------------------------- */
/*  Expansão                                    */
/* -------------------------------------------- */

/**
 * Sobe o negócio um nível. Em caso de falha o mês e o dinheiro se perdem —
 * o negócio fica como estava.
 */
export async function expandir(negocio, resultado) {
  const { nivel, proximoNivel, cdExpansao, custoExpansao } = negocio.system;
  if (!proximoNivel) return false;

  const linhas = [
    { rotulo: game.i18n.localize("T20NEG.CD"), valor: String(cdExpansao) },
    { rotulo: game.i18n.localize("T20NEG.Resultado"), valor: String(resultado.total) },
    { rotulo: game.i18n.localize("T20NEG.Investimento"), valor: Chat.tibares(custoExpansao) }
  ];

  const registro = {
    tipo: resultado.sucesso ? "expansao" : "expansao-falha",
    texto: resultado.sucesso
      ? game.i18n.format("T20NEG.RegistroExpansao", { nivel: proximoNivel, resultado: resultado.total })
      : game.i18n.format("T20NEG.RegistroExpansaoFalha", { nivel: proximoNivel, resultado: resultado.total }),
    valor: -custoExpansao,
    timestamp: Date.now()
  };

  await negocio.update({
    "system.nivel": resultado.sucesso ? proximoNivel : nivel,
    "system.registro": [...negocio.system.registro, registro]
  });

  await Chat.publicar({
    negocio,
    titulo: game.i18n.format("T20NEG.ChatExpansaoTitulo", { nome: negocio.name, nivel: proximoNivel }),
    texto: game.i18n.localize(resultado.sucesso ? "T20NEG.ChatExpansaoSucesso" : "T20NEG.ChatExpansaoFalha"),
    linhas,
    roll: resultado.roll,
    desfecho: resultado.sucesso ? "sucesso" : "falha"
  });

  // Os efeitos se ajustam sozinhos: o hook updateActor observa `system.nivel`.
  return resultado.sucesso;
}

/* -------------------------------------------- */
/*  Rendimento                                  */
/* -------------------------------------------- */

/**
 * Apura o rendimento do período. Sem dedicação, o negócio rende o valor básico;
 * com um mês inteiro dedicado, o resultado do teste multiplica o nível.
 *
 * @param {Actor} negocio
 * @param {object} [opcoes]
 * @param {object} [opcoes.resultado] Teste de administração, quando dedicado.
 */
export async function apurarRendimento(negocio, { resultado = null } = {}) {
  const nivel = negocio.system.nivel;
  const emporio = negocio.system.temEmporio;
  const dedicado = !!resultado;
  const valor = dedicado
    ? Regras.rendimentoDedicado(resultado.total, nivel, { emporio })
    : Regras.rendimentoBase(nivel, { emporio });

  const linhas = [
    { rotulo: game.i18n.localize("T20NEG.NivelDoNegocio"), valor: String(nivel) },
    dedicado && { rotulo: game.i18n.localize("T20NEG.Resultado"), valor: String(resultado.total) },
    emporio && { rotulo: game.i18n.localize("T20NEG.AtivoEmporioNome"), valor: `×${Regras.TO_EM_TIBARES}` },
    { rotulo: game.i18n.localize("T20NEG.Rendimento"), valor: Chat.tibares(valor) }
  ];

  const registro = {
    tipo: "rendimento",
    texto: dedicado
      ? game.i18n.format("T20NEG.RegistroRendimentoDedicado", { resultado: resultado.total })
      : game.i18n.localize("T20NEG.RegistroRendimentoBase"),
    valor,
    timestamp: Date.now()
  };

  await negocio.update({
    "system.cofre": negocio.system.cofre + valor,
    "system.registro": [...negocio.system.registro, registro]
  });

  await Chat.publicar({
    negocio,
    titulo: game.i18n.format("T20NEG.ChatRendimentoTitulo", { nome: negocio.name }),
    texto: game.i18n.localize(dedicado ? "T20NEG.ChatRendimentoDedicado" : "T20NEG.ChatRendimentoBase"),
    linhas,
    roll: resultado?.roll ?? null
  });

  return valor;
}

/* -------------------------------------------- */
/*  Ativos com uso próprio                      */
/* -------------------------------------------- */

/** Gira a roleta do Cassino: em resultado par o negócio ganha, em ímpar perde. */
export async function girarCassino(negocio) {
  const nivel = negocio.system.nivel;
  const roll = await new Roll("1d20").evaluate();
  const { par, valor } = Regras.premioCassino(nivel, roll.total);

  // Uma perda que o cofre não cobre não some: vira dívida contra o próximo giro.
  let cofre = negocio.system.cofre;
  let divida = negocio.system.dividaCassino;
  let liquido = valor;

  if (par && divida) {
    const abatido = Math.min(divida, valor);
    divida -= abatido;
    liquido = valor - abatido;
  } else if (!par) {
    const perda = Math.abs(valor);
    const doCofre = Math.min(cofre, perda);
    divida += perda - doCofre;
    liquido = -doCofre;
  }

  cofre += liquido;

  await negocio.update({
    "system.cofre": cofre,
    "system.dividaCassino": divida,
    "system.registro": [
      ...negocio.system.registro,
      {
        tipo: "cassino",
        texto: game.i18n.format("T20NEG.RegistroCassino", { dado: roll.total }),
        valor: liquido,
        timestamp: Date.now()
      }
    ]
  });

  await marcarUso(negocio, "cassino");

  await Chat.publicar({
    negocio,
    titulo: game.i18n.format("T20NEG.ChatCassinoTitulo", { nome: negocio.name }),
    texto: game.i18n.localize(par ? "T20NEG.ChatCassinoPar" : "T20NEG.ChatCassinoImpar"),
    linhas: [
      { rotulo: game.i18n.localize("T20NEG.Dado"), valor: String(roll.total) },
      { rotulo: game.i18n.localize("T20NEG.Movimento"), valor: Chat.tibares(liquido) },
      divida && { rotulo: game.i18n.localize("T20NEG.DividaCassino"), valor: Chat.tibares(divida) }
    ],
    roll,
    desfecho: par ? "sucesso" : "falha"
  });

  return { par, liquido, divida };
}

/** Fecha a folha do Mercado Multinivelado com os NPCs recrutados até aqui. */
export async function apurarMercado(negocio) {
  const nivel = negocio.system.nivel;
  const npcs = negocio.system.npcsRecrutados;
  const valor = Regras.ganhoMercadoMultinivelado(nivel, npcs);

  await negocio.update({
    "system.cofre": negocio.system.cofre + valor,
    "system.registro": [
      ...negocio.system.registro,
      {
        tipo: "mercado",
        texto: game.i18n.format("T20NEG.RegistroMercado", { npcs }),
        valor,
        timestamp: Date.now()
      }
    ]
  });

  await Chat.publicar({
    negocio,
    titulo: game.i18n.format("T20NEG.ChatMercadoTitulo", { nome: negocio.name }),
    texto: game.i18n.format("T20NEG.ChatMercadoTexto", { npcs, nivel }),
    linhas: [
      { rotulo: game.i18n.localize("T20NEG.NpcsRecrutados"), valor: String(npcs) },
      { rotulo: game.i18n.localize("T20NEG.Multiplicador"), valor: `×${Math.min(npcs, nivel)}` },
      { rotulo: game.i18n.localize("T20NEG.Rendimento"), valor: Chat.tibares(valor) }
    ]
  });

  return valor;
}

/* -------------------------------------------- */
/*  Contadores de uso                           */
/* -------------------------------------------- */

/** Marca um uso gasto de um ativo limitado por aventura. */
export async function marcarUso(negocio, ativoId, delta = 1) {
  const ativos = negocio.system.toObject().ativos.map((a) =>
    a.id === ativoId ? { ...a, usados: Math.max(0, (Number(a.usados) || 0) + delta) } : a
  );
  return negocio.update({ "system.ativos": ativos });
}

/** Zera os usos por aventura de todos os ativos do negócio. */
export async function renovarAventura(negocio) {
  const ativos = negocio.system.toObject().ativos.map((a) => ({ ...a, usados: 0 }));
  await negocio.update({ "system.ativos": ativos });

  await Chat.publicar({
    negocio,
    titulo: game.i18n.format("T20NEG.ChatRenovacaoTitulo", { nome: negocio.name }),
    texto: game.i18n.localize("T20NEG.ChatRenovacaoTexto")
  });
}

/* -------------------------------------------- */
/*  Cofre                                       */
/* -------------------------------------------- */

/**
 * Guarda tibares do proprietário no cofre do negócio — o caminho inverso do
 * saque, para bancar uma expansão ou cobrir a dívida do Cassino.
 */
export async function guardar(negocio, quantia) {
  if (quantia <= 0) return 0;

  const proprietario = negocio.system.atorProprietario;
  const naoMao = T20.tibaresDe(proprietario);

  // Só limita pelo que o proprietário tem quando dá para ler a ficha dele;
  // sem proprietário definido, o valor é lançado direto no cofre.
  const disponivel = naoMao === null ? quantia : Math.min(quantia, naoMao);
  if (disponivel <= 0) return 0;

  const debitou = await T20.debitarTibares(proprietario, disponivel);

  await negocio.update({
    "system.cofre": negocio.system.cofre + disponivel,
    "system.registro": [
      ...negocio.system.registro,
      {
        tipo: "deposito",
        texto: debitou
          ? game.i18n.format("T20NEG.RegistroDeposito", { nome: proprietario.name })
          : game.i18n.localize("T20NEG.RegistroDepositoManual"),
        valor: disponivel,
        timestamp: Date.now()
      }
    ]
  });

  return disponivel;
}

/** Move tibares entre o cofre do negócio e a bolsa do proprietário. */
export async function sacar(negocio, quantia) {
  const disponivel = Math.min(quantia, negocio.system.cofre);
  if (disponivel <= 0) return 0;

  const proprietario = negocio.system.atorProprietario;
  const creditou = await T20.creditarTibares(proprietario, disponivel);

  await negocio.update({
    "system.cofre": negocio.system.cofre - disponivel,
    "system.registro": [
      ...negocio.system.registro,
      {
        tipo: "saque",
        texto: creditou
          ? game.i18n.format("T20NEG.RegistroSaque", { nome: proprietario.name })
          : game.i18n.localize("T20NEG.RegistroSaqueManual"),
        valor: -disponivel,
        timestamp: Date.now()
      }
    ]
  });

  return disponivel;
}

/**
 * Todos os níveis disponíveis, para montar seletores na interface.
 * É função, e não constante, porque o teto é configurável e pode mudar durante
 * a sessão — uma constante congelaria o valor do momento do carregamento.
 */
export function niveis() {
  return Array.from({ length: nivelMaximo() }, (_, i) => i + 1);
}
