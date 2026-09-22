/**
 * A ficha de um negócio.
 *
 * Quatro abas, cada uma respondendo a uma pergunta que aparece na mesa:
 *   Visão geral — quanto isso rende e quanto custa para crescer?
 *   Ativos      — o que o negócio tem, e o que ainda pode ter?
 *   Benefícios  — quem ganha o quê por frequentar o lugar?
 *   Registro    — o que já aconteceu com ele?
 *
 * As abas são controladas à mão, e não pela API de abas do Foundry: trocar de
 * aba vira uma troca de classe no DOM, sem re-renderizar a ficha inteira.
 *
 * Fonte das regras: Jornada Heroica - Fim dos Tempos Arco 2: Valkaria.
 */

import { CONFIGS, MODULO } from "../constants.mjs";
import { ATIVOS, CONDICOES, exigencia, iconeDe } from "../data/ativos.mjs";
import * as Regras from "../data/regras.mjs";
import * as Beneficios from "../services/beneficios.mjs";
import * as Chat from "../services/chat.mjs";
import * as Operacoes from "../services/operacoes.mjs";
import * as T20 from "../services/t20-adapter.mjs";
import { sincronizarComApoio } from "../services/socket.mjs";
import { pedirTeste } from "./dialogo-teste.mjs";
import { SeletorDeAtivos, pedirEscolha, podeAdministrar } from "./seletor-ativos.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const ABAS = ["geral", "ativos", "beneficios", "registro"];

/**
 * Movimentos que só trocam o dinheiro de lugar — entre o cofre do negócio e a
 * bolsa do proprietário. Aparecem na linha do tempo, mas ficam fora das somas:
 * um saque não é despesa do negócio, nem um depósito é receita.
 */
const TRANSFERENCIAS = new Set(["saque", "deposito"]);

/** Um ícone por tipo de evento, para a lista do registro se ler de relance. */
const ICONES_DE_EVENTO = {
  fundacao: "fa-store",
  expansao: "fa-arrow-trend-up",
  "expansao-falha": "fa-arrow-trend-down",
  rendimento: "fa-coins",
  cassino: "fa-dice",
  mercado: "fa-sitemap",
  saque: "fa-sack-dollar",
  deposito: "fa-vault",
  ajuste: "fa-wrench",
  nota: "fa-feather"
};

