/**
 * O Livro de Negócios: a porta de entrada do módulo.
 *
 * O diretório de Atores também lista os negócios, mas misturados com
 * personagens e criaturas. Esta janela mostra só o que interessa — nível,
 * proprietário, ativos e rendimento — e é de onde se funda um negócio novo.
 */

import { ICONE_PADRAO, MODULO, TIPO_NEGOCIO } from "../constants.mjs";
import { ATIVOS } from "../data/ativos.mjs";
import * as Regras from "../data/regras.mjs";
import * as Chat from "../services/chat.mjs";
import * as Operacoes from "../services/operacoes.mjs";
import { limparComApoio } from "../services/socket.mjs";
import { ligarCampos, periciasDe } from "./dialogo-teste.mjs";
import * as T20 from "../services/t20-adapter.mjs";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class LivroDeNegocios extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(opcoes = {}) {
    super(opcoes);
    /** Ids dos negócios com os detalhes abertos. */
    this.abertos = new Set();
  }

  static DEFAULT_OPTIONS = {
    id: "t20neg-livro",
    classes: ["tormenta20", "sheet", "actor", "t20neg", "themed", "theme-light"],
    tag: "div",
    window: { title: "T20NEG.LivroTitulo", icon: "fa-solid fa-book-open", resizable: true },
    position: { width: 620, height: 560 },
    actions: {
      fundar: LivroDeNegocios.#fundar,
      abrir: LivroDeNegocios.#abrir,
      excluir: LivroDeNegocios.#excluir,
      alternarDetalhe: LivroDeNegocios.#alternarDetalhe,
      alternarTodos: LivroDeNegocios.#alternarTodos
    }
  };

  static PARTS = {
    corpo: { template: `modules/${MODULO}/templates/livro-negocios.hbs`, scrollable: [".t20neg-lista"] }
  };

  /** Uma instância só, reaproveitada — abrir duas vezes traz a mesma janela. */
  static #instancia = null;

  static abrir() {
    LivroDeNegocios.#instancia ??= new LivroDeNegocios();
    return LivroDeNegocios.#instancia.render({ force: true });
  }

  async _prepareContext() {
    const negocios = game.actors
      .filter((a) => a.type === TIPO_NEGOCIO && a.visible)
      .sort((a, b) => b.system.nivel - a.system.nivel || a.name.localeCompare(b.name, "pt-BR"))
      .map((negocio) => {
        const sistema = negocio.system;
        return {
          id: negocio.id,
          nome: negocio.name,
          img: negocio.img,
          nivel: sistema.nivel,
          porte: game.i18n.localize(sistema.porte),
          ramo: sistema.ramo,
          local: sistema.local,
          proprietario: sistema.atorProprietario?.name ?? game.i18n.localize("T20NEG.SemProprietario"),
          rendimento: game.i18n.format("T20NEG.PorAventura", {
            valor: Chat.tibares(sistema.rendimentoBase)
          }),
          cofre: Chat.tibares(sistema.cofre),
          ativos: sistema.ativos
            .map((a) => (ATIVOS[a.id] ? game.i18n.localize(ATIVOS[a.id].nome) : null))
            .filter(Boolean),
          slots: sistema.slots,
          beneficiarios: sistema.beneficiarios.length,
          aberto: this.abertos.has(negocio.id)
        };
      });

    return {
      negocios,
      vazio: !negocios.length,
      algumAberto: this.abertos.size > 0,
      podeFundar: game.user.isGM || game.actors.some((a) => a.type === "character" && a.isOwner),
      custo: Chat.tibares(Regras.CUSTO_CRIACAO),
      cd: Regras.CD_CRIACAO,
      ehMestre: game.user.isGM,
      fonte: game.i18n.localize("T20NEG.Fonte")
    };
  }

  static #alternarDetalhe(evento, alvo) {
    const id = alvo.dataset.negocioId;
    const linha = this.element.querySelector(`.t20neg-acordeon[data-negocio-id="${id}"]`);
    if (!linha) return;

    if (linha.classList.toggle("aberto")) this.abertos.add(id);
    else this.abertos.delete(id);
  }

  static #alternarTodos() {
    const linhas = [...this.element.querySelectorAll(".t20neg-acordeon")];
    const abrir = this.abertos.size === 0;

    this.abertos.clear();
    for (const linha of linhas) {
      linha.classList.toggle("aberto", abrir);
      if (abrir) this.abertos.add(linha.dataset.negocioId);
    }
    this.render({ parts: ["corpo"] });
  }

  /* -------------------------------------------- */

  /**
   * Funda um negócio.
   *
   * Um diálogo só: os dados do estabelecimento e o teste que decide se ele
   * existe. Eram dois em sequência, e o segundo aparecia sem contexto do que já
   * tinha sido preenchido. O teste vem antes da criação porque falhar não
   * produz negócio nenhum — só consome o mês e o investimento.
   */
  static async #fundar() {
    const meus = game.actors
      .filter((a) => a.type === "character" && a.isOwner)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    const inicial = meus[0] ?? null;
    const content = await foundry.applications.handlebars.renderTemplate(
      `modules/${MODULO}/templates/fundar-negocio.hbs`,
      {
        cd: Regras.CD_CRIACAO,
        custo: Chat.tibares(Regras.CUSTO_CRIACAO),
        meses: Regras.MESES_DE_TRABALHO,
        temSistema: T20.temSistemaT20(),
        semProprietario: !meus.length,
        atores: meus.map((a) => ({ id: a.id, nome: a.name, selecionado: a.id === inicial?.id })),
        pericias: periciasDe(inicial)
      }
    );

    const dados = await DialogV2.wait({
      window: { title: game.i18n.localize("T20NEG.FundarTitulo"), icon: "fa-solid fa-store" },
      classes: ["tormenta20", "t20neg", "t20neg-dialogo", "themed", "theme-light"],
      position: { width: 520 },
      content,
      buttons: [
        {
          action: "fundar",
          label: game.i18n.localize("T20NEG.BotaoFundar"),
          icon: "fa-solid fa-hammer",
          default: true,
          callback: (_evento, botao) => {
            const f = botao.form.elements;
            return {
              nome: f.nome.value.trim(),
              ramo: f.ramo.value.trim(),
              local: f.local.value.trim(),
              actorId: f.actorId?.value || null,
              pericia: f.pericia?.value || null,
              bonus: Number(f.bonus?.value ?? 0)
            };
          }
        },
        { action: "cancelar", label: game.i18n.localize("T20NEG.BotaoCancelar"), icon: "fa-solid fa-xmark" }
      ],
      render: (_evento, dialogo) => ligarCampos(dialogo.element),
      rejectClose: false
    });

    if (!dados || dados === "cancelar") return;
    if (!dados.nome) {
      ui.notifications.warn(game.i18n.localize("T20NEG.AvisoNomeObrigatorio"));
      return;
    }

    const proprietario = dados.actorId ? game.actors.get(dados.actorId) : null;
    const titulo = game.i18n.format("T20NEG.FundarTesteTitulo", { nome: dados.nome });

    // O teste vai pela ficha, no diálogo de rolagem do próprio sistema. Se o
    // jogador fechar aquele diálogo, ele desistiu da fundação — nada é criado.
    const pelaFicha = await T20.rolarPelaFicha(proprietario, dados.pericia, {
      cd: Regras.CD_CRIACAO,
      titulo
    });
    if (pelaFicha.cancelado) return;

    const resultado = pelaFicha.resultado ?? await T20.rolarTeste({
      actor: proprietario,
      pericia: dados.pericia,
      bonus: dados.bonus,
      cd: Regras.CD_CRIACAO,
      titulo
    });

    const { sucesso, negocio } = await Operacoes.fundar({
      nome: dados.nome,
      ramo: dados.ramo,
      local: dados.local,
      proprietarioId: dados.actorId,
      resultado
    });

    if (!sucesso) ui.notifications.warn(game.i18n.localize("T20NEG.AvisoFundacaoFalhou"));
    else if (negocio) negocio.sheet.render({ force: true });
    // Quando a criação foi delegada, o negócio aparece na lista assim que o
    // Mestre o criar — o aviso já foi dado pela camada de socket.
  }

  static #abrir(evento, alvo) {
    game.actors.get(alvo.dataset.negocioId)?.sheet?.render({ force: true });
  }

  static async #excluir(evento, alvo) {
    const negocio = game.actors.get(alvo.dataset.negocioId);
    if (!negocio) return;

    const confirmado = await DialogV2.confirm({
      window: { title: game.i18n.format("T20NEG.ExcluirTitulo", { nome: negocio.name }) },
      classes: ["tormenta20", "t20neg", "t20neg-dialogo", "themed", "theme-light"],
      content: `<p>${game.i18n.localize("T20NEG.ExcluirTexto")}</p>`,
      rejectClose: false
    });
    if (!confirmado) return;

    // Os efeitos saem das fichas antes do negócio sair do mundo; depois da
    // exclusão não haveria mais como saber de onde eles vieram.
    this.abertos.delete(negocio.id);
    await limparComApoio(negocio.id);
    await negocio.delete();
  }
}

/** Ícone padrão exposto para quem criar negócios por macro. */
export { ICONE_PADRAO };
