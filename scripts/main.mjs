/**
 * Negócios — Tormenta 20
 *
 * Ponto de entrada: registra o subtipo de Actor, a ficha, as configurações do
 * mundo e os pontos de acesso à interface.
 *
 * Fonte das regras: Jornada Heroica - Fim dos Tempos Arco 2: Valkaria.
 */

import { LivroDeNegocios } from "./apps/livro-negocios.mjs";
import { NegocioSheet } from "./apps/negocio-sheet.mjs";
import { SeletorDeAtivos } from "./apps/seletor-ativos.mjs";
import { CONFIGS, MODULO, NIVEL_MAXIMO_PADRAO, NIVEL_TETO, TIPO_NEGOCIO } from "./constants.mjs";
import { ATIVOS } from "./data/ativos.mjs";
import { NegocioModel } from "./data/negocio-model.mjs";
import * as Regras from "./data/regras.mjs";
import * as Beneficios from "./services/beneficios.mjs";
import * as Operacoes from "./services/operacoes.mjs";
import { registrarSocket, sincronizarComApoio } from "./services/socket.mjs";

Hooks.once("init", () => {
  CONFIG.Actor.dataModels[TIPO_NEGOCIO] = NegocioModel;

  registrarFicha();
  registrarConfiguracoes();
  carregarTemplates();

  console.log(`${MODULO} | regras de negócios carregadas`);
});

Hooks.once("ready", () => {
  registrarSocket();

  game.modules.get(MODULO).api = {
    abrirLivro: () => LivroDeNegocios.abrir(),
    ATIVOS,
    Regras,
    Operacoes,
    Beneficios,
    SeletorDeAtivos,
    /** Refaz os efeitos de todos os negócios — útil após mudar configurações. */
    sincronizarTudo: async () => {
      for (const negocio of game.actors.filter((a) => a.type === TIPO_NEGOCIO)) {
        await sincronizarComApoio(negocio);
      }
    }
  };
});

/* -------------------------------------------- */
/*  Registros                                   */
/* -------------------------------------------- */

function registrarFicha() {
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, MODULO, NegocioSheet, {
    types: [TIPO_NEGOCIO],
    makeDefault: true,
    label: "T20NEG.FichaNegocio"
  });
}

function registrarConfiguracoes() {
  game.settings.register(MODULO, CONFIGS.aplicarEfeitos, {
    name: "T20NEG.ConfigAplicarEfeitos",
    hint: "T20NEG.ConfigAplicarEfeitosHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false,
    onChange: () => game.modules.get(MODULO)?.api?.sincronizarTudo?.()
  });

  game.settings.register(MODULO, CONFIGS.avancoPorMarcos, {
    name: "T20NEG.ConfigAvancoPorMarcos",
    hint: "T20NEG.ConfigAvancoPorMarcosHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => game.modules.get(MODULO)?.api?.sincronizarTudo?.()
  });

  game.settings.register(MODULO, CONFIGS.nivelMaximo, {
    name: "T20NEG.ConfigNivelMaximo",
    hint: "T20NEG.ConfigNivelMaximoHint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 1, max: NIVEL_TETO, step: 1 },
    default: NIVEL_MAXIMO_PADRAO,
    onChange: () => {
      for (const app of foundry.applications.instances.values()) {
        if (app instanceof NegocioSheet) app.render();
      }
    }
  });

  // Guardada, não exibida: é só a memória de onde ficam os negócios.
  game.settings.register(MODULO, CONFIGS.pastaNegocios, {
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
}

/** Pré-carrega os parciais para que trocar de aba não pisque. */
function carregarTemplates() {
  foundry.applications.handlebars.loadTemplates([
    `modules/${MODULO}/templates/negocio/cabecalho.hbs`,
    `modules/${MODULO}/templates/negocio/abas.hbs`,
    `modules/${MODULO}/templates/negocio/tab-geral.hbs`,
    `modules/${MODULO}/templates/negocio/tab-ativos.hbs`,
    `modules/${MODULO}/templates/negocio/tab-beneficios.hbs`,
    `modules/${MODULO}/templates/negocio/tab-registro.hbs`,
    `modules/${MODULO}/templates/chat/card.hbs`
  ]);
}

/* -------------------------------------------- */
/*  Pontos de acesso                            */
/* -------------------------------------------- */

/** Botão na barra de ferramentas, junto das notas. */
Hooks.on("getSceneControlButtons", (controles) => {
  const grupo = controles.notes ?? controles.tokens;
  if (!grupo?.tools) return;

  grupo.tools["t20-negocios"] = {
    name: "t20-negocios",
    title: "T20NEG.LivroTitulo",
    icon: "fa-solid fa-shop",
    button: true,
    visible: true,
    order: Object.keys(grupo.tools).length,
    onChange: () => LivroDeNegocios.abrir()
  };
});

/**
 * Botão no cabeçalho do diretório de Atores.
 *
 * Copia a estrutura dos botões vizinhos — `<i inert>` e `<span>` dentro de um
 * `<button>` sem largura própria — para entrar na mesma linha flex de "Criar
 * Ator" e "Criar Pasta" em vez de disputar espaço com eles.
 */
Hooks.on("renderActorDirectory", (app, raiz) => {
  const acoes = raiz?.querySelector(".header-actions");
  if (!acoes || acoes.querySelector(".t20neg-atalho")) return;

  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "t20neg-atalho";
  botao.innerHTML = `<i class="fa-solid fa-shop" inert></i><span>${
    foundry.utils.escapeHTML(game.i18n.localize("T20NEG.LivroTitulo"))}</span>`;
  botao.addEventListener("click", () => LivroDeNegocios.abrir());

  acoes.append(botao);
});

/**
 * Um negócio excluído não pode deixar efeitos órfãos nas fichas. O Mestre é
 * quem limpa, porque só ele enxerga todos os atores do mundo.
 */
Hooks.on("deleteActor", async (actor) => {
  if (actor.type !== TIPO_NEGOCIO || !game.user.isGM) return;
  await Beneficios.limparEfeitos(actor.id, { somenteLocais: false });
});

/**
 * Alterações no negócio se propagam para os beneficiários.
 *
 * Só o cliente que fez a mudança sincroniza. O hook dispara em todos os
 * conectados, e deixar todos escreverem criaria efeitos duplicados na mesma
 * ficha — este é o único lugar do módulo que aplica efeitos automaticamente.
 */
Hooks.on("updateActor", async (actor, mudancas, opcoes, userId) => {
  if (actor.type !== TIPO_NEGOCIO || userId !== game.user.id) return;
  const relevante = ["ativos", "beneficiarios", "nivel"].some((campo) => campo in (mudancas.system ?? {}));
  if (!relevante) return;
  await sincronizarComApoio(actor);
});