export class NegocioSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  constructor(...args) {
    super(...args);
    this.abaAtiva = "geral";
    /** Ids dos ativos com os detalhes abertos. */
    this.ativosAbertos = new Set();
    /** Ids dos beneficiários com os detalhes abertos. */
    this.pessoasAbertas = new Set();
  }

  static DEFAULT_OPTIONS = {
    classes: ["tormenta20", "sheet", "actor", "t20neg", "themed", "theme-light"],
    position: { width: 720, height: 700 },
    window: { icon: "fa-solid fa-shop", resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      trocarAba: NegocioSheet.#trocarAba,
      expandir: NegocioSheet.#expandir,
      renderBase: NegocioSheet.#renderBase,
      renderDedicado: NegocioSheet.#renderDedicado,
      sacar: NegocioSheet.#sacar,
      guardar: NegocioSheet.#guardar,
      adicionarAtivo: NegocioSheet.#adicionarAtivo,
      removerAtivo: NegocioSheet.#removerAtivo,
      editarEscolha: NegocioSheet.#editarEscolha,
      escolherEspionagem: NegocioSheet.#escolherEspionagem,
      alternarAtivo: NegocioSheet.#alternarAtivo,
      alternarPessoa: NegocioSheet.#alternarPessoa,
      alternarTodos: NegocioSheet.#alternarTodos,
      usarAtivo: NegocioSheet.#usarAtivo,
      devolverUso: NegocioSheet.#devolverUso,
      renovarAventura: NegocioSheet.#renovarAventura,
      girarCassino: NegocioSheet.#girarCassino,
      apurarMercado: NegocioSheet.#apurarMercado,
      ajustarNpcs: NegocioSheet.#ajustarNpcs,
      ajustarNivel: NegocioSheet.#ajustarNivel,
      adicionarBeneficiario: NegocioSheet.#adicionarBeneficiario,
      removerBeneficiario: NegocioSheet.#removerBeneficiario,
      sincronizar: NegocioSheet.#sincronizar,
      abrirAtor: NegocioSheet.#abrirAtor,
      adicionarNota: NegocioSheet.#adicionarNota,
      limparRegistro: NegocioSheet.#limparRegistro
    }
  };

  /**
   * Quem pode mexer no negócio: o Mestre e o jogador do personagem
   * proprietário. Os demais abrem a ficha e leem — inclusive os beneficiários,
   * que recebem os bônus mas não administram o estabelecimento.
   *
   * Sem proprietário definido, só o Mestre administra; é o caso de um negócio
   * do grupo ou de um NPC.
   */
  get podeAdministrar() {
    return podeAdministrar(this.actor);
  }

  /**
   * Ownership do documento não basta: o Foundry o concede a quem precisa só
   * enxergar a ficha. A edição segue `podeAdministrar`.
   */
  get isEditable() {
    return super.isEditable && this.podeAdministrar;
  }

  /** Barra a ação e avisa quando quem clicou não administra o negócio. */
  #exigeAdministrar() {
    if (this.podeAdministrar) return true;
    ui.notifications.warn(game.i18n.localize("T20NEG.AvisoSoProprietario"));
    return false;
  }

  static PARTS = {
    cabecalho: { template: `modules/${MODULO}/templates/negocio/cabecalho.hbs` },
    abas: { template: `modules/${MODULO}/templates/negocio/abas.hbs` },
    geral: { template: `modules/${MODULO}/templates/negocio/tab-geral.hbs`, scrollable: [""] },
    ativos: { template: `modules/${MODULO}/templates/negocio/tab-ativos.hbs`, scrollable: [""] },
    beneficios: { template: `modules/${MODULO}/templates/negocio/tab-beneficios.hbs`, scrollable: [""] },
    registro: { template: `modules/${MODULO}/templates/negocio/tab-registro.hbs`, scrollable: [""] }
  };

  /* -------------------------------------------- */
  /*  Contexto                                    */
  /* -------------------------------------------- */

  async _prepareContext(opcoes) {
    const contexto = await super._prepareContext(opcoes);
    const sistema = this.actor.system;

    return Object.assign(contexto, {
      negocio: this.actor,
      sistema,
      editavel: this.isEditable,
      ehMestre: game.user.isGM,
      abaAtiva: this.abaAtiva,
      abas: ABAS.map((id) => ({
        id,
        label: game.i18n.localize(`T20NEG.Aba${id.charAt(0).toUpperCase()}${id.slice(1)}`),
        ativa: this.abaAtiva === id
      })),
      fonte: game.i18n.localize("T20NEG.Fonte")
    });
  }

  async _preparePartContext(parte, contexto, opcoes) {
    contexto = await super._preparePartContext(parte, contexto, opcoes);

    // Cada aba sabe se é a visível; o CSS faz o resto.
    if (ABAS.includes(parte)) contexto.ativa = this.abaAtiva === parte;

    switch (parte) {
      case "cabecalho":
        return Object.assign(contexto, this.#contextoCabecalho());
      case "geral":
        return Object.assign(contexto, this.#contextoGeral());
      case "ativos":
        return Object.assign(contexto, this.#contextoAtivos());
      case "beneficios":
        return Object.assign(contexto, this.#contextoBeneficios());
      case "registro":
        return Object.assign(contexto, this.#contextoRegistro());
      default:
        return contexto;
    }
  }

  #contextoCabecalho() {
    const sistema = this.actor.system;
    return {
      proprietario: sistema.atorProprietario,
      porte: game.i18n.localize(sistema.porte),
      usados: sistema.ativos.length,
      slots: sistema.slots,
      rendimento: Chat.tibares(sistema.rendimentoBase),
      temEmporio: sistema.temEmporio,
      proprietariosPossiveis: game.actors
        .filter((a) => a.type === "character")
        .map((a) => ({ id: a.id, nome: a.name, selecionado: a.id === sistema.proprietario }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    };
  }

  #contextoGeral() {
    const sistema = this.actor.system;
    const ids = sistema.idsDeAtivos;
    const emporio = sistema.temEmporio;
    const nivel = sistema.nivel;

    const bonus = T20.melhorBonusDeAdministracao(sistema.atorProprietario) ?? 0;
    const faixa = Regras.faixaDedicada(bonus, nivel, { emporio });

    const temCassino = ids.includes("cassino");
    const temMercado = ids.includes("mercado-multinivelado");
    const aposta = Regras.premioCassino(nivel, 2).valor;

    return {
      // Crescimento
      porte: game.i18n.localize(sistema.porte),
      niveis: Array.from({ length: sistema.nivelMaximo }, (_, i) => ({
        numero: i + 1,
        preenchido: i < nivel
      })),
      podeExpandir: sistema.podeExpandir,
      mostrarExpandir: sistema.podeExpandir && this.isEditable,
      proximoNivel: sistema.proximoNivel,
      cdExpansao: sistema.cdExpansao,
      custoExpansao: sistema.custoExpansao === null ? null : Chat.tibares(sistema.custoExpansao),
      mesesDeTrabalho: Regras.MESES_DE_TRABALHO,
      temEstudio: sistema.temEstudio,
      temEscritorio: sistema.temEscritorio,
      temDesconto: sistema.temEstudio || sistema.temEscritorio,

      // Rendimento
      rendimentoBase: Chat.tibares(sistema.rendimentoBase),
      // A faixa usa o melhor bônus de administração do proprietário — a perícia
      // que ele de fato usaria. Sem proprietário, fica o intervalo do dado nu.
      rendimentoDedicadoMin: Chat.tibares(faixa.minimo),
      rendimentoDedicadoMax: Chat.tibares(faixa.maximo),
      bonusDaFaixa: bonus,
      cofre: Chat.tibares(sistema.cofre),
      temEmporio: emporio,

      // Ativos com uso próprio
      temUsoProprio: temCassino || temMercado,
      temCassino,
      cassinoDisponivel: this.#usosRestantes("cassino") > 0,
      podeGirarCassino: this.isEditable && this.#usosRestantes("cassino") > 0,
      cassinoGanho: Chat.tibares(aposta),
      cassinoPerda: Chat.tibares(Math.floor(aposta / 2)),
      dividaCassino: sistema.dividaCassino ? Chat.tibares(sistema.dividaCassino) : null,
      temMercado,
      npcsRecrutados: sistema.npcsRecrutados,
      ganhoMercado: Chat.tibares(sistema.ganhoMercado),
      multiplicadorMercado: Math.min(sistema.npcsRecrutados, nivel)
    };
  }

  #contextoAtivos() {
    const sistema = this.actor.system;

    const contratados = sistema.ativos.map((a, indice) => {
      const def = ATIVOS[a.id];
      if (!def) return null;
      const copiado = a.id === "espionagem-industrial" && a.escolha ? ATIVOS[a.escolha] : null;

      return {
        id: a.id,
        // Cada nível abre uma vaga, então a ordem na lista diz em que nível o
        // ativo entrou. Vale como referência de leitura, não como registro.
        vaga: indice + 1,
        aberto: this.ativosAbertos.has(a.id),
        nome: game.i18n.localize(def.nome),
        icone: iconeDe(def),
        resumo: game.i18n.localize(def.resumo),
        efeito: game.i18n.localize(def.efeito),
        nota: def.nota ? game.i18n.localize(def.nota) : null,
        condicao: def.condicao ? exigencia(def.condicao) : null,
        automatico: !!def.changes || !!def.aoUsar,
        naRolagem: !!def.aoUsar,
        escolha: a.escolha,
        rotuloEscolha: def.escolha ? game.i18n.localize(def.escolha.label) : null,
        temEscolha: !!def.escolha,
        ehEspionagem: a.id === "espionagem-industrial",
        nomeCopiado: copiado ? game.i18n.localize(copiado.nome) : null,
        usos: def.usos
          ? {
              max: def.usos.max,
              gastos: Number(a.usados) || 0,
              restantes: this.#usosRestantes(a.id)
            }
          : null,
        // Demitir um ativo que outro exige deixaria o negócio inconsistente.
        travadoPor: this.#dependentes(a.id)
      };
    }).filter(Boolean);

    const excedentes = Math.max(0, sistema.ativos.length - sistema.slots);

    return {
      contratados,
      // As vagas livres continuam a numeração de onde os contratados pararam.
      vazios: Array.from({ length: sistema.slotsLivres }, (_, i) => sistema.ativos.length + i + 1),
      slots: sistema.slots,
      usados: sistema.ativos.length,
      semSlots: sistema.slotsLivres === 0,
      podeContratar: this.isEditable && sistema.slotsLivres > 0,
      temAtivos: sistema.ativos.length > 0,
      algumAberto: this.ativosAbertos.size > 0,
      // Baixar o nível não demite ninguém sozinho: quem escolhe o que sai é
      // quem administra o negócio.
      excedentes
    };
  }

  #dependentes(id) {
    const dependentes = Object.values(ATIVOS).filter(
      (outro) => this.actor.system.ativos.some((a) => a.id === outro.id) &&
        (outro.requisitos?.ativos ?? []).includes(id)
    );
    return dependentes.map((d) => game.i18n.localize(d.nome)).join(", ");
  }

  #contextoBeneficios() {
    const sistema = this.actor.system;
    const aplicando = game.settings.get(MODULO, CONFIGS.aplicarEfeitos);

    const pessoas = sistema.beneficiarios.map((b) => {
      const actor = game.actors.get(b.actorId);
      if (!actor) return null;
      const { automaticos, lembretes, bloqueados } = Beneficios.beneficiosDe(this.actor, b);

      return {
        actorId: b.actorId,
        nome: actor.name,
        img: actor.img,
        aberto: this.pessoasAbertas.has(b.actorId),
        editavelPorMim: actor.isOwner,
        condicoes: Object.entries(CONDICOES).map(([chave, label]) => ({
          chave,
          label: game.i18n.localize(label),
          marcada: !!b[chave]
        })),
        automaticos,
        lembretes,
        bloqueados,
        // Só interessa quando algo está fora do lugar: há bônus a somar, a
        // aplicação está ligada, mas os efeitos não chegaram à ficha. Como há
        // um efeito por ativo, a contagem é que diz se está tudo lá.
        faltaSincronizar: aplicando && automaticos.length > 0 &&
          Beneficios.efeitosExistentes(actor, this.actor.id).length < automaticos.length
      };
    }).filter(Boolean);

    const jaSao = new Set(sistema.beneficiarios.map((b) => b.actorId));
    const candidatos = game.actors
      .filter((a) => a.type === "character" && !jaSao.has(a.id))
      .map((a) => ({ id: a.id, nome: a.name }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    return {
      pessoas,
      aplicando,
      semBeneficiarios: !pessoas.length,
      algumAberto: this.pessoasAbertas.size > 0,
      candidatos,
      podeDarAcesso: this.isEditable && candidatos.length > 0,
      avisoEstruturas: game.i18n.localize("T20NEG.AvisoEstruturas")
    };
  }

  #contextoRegistro() {
    const registro = this.actor.system.registro;

    const entradas = [...registro]
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((e) => ({
        ...e,
        icone: ICONES_DE_EVENTO[e.tipo] ?? "fa-circle-dot",
        dia: new Date(e.timestamp).toLocaleDateString("pt-BR"),
        hora: new Date(e.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        valorFormatado: Number.isFinite(e.valor) ? Chat.tibares(e.valor) : null,
        positivo: (e.valor ?? 0) > 0,
        negativo: (e.valor ?? 0) < 0,
        transferencia: TRANSFERENCIAS.has(e.tipo)
      }));

    // Um negócio atravessa meses de campanha: agrupar por dia separa o que
    // aconteceu em cada sessão.
    const dias = [];
    for (const entrada of entradas) {
      let dia = dias.at(-1);
      if (dia?.data !== entrada.dia) {
        dia = { data: entrada.dia, entradas: [], total: 0 };
        dias.push(dia);
      }
      dia.entradas.push(entrada);
      if (!TRANSFERENCIAS.has(entrada.tipo)) dia.total += entrada.valor ?? 0;
    }
    for (const dia of dias) dia.saldo = dia.total ? Chat.tibares(dia.total) : null;

    const operacional = registro.filter((e) => !TRANSFERENCIAS.has(e.tipo));
    const recebido = operacional.reduce((s, e) => s + Math.max(0, e.valor ?? 0), 0);
    const investido = operacional.reduce((s, e) => s + Math.min(0, e.valor ?? 0), 0);

    return {
      dias,
      total: registro.length,
      semRegistro: !registro.length,
      recebido: Chat.tibares(recebido),
      investido: Chat.tibares(investido),
      saldo: Chat.tibares(recebido + investido),
      saldoPositivo: recebido + investido >= 0
    };
  }

  #usosRestantes(ativoId) {
    const def = ATIVOS[ativoId];
    if (!def?.usos) return 0;

    const entrada = this.actor.system.ativos.find((a) => a.id === ativoId);
    if (entrada) return Math.max(0, def.usos.max - (Number(entrada.usados) || 0));

    // Emprestado pela Espionagem Industrial: sem onde contar, fica disponível
    // e quem controla o gasto é a mesa.
    return this.actor.system.idsDeAtivos.includes(ativoId) ? def.usos.max : 0;
  }

  /* -------------------------------------------- */
  /*  Ações                                       */
  /* -------------------------------------------- */

  static #trocarAba(evento, alvo) {
    const aba = alvo.dataset.tab;
    if (!ABAS.includes(aba) || aba === this.abaAtiva) return;
    this.abaAtiva = aba;
    this.#aplicarAba();
  }

  /** Marca a aba ativa na navegação e no corpo da ficha. */
  #aplicarAba() {
    for (const painel of this.element.querySelectorAll(".tab[data-tab]")) {
      painel.classList.toggle("active", painel.dataset.tab === this.abaAtiva);
    }
    for (const botao of this.element.querySelectorAll(".sheet-tabs .item")) {
      botao.classList.toggle("active", botao.dataset.tab === this.abaAtiva);
    }
  }

  static async #expandir() {
    if (!this.#exigeAdministrar()) return;
    const sistema = this.actor.system;
    if (!sistema.podeExpandir) {
      ui.notifications.info(game.i18n.localize("T20NEG.AvisoNivelMaximo"));
      return;
    }

    const resultado = await pedirTeste({
      titulo: game.i18n.format("T20NEG.ExpandirTitulo", { nome: this.actor.name }),
      descricao: game.i18n.format("T20NEG.ExpandirDescricao", { nivel: sistema.proximoNivel }),
      caixas: [
        {
          rotulo: game.i18n.localize("T20NEG.ReqTempo"),
          valor: game.i18n.format("T20NEG.UmMes", { meses: Regras.MESES_DE_TRABALHO }),
          nota: game.i18n.localize("T20NEG.MesDeTrabalho")
        },
        {
          rotulo: game.i18n.localize("T20NEG.ReqInvestimento"),
          valor: Chat.tibares(sistema.custoExpansao),
          nota: game.i18n.localize("T20NEG.MesmoSeFalhar")
        },
        {
          rotulo: game.i18n.localize("T20NEG.CD"),
          valor: String(sistema.cdExpansao),
          nota: game.i18n.localize("T20NEG.OficioOuNobreza")
        }
      ],
      cd: sistema.cdExpansao,
      proprietario: sistema.atorProprietario,
      rotuloBotao: game.i18n.localize("T20NEG.BotaoExpandir"),
      icone: "fa-solid fa-arrow-up"
    });

    if (!resultado) return;
    await Operacoes.expandir(this.actor, resultado);
  }

  static async #renderBase() {
    if (!this.#exigeAdministrar()) return;
    await Operacoes.apurarRendimento(this.actor);
  }

  static async #renderDedicado() {
    if (!this.#exigeAdministrar()) return;
    const sistema = this.actor.system;

    /** O que o mês pode render, do pior ao melhor resultado de `1d20 + bônus`. */
    const faixaEmTexto = (bonus) => {
      const { minimo, maximo } = Regras.faixaDedicada(bonus, sistema.nivel, {
        emporio: sistema.temEmporio
      });
      return `${Chat.tibares(minimo)} – ${Chat.tibares(maximo)}`;
    };
    const emporio = sistema.temEmporio;
    const resultado = await pedirTeste({
      titulo: game.i18n.format("T20NEG.RendimentoTitulo", { nome: this.actor.name }),
      descricao: game.i18n.localize("T20NEG.RendimentoDescricao"),
      // O mês já está dito na descrição; a caixa só repetiria.
      caixas: [
        {
          rotulo: game.i18n.localize("T20NEG.SeuRendimento"),
          valor: game.i18n.format("T20NEG.MultiplicadorRendimento", {
            fator: Regras.fatorDedicado({ emporio }),
            nivel: sistema.nivel
          }),
          nota: game.i18n.localize(emporio ? "T20NEG.ComEmporio" : "T20NEG.ResultadoDoTeste")
        },
        {
          id: "t20neg-faixa",
          rotulo: game.i18n.localize("T20NEG.FaixaEsperada"),
          valor: faixaEmTexto(0),
          nota: game.i18n.localize("T20NEG.ContraOBasico", { valor: Chat.tibares(sistema.rendimentoBase) })
        }
      ],
      // O bônus só se conhece depois que a perícia é escolhida, e muda com ela.
      aoTrocarPericia: (bonus) => ({ "#t20neg-faixa": faixaEmTexto(bonus) }),
      // O rendimento dedicado não tem CD: o resultado do teste é o multiplicador.
      cd: 0,
      proprietario: sistema.atorProprietario,
      rotuloBotao: game.i18n.localize("T20NEG.BotaoDedicarMes"),
      icone: "fa-solid fa-hammer"
    });

    if (!resultado) return;
    await Operacoes.apurarRendimento(this.actor, { resultado });
  }

  static async #sacar() {
    if (!this.#exigeAdministrar()) return;
    const maximo = this.actor.system.cofre;
    if (maximo <= 0) {
      ui.notifications.info(game.i18n.localize("T20NEG.AvisoCofreVazio"));
      return;
    }

    const sacado = await NegocioSheet.#moverTibares.call(this, {
      titulo: game.i18n.localize("T20NEG.SacarTitulo"),
      rotulo: game.i18n.localize("T20NEG.BotaoSacar"),
      maximo,
      dica: game.i18n.format("T20NEG.CofreDisponivel", { valor: Chat.tibares(maximo) }),
      acao: (quantia) => Operacoes.sacar(this.actor, quantia)
    });

    if (sacado) ui.notifications.info(game.i18n.format("T20NEG.AvisoSaque", { valor: Chat.tibares(sacado) }));
  }

  /** Diálogo comum a sacar e guardar: muda o rótulo, o teto e a dica. */
  static async #moverTibares({ acao, maximo, dica, titulo, rotulo }) {
    const { DialogV2 } = foundry.applications.api;

    const quantia = await DialogV2.wait({
      window: { title: titulo, icon: "fa-solid fa-coins" },
      classes: ["tormenta20", "t20neg", "t20neg-dialogo", "themed", "theme-light"],
      content: `<div class="t20neg-form"><div class="form-group">
        <label>${game.i18n.localize("T20NEG.QuantiaEmTibares")}</label>
        <div class="form-fields"><input type="number" name="quantia" value="${maximo > 0 ? maximo : 0}"
          min="1" ${maximo > 0 ? `max="${maximo}"` : ""} autofocus /></div>
        <p class="hint">${dica}</p>
      </div></div>`,
      buttons: [
        {
          action: "ok",
          label: rotulo,
          default: true,
          callback: (_e, botao) => Number(botao.form.elements.quantia.value)
        },
        { action: "cancelar", label: game.i18n.localize("T20NEG.BotaoCancelar") }
      ],
      rejectClose: false
    });

    if (!quantia || quantia === "cancelar") return null;
    return acao(quantia);
  }

  static async #guardar() {
    if (!this.#exigeAdministrar()) return;
    const proprietario = this.actor.system.atorProprietario;
    const naoMao = T20.tibaresDe(proprietario);

    if (naoMao === 0) {
      ui.notifications.info(game.i18n.format("T20NEG.AvisoSemTibares", { nome: proprietario.name }));
      return;
    }

    const guardado = await NegocioSheet.#moverTibares.call(this, {
      titulo: game.i18n.localize("T20NEG.GuardarTitulo"),
      rotulo: game.i18n.localize("T20NEG.BotaoGuardar"),
      maximo: naoMao ?? 0,
      dica: naoMao === null
        ? game.i18n.localize("T20NEG.SemFichaParaDebitar")
        : game.i18n.format("T20NEG.EmMaos", { nome: proprietario.name, valor: Chat.tibares(naoMao) }),
      acao: (quantia) => Operacoes.guardar(this.actor, quantia)
    });

    if (guardado) ui.notifications.info(game.i18n.format("T20NEG.AvisoDeposito", { valor: Chat.tibares(guardado) }));
  }

  static #adicionarAtivo() {
    if (!this.#exigeAdministrar()) return;
    if (!this.actor.system.slotsLivres) {
      ui.notifications.warn(game.i18n.localize("T20NEG.AvisoSemSlots"));
      return;
    }
    new SeletorDeAtivos(this.actor).render({ force: true });
  }

  static async #removerAtivo(evento, alvo) {
    if (!this.#exigeAdministrar()) return;
    const id = alvo.dataset.ativoId;
    const def = ATIVOS[id];
    if (!def) return;

    const dependentes = this.#dependentes(id);
    const aviso = dependentes
      ? `<p class="t20neg-alerta">${game.i18n.format("T20NEG.AvisoDependentes", { ativos: dependentes })}</p>`
      : "";

    const confirmado = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.format("T20NEG.RemoverAtivoTitulo", { ativo: game.i18n.localize(def.nome) }) },
      classes: ["tormenta20", "t20neg", "t20neg-dialogo", "themed", "theme-light"],
      content: `<p>${game.i18n.localize("T20NEG.RemoverAtivoTexto")}</p>${aviso}`,
      rejectClose: false
    });
    if (!confirmado) return;

    this.ativosAbertos.delete(id);
    const ativos = this.actor.system.toObject().ativos.filter((a) => a.id !== id);
    await this.actor.update({ "system.ativos": ativos });
  }

  static async #editarEscolha(evento, alvo) {
    if (!this.#exigeAdministrar()) return;
    const id = alvo.dataset.ativoId;
    const def = ATIVOS[id];
    if (!def?.escolha) return;

    const escolha = await pedirEscolha(def);
    if (escolha === null) return;

    const ativos = this.actor.system.toObject().ativos.map((a) => (a.id === id ? { ...a, escolha } : a));
    await this.actor.update({ "system.ativos": ativos });
  }

  static #escolherEspionagem() {
    if (!this.#exigeAdministrar()) return;
    new SeletorDeAtivos(this.actor, { paraEspionagem: true }).render({ force: true });
  }

  static #alternarAtivo(evento, alvo) {
    const id = alvo.dataset.ativoId;
    const linha = this.element.querySelector(`.t20neg-acordeon[data-ativo-id="${id}"]`);
    if (!linha) return;

    if (linha.classList.toggle("aberto")) this.ativosAbertos.add(id);
    else this.ativosAbertos.delete(id);

    this.#sincronizarBotaoTodos();
  }

  static #alternarPessoa(evento, alvo) {
    const id = alvo.dataset.actorId;
    const linha = this.element.querySelector(`.t20neg-acordeon[data-actor-id="${id}"]`);
    if (!linha) return;

    if (linha.classList.toggle("aberto")) this.pessoasAbertas.add(id);
    else this.pessoasAbertas.delete(id);

    this.#sincronizarBotaoTodos();
  }

  /**
   * Abre ou fecha tudo na aba visível. Cada aba tem o seu conjunto de abertos,
   * então o botão age sobre o que está à vista.
   */
  static #alternarTodos() {
    const linhas = [...this.element.querySelectorAll(".tab.active .t20neg-acordeon")];
    const conjunto = this.abaAtiva === "beneficios" ? this.pessoasAbertas : this.ativosAbertos;
    const chave = this.abaAtiva === "beneficios" ? "actorId" : "ativoId";
    const abrir = conjunto.size === 0;

    conjunto.clear();
    for (const linha of linhas) {
      linha.classList.toggle("aberto", abrir);
      if (abrir) conjunto.add(linha.dataset[chave]);
    }

    this.#sincronizarBotaoTodos();
  }

  /** Mantém o ícone de expandir/recolher coerente com o estado das linhas. */
  #sincronizarBotaoTodos() {
    const botao = this.element.querySelector('.tab.active [data-action="alternarTodos"]');
    if (!botao) return;

    const algum = (this.abaAtiva === "beneficios" ? this.pessoasAbertas : this.ativosAbertos).size > 0;
    botao.querySelector("i")?.classList.toggle("fa-compress-alt", algum);
    botao.querySelector("i")?.classList.toggle("fa-expand-alt", !algum);
    botao.dataset.tooltip = game.i18n.localize(algum ? "T20NEG.RecolherTodos" : "T20NEG.ExpandirTodos");
  }

  static async #usarAtivo(evento, alvo) {
    if (!this.#exigeAdministrar()) return;
    const id = alvo.dataset.ativoId;
    if (this.#usosRestantes(id) <= 0) {
      ui.notifications.warn(game.i18n.localize("T20NEG.AvisoSemUsos"));
      return;
    }
    if (id === "cassino") return void (await Operacoes.girarCassino(this.actor));
    await Operacoes.marcarUso(this.actor, id, 1);
  }

  static async #devolverUso(evento, alvo) {
    if (!this.#exigeAdministrar()) return;
    await Operacoes.marcarUso(this.actor, alvo.dataset.ativoId, -1);
  }

  static async #renovarAventura() {
    if (!this.#exigeAdministrar()) return;
    await Operacoes.renovarAventura(this.actor);
  }

  static async #girarCassino() {
    if (!this.#exigeAdministrar()) return;
    if (this.#usosRestantes("cassino") <= 0) {
      ui.notifications.warn(game.i18n.localize("T20NEG.AvisoCassinoUsado"));
      return;
    }
    await Operacoes.girarCassino(this.actor);
  }

  static async #apurarMercado() {
    if (!this.#exigeAdministrar()) return;
    await Operacoes.apurarMercado(this.actor);
  }

  /**
   * O Mestre corrige o nível sem passar pelo teste — para consertar um engano,
   * conceder crescimento por acontecimento da história, ou importar um negócio
   * que já existia antes do módulo.
   */
  static async #ajustarNivel(evento, alvo) {
    if (!game.user.isGM) return;
    const delta = Number(alvo.dataset.delta ?? 1);
    const sistema = this.actor.system;
    const novo = Math.clamp(sistema.nivel + delta, 1, sistema.nivelMaximo);
    if (novo === sistema.nivel) return;

    await this.actor.update({
      "system.nivel": novo,
      "system.registro": [
        ...sistema.toObject().registro,
        {
          tipo: "ajuste",
          texto: game.i18n.format("T20NEG.RegistroAjusteNivel", { de: sistema.nivel, para: novo }),
          valor: null,
          timestamp: Date.now()
        }
      ]
    });
  }

  static async #ajustarNpcs(evento, alvo) {
    if (!this.#exigeAdministrar()) return;
    const delta = Number(alvo.dataset.delta ?? 1);
    const atual = this.actor.system.npcsRecrutados;
    await this.actor.update({ "system.npcsRecrutados": Math.max(0, atual + delta) });
  }

  static async #adicionarBeneficiario() {
    if (!this.#exigeAdministrar()) return;
    const seletor = this.element.querySelector("[data-campo=novoBeneficiario]");
    const actorId = seletor?.value;
    if (!actorId) return;

    const beneficiarios = this.actor.system.toObject().beneficiarios;
    if (beneficiarios.some((b) => b.actorId === actorId)) return;

    beneficiarios.push({ actorId, conjuradorArcano: false, conjuradorDivino: false, devoto: false });
    await this.actor.update({ "system.beneficiarios": beneficiarios });
  }

  static async #removerBeneficiario(evento, alvo) {
    if (!this.#exigeAdministrar()) return;
    const actorId = alvo.dataset.actorId;
    this.pessoasAbertas.delete(actorId);
    const beneficiarios = this.actor.system.toObject().beneficiarios.filter((b) => b.actorId !== actorId);
    await this.actor.update({ "system.beneficiarios": beneficiarios });
  }

  /**
   * Sincronizar não exige administrar o negócio: qualquer um pode trazer os
   * bônus para as fichas que possui. O que muda é o alcance — só quem
   * administra pede ao Mestre que atualize as fichas alheias.
   */
  static async #sincronizar() {
    const { delegado, pendentes, aplicados } = await sincronizarComApoio(this.actor, {
      delegar: this.podeAdministrar
    });

    if (delegado) ui.notifications.info(game.i18n.localize("T20NEG.AvisoSincronizadoComMestre"));
    else if (pendentes.length && this.podeAdministrar) {
      ui.notifications.warn(game.i18n.localize("T20NEG.AvisoSemMestre"));
    } else if (pendentes.length) {
      ui.notifications.info(game.i18n.format("T20NEG.AvisoSincronizadoSuas", { total: aplicados.length }));
    } else {
      ui.notifications.info(game.i18n.localize("T20NEG.AvisoSincronizado"));
    }

    this.render();
  }

  static #abrirAtor(evento, alvo) {
    game.actors.get(alvo.dataset.actorId)?.sheet?.render({ force: true });
  }

  /** Uma anotação do mestre ou do jogador na linha do tempo do negócio. */
  static async #adicionarNota() {
    if (!this.#exigeAdministrar()) return;
    const { DialogV2 } = foundry.applications.api;

    const texto = await DialogV2.wait({
      window: { title: game.i18n.localize("T20NEG.BotaoAdicionarNota"), icon: "fa-solid fa-feather" },
      classes: ["tormenta20", "t20neg", "t20neg-dialogo", "themed", "theme-light"],
      content: `<div class="t20neg-form"><div class="form-group">
        <label>${game.i18n.localize("T20NEG.CampoNota")}</label>
        <div class="form-fields"><input type="text" name="texto" autofocus
          placeholder="${game.i18n.localize("T20NEG.ExemploNota")}" /></div>
      </div></div>`,
      buttons: [
        {
          action: "ok",
          label: game.i18n.localize("T20NEG.BotaoAnotar"),
          default: true,
          callback: (_e, botao) => botao.form.elements.texto.value.trim()
        },
        { action: "cancelar", label: game.i18n.localize("T20NEG.BotaoCancelar") }
      ],
      rejectClose: false
    });

    if (!texto || texto === "cancelar") return;

    await this.actor.update({
      "system.registro": [
        ...this.actor.system.toObject().registro,
        { tipo: "nota", texto, valor: null, timestamp: Date.now() }
      ]
    });
  }

  static async #limparRegistro() {
    if (!this.#exigeAdministrar()) return;
    const confirmado = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("T20NEG.LimparRegistroTitulo") },
      classes: ["tormenta20", "t20neg", "t20neg-dialogo", "themed", "theme-light"],
      content: `<p>${game.i18n.localize("T20NEG.LimparRegistroTexto")}</p>`,
      rejectClose: false
    });
    if (!confirmado) return;
    await this.actor.update({ "system.registro": [] });
  }

  /* -------------------------------------------- */

  /**
   * Ajustes antes de gravar o formulário.
   *
   * O select de proprietário manda "" quando ninguém é dono, e um
   * DocumentIdField só aceita um id válido ou null. E quando o Mestre corrige o
   * nível à mão, a mudança entra no registro: um negócio atravessa meses de
   * campanha, e um nível que muda sem deixar rastro vira discussão na mesa.
   */
  _prepareSubmitData(evento, form, formData, updateData) {
    const dados = super._prepareSubmitData(evento, form, formData, updateData);
    if (dados.system?.proprietario === "") dados.system.proprietario = null;

    const novo = dados.system?.nivel;
    const atual = this.actor.system.nivel;
    if (Number.isInteger(novo) && novo !== atual) {
      dados.system.registro = [
        ...this.actor.system.toObject().registro,
        {
          tipo: "ajuste",
          texto: game.i18n.format("T20NEG.RegistroAjusteNivel", { de: atual, para: novo }),
          valor: null,
          timestamp: Date.now()
        }
      ];
    }

    return dados;
  }

  /** Checkboxes de condição não são campos do formulário; são gravados aqui. */
  _onRender(contexto, opcoes) {
    super._onRender(contexto, opcoes);
    this.#aplicarAba();

    for (const checkbox of this.element.querySelectorAll("[data-condicao]")) {
      checkbox.addEventListener("change", async (evento) => {
        if (!this.#exigeAdministrar()) {
          evento.currentTarget.checked = !evento.currentTarget.checked;
          return;
        }
        const { actorId, condicao } = evento.currentTarget.dataset;
        const beneficiarios = this.actor.system.toObject().beneficiarios.map((b) =>
          b.actorId === actorId ? { ...b, [condicao]: evento.currentTarget.checked } : b
        );
        await this.actor.update({ "system.beneficiarios": beneficiarios });
      });
    }
  }

}
