/**
 * O seletor de ativos: a vitrine de tudo que um negócio pode ter.
 *
 * Mostra o catálogo inteiro, inclusive o que o negócio ainda não alcança — ver
 * que a Academia exige nível 7 é parte do planejamento de quem está subindo do
 * nível 2 para o 3.
 */

import { MODULO } from "../constants.mjs";
import { ATIVOS, exigencia, iconeDe, listarAtivos } from "../data/ativos.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Quem pode mexer num negócio: o Mestre e o jogador do proprietário. */
export function podeAdministrar(negocio) {
  if (game.user.isGM) return true;
  return !!negocio?.system?.atorProprietario?.isOwner;
}

export class SeletorDeAtivos extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {Actor} negocio
   * @param {object} [opcoes]
   * @param {string} [opcoes.substituindo] Id do ativo sendo trocado.
   * @param {boolean} [opcoes.paraEspionagem] Escolha do ativo copiado.
   */
  constructor(negocio, { substituindo = null, paraEspionagem = false, ...resto } = {}) {
    super(resto);
    this.negocio = negocio;
    this.substituindo = substituindo;
    this.paraEspionagem = paraEspionagem;
    // "Só os disponíveis" responde à pergunta que se faz aqui — o que posso
    // contratar agora — melhor do que o antigo filtro por categoria.
    this.filtro = { texto: "", soDisponiveis: false };
    /** Ids com os detalhes abertos. */
    this.abertos = new Set();
  }

  static DEFAULT_OPTIONS = {
    id: "t20neg-seletor-{id}",
    classes: ["tormenta20", "sheet", "actor", "t20neg", "themed", "theme-light"],
    tag: "div",
    window: { title: "T20NEG.SeletorTitulo", icon: "fa-solid fa-store", resizable: true },
    position: { width: 720, height: 640 },
    actions: {
      contratar: SeletorDeAtivos.#contratar,
      alternarDetalhe: SeletorDeAtivos.#alternarDetalhe,
      alternarDisponiveis: SeletorDeAtivos.#alternarDisponiveis
    }
  };

  static PARTS = {
    corpo: { template: `modules/${MODULO}/templates/seletor-ativos.hbs`, scrollable: [".t20neg-lista"] }
  };

  /** @override */
  get title() {
    return this.paraEspionagem
      ? game.i18n.localize("T20NEG.SeletorTituloEspionagem")
      : game.i18n.format("T20NEG.SeletorTituloNegocio", { nome: this.negocio.name });
  }

  /** @override */
  async _prepareContext() {
    const sistema = this.negocio.system;
    const contratados = sistema.ativos.map((a) => a.id);
    const busca = this.filtro.texto.toLowerCase().trim();
    const todos = listarAtivos();

    const itens = todos
      .map((def) => {
        const nome = game.i18n.localize(def.nome);
        const { ok, faltando } = sistema.checarAtivo(def.id);
        const jaTem = contratados.includes(def.id) && def.id !== this.substituindo;

        return {
          id: def.id,
          nome,
          icone: iconeDe(def),
          resumo: game.i18n.localize(def.resumo),
          efeito: game.i18n.localize(def.efeito),
          automatico: !!def.changes || !!def.aoUsar,
          marcas: this.#marcasDe(def),
          requisitos: descreverRequisitos(faltando),
          jaTem,
          disponivel: ok && !jaTem,
          aberto: this.abertos.has(def.id)
        };
      })
      .filter((item) => {
        if (this.filtro.soDisponiveis && !item.disponivel) return false;
        if (!busca) return true;
        return `${item.nome} ${item.resumo} ${item.efeito}`.toLowerCase().includes(busca);
      });

    return {
      itens,
      total: todos.length,
      filtro: this.filtro,
      paraEspionagem: this.paraEspionagem,
      slotsLivres: sistema.slotsLivres,
      semResultado: !itens.length,
      fonte: game.i18n.localize("T20NEG.Fonte")
    };
  }

  /** As etiquetas que descrevem um ativo nos detalhes. */
  #marcasDe(def) {
    const marcas = [];

    if (def.aoUsar) {
      marcas.push({
        texto: game.i18n.localize("T20NEG.MarcaRolagem"),
        dica: game.i18n.localize("T20NEG.MarcaRolagemDica"),
        icone: "fa-dice-d20",
        estilo: "ativo"
      });
    } else if (def.changes) {
      marcas.push({
        texto: game.i18n.localize("T20NEG.MarcaAuto"),
        dica: game.i18n.localize("T20NEG.MarcaAutoDica"),
        icone: "fa-wand-magic-sparkles",
        estilo: "ativo"
      });
    }
    if (def.usos) {
      marcas.push({
        texto: game.i18n.format("T20NEG.UsosPorAventura", { max: def.usos.max }),
        icone: "fa-hourglass-half"
      });
    }
    if (def.condicao) {
      marcas.push({ texto: exigencia(def.condicao), icone: "fa-user-check" });
    }
    if (def.escolha) {
      marcas.push({ texto: game.i18n.localize(def.escolha.label), icone: "fa-pen" });
    }

    return marcas;
  }

  /** @override */
  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);

    const busca = this.element.querySelector("[name=busca]");
    busca?.addEventListener("input", foundry.utils.debounce((evento) => {
      this.filtro.texto = evento.target.value;
      this.render({ parts: ["corpo"] });
    }, 200));

    // Devolve o cursor ao campo de busca depois de cada redesenho.
    if (this.filtro.texto && busca) {
      busca.focus();
      busca.setSelectionRange(busca.value.length, busca.value.length);
    }
  }

  /* -------------------------------------------- */

  static async #contratar(evento, alvo) {
    // A janela se abre pela ficha, que já confere; a guarda aqui vale para
    // quem chegar por outro caminho.
    if (!podeAdministrar(this.negocio)) {
      ui.notifications.warn(game.i18n.localize("T20NEG.AvisoSoProprietario"));
      return;
    }

    const id = alvo.dataset.ativoId;
    const def = ATIVOS[id];
    if (!def) return;

    if (this.paraEspionagem) {
      await this.#gravarEspionagem(id);
      this.close();
      return;
    }

    // A Espionagem Industrial é a única cuja escolha é outro ativo. Ela é
    // contratada primeiro e só então abre o seletor do alvo, porque a escolha
    // é gravada dentro da própria entrada dela.
    const adiaEscolha = def.escolha?.tipo === "ativo";
    const escolha = def.escolha && !adiaEscolha ? await pedirEscolha(def) : "";
    if (escolha === null) return;

    const ativos = this.negocio.system.toObject().ativos;
    if (this.substituindo) {
      const alvoIndex = ativos.findIndex((a) => a.id === this.substituindo);
      if (alvoIndex >= 0) ativos.splice(alvoIndex, 1, { id, escolha, nota: "", usados: 0 });
    } else {
      ativos.push({ id, escolha, nota: "", usados: 0 });
    }

    await this.negocio.update({ "system.ativos": ativos });
    this.close();

    if (adiaEscolha) new SeletorDeAtivos(this.negocio, { paraEspionagem: true }).render({ force: true });
  }

  /** O ativo escolhido pela Espionagem Industrial vira a `escolha` dela. */
  async #gravarEspionagem(id) {
    const ativos = this.negocio.system.toObject().ativos.map((a) =>
      a.id === "espionagem-industrial" ? { ...a, escolha: id } : a
    );
    await this.negocio.update({ "system.ativos": ativos });
  }

  static #alternarDetalhe(evento, alvo) {
    const id = alvo.dataset.ativoId;
    const linha = this.element.querySelector(`.t20neg-acordeon[data-ativo-id="${id}"]`);
    if (!linha) return;

    if (linha.classList.toggle("aberto")) this.abertos.add(id);
    else this.abertos.delete(id);
  }

  static #alternarDisponiveis() {
    this.filtro.soDisponiveis = !this.filtro.soDisponiveis;
    this.render({ parts: ["corpo"] });
  }
}

/**
 * O que falta para um ativo ficar disponível, numa frase só.
 *
 * "Exige nível 5 e Fachada" se lê melhor do que "exige nível 5 · exige
 * Fachada", e cabe melhor na etiqueta.
 */
export function descreverRequisitos(faltando) {
  const partes = [];
  if (faltando.nivel) partes.push(game.i18n.format("T20NEG.RequisitoNivel", { nivel: faltando.nivel }));
  for (const dep of faltando.ativos) partes.push(game.i18n.localize(dep.nome));
  if (!partes.length) return "";

  const lista = partes.length === 1
    ? partes[0]
    : `${partes.slice(0, -1).join(", ")} ${game.i18n.localize("T20NEG.E")} ${partes.at(-1)}`;

  return game.i18n.format("T20NEG.Exige", { requisitos: lista });
}

/**
 * Pergunta a decisão que acompanha certos ativos: qual arma, qual perícia,
 * qual divindade. Devolve `null` se o jogador desistir.
 *
 * Escolhas do tipo `ativo` não passam por aqui — elas abrem o próprio seletor.
 */
export async function pedirEscolha(def) {
  const { DialogV2 } = foundry.applications.api;
  const rotulo = game.i18n.localize(def.escolha.label);

  const campo = def.escolha.tipo === "opcoes"
    ? `<select name="escolha">${Object.entries(def.escolha.opcoes)
        .map(([v, l]) => `<option value="${v}">${game.i18n.localize(l)}</option>`)
        .join("")}</select>`
    : `<input type="text" name="escolha" value="" autofocus />`;

  const resposta = await DialogV2.wait({
    window: { title: game.i18n.localize(def.nome), icon: "fa-solid fa-pen" },
    classes: ["tormenta20", "t20neg", "t20neg-dialogo", "themed", "theme-light"],
    content: `<div class="t20neg-form"><p>${game.i18n.localize(def.efeito)}</p>
      <div class="form-group"><label>${rotulo}</label><div class="form-fields">${campo}</div></div></div>`,
    buttons: [
      {
        action: "ok",
        label: game.i18n.localize("T20NEG.BotaoConfirmar"),
        default: true,
        callback: (_e, botao) => botao.form.elements.escolha.value
      },
      { action: "cancelar", label: game.i18n.localize("T20NEG.BotaoCancelar") }
    ],
    rejectClose: false
  });

  if (!resposta || resposta === "cancelar") return null;
  return resposta;
}
