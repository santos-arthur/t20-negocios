/**
 * O modelo de dados do subtipo de Actor `t20-negocios.negocio`.
 *
 * Um negócio é um Actor por um motivo prático: assim ele herda de graça tudo
 * que o Foundry já sabe fazer com permissões, pastas, compêndios, importação e
 * exportação. O jogador dono recebe ownership do documento e edita o próprio
 * negócio sem precisar de socket nenhum.
 *
 * Fonte das regras: Jornada Heroica - Fim dos Tempos Arco 2: Valkaria.
 */

import { NIVEL_MIN, NIVEL_TETO, nivelMaximo } from "../constants.mjs";
import { ATIVOS, checarRequisitos } from "./ativos.mjs";
import * as Regras from "./regras.mjs";

const { fields } = foundry.data;

export class NegocioModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      nivel: new fields.NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: NIVEL_MIN,
        min: NIVEL_MIN,
        max: NIVEL_TETO,
        label: "T20NEG.CampoNivel"
      }),

      ramo: new fields.StringField({
        required: true,
        blank: true,
        initial: "",
        label: "T20NEG.CampoRamo"
      }),

      local: new fields.StringField({
        required: true,
        blank: true,
        initial: "",
        label: "T20NEG.CampoLocal"
      }),

      /** Ator do personagem proprietário. */
      proprietario: new fields.DocumentIdField({ nullable: true, initial: null }),

      /** Cofre do negócio, separado da bolsa dos personagens. */
      cofre: new fields.NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0,
        label: "T20NEG.CampoCofre"
      }),

      ativos: new fields.ArrayField(
        new fields.SchemaField({
          id: new fields.StringField({ required: true, blank: false }),
          /** Arma, perícia, divindade ou ativo copiado, conforme o caso. */
          escolha: new fields.StringField({ required: true, blank: true, initial: "" }),
          nota: new fields.StringField({ required: true, blank: true, initial: "" }),
          /** Usos já gastos na aventura corrente. */
          usados: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0 })
        })
      ),

      /** Personagens com acesso ao negócio, e portanto a seus benefícios. */
      beneficiarios: new fields.ArrayField(
        new fields.SchemaField({
          actorId: new fields.DocumentIdField({ nullable: false }),
          conjuradorArcano: new fields.BooleanField({ initial: false }),
          conjuradorDivino: new fields.BooleanField({ initial: false }),
          devoto: new fields.BooleanField({ initial: false })
        })
      ),

      /** NPCs com nome recrutados para o ativo Mercado Multinivelado. */
      npcsRecrutados: new fields.NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0,
        min: 0
      }),

      /** Saldo negativo acumulado no Cassino, a descontar do próximo prêmio. */
      dividaCassino: new fields.NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0,
        min: 0
      }),

      registro: new fields.ArrayField(
        new fields.SchemaField({
          tipo: new fields.StringField({ required: true, blank: false, initial: "nota" }),
          texto: new fields.StringField({ required: true, blank: true, initial: "" }),
          valor: new fields.NumberField({ required: false, nullable: true, initial: null }),
          timestamp: new fields.NumberField({ required: true, nullable: false, initial: 0 })
        })
      ),

      notas: new fields.HTMLField({ required: true, blank: true, initial: "" })
    };
  }

  /** Campos que mudaram de nome depois de já haver negócios gravados. */
  static migrateData(dados) {
    if (dados.tipo !== undefined && dados.ramo === undefined) dados.ramo = dados.tipo;
    if (dados.caixa !== undefined && dados.cofre === undefined) dados.cofre = dados.caixa;
    return super.migrateData(dados);
  }

  /* -------------------------------------------- */
  /*  Dados derivados                             */
  /*                                              */
  /*  São getters, e não campos preenchidos em    */
  /*  prepareDerivedData, para não dependerem da  */
  /*  ordem de preparação de documentos nem de    */
  /*  como o sistema a organiza.                  */
  /* -------------------------------------------- */

  get slots() {
    return Regras.slotsDeAtivos(this.nivel);
  }

  get slotsLivres() {
    return Math.max(0, this.slots - this.ativos.length);
  }

  /** O teto desta mesa, que a configuração do mundo define. */
  get nivelMaximo() {
    return nivelMaximo();
  }

  get podeExpandir() {
    return Regras.podeExpandir(this.nivel, this.nivelMaximo);
  }

  get porte() {
    return Regras.porte(this.nivel, this.nivelMaximo);
  }

  get temEstudio() {
    return this.idsDeAtivos.includes("estudio");
  }

  get temEscritorio() {
    return this.idsDeAtivos.includes("escritorio");
  }

  get temEmporio() {
    return this.idsDeAtivos.includes("emporio");
  }

  get proximoNivel() {
    return this.podeExpandir ? this.nivel + 1 : null;
  }

  get cdExpansao() {
    return this.podeExpandir ? Regras.cdExpansao(this.proximoNivel, { estudio: this.temEstudio }) : null;
  }

  get custoExpansao() {
    return this.podeExpandir
      ? Regras.custoExpansao(this.proximoNivel, { escritorio: this.temEscritorio })
      : null;
  }

  get rendimentoBase() {
    return Regras.rendimentoBase(this.nivel, { emporio: this.temEmporio });
  }

  get ganhoMercado() {
    return this.idsDeAtivos.includes("mercado-multinivelado")
      ? Regras.ganhoMercadoMultinivelado(this.nivel, this.npcsRecrutados)
      : 0;
  }

  /* -------------------------------------------- */
  /*  Consultas                                   */
  /* -------------------------------------------- */

  /** Os ids dos ativos contratados, incluindo o que a Espionagem Industrial copia. */
  get idsDeAtivos() {
    const ids = this.ativos.map((a) => a.id);
    const espionagem = this.ativos.find((a) => a.id === "espionagem-industrial");
    if (espionagem?.escolha && ATIVOS[espionagem.escolha]) ids.push(espionagem.escolha);
    return ids;
  }

  /**
   * Os ativos em vigor, já resolvendo a Espionagem Industrial: o ativo copiado
   * entra na lista com a marca `copiado`, para a interface deixar claro de onde
   * o benefício veio.
   */
  get ativosEfetivos() {
    const lista = this.ativos
      .filter((a) => ATIVOS[a.id])
      .map((a) => ({ ...a, definicao: ATIVOS[a.id], copiado: false }));

    const espionagem = this.ativos.find((a) => a.id === "espionagem-industrial");
    const copiado = espionagem?.escolha ? ATIVOS[espionagem.escolha] : null;
    if (copiado && !lista.some((a) => a.id === copiado.id)) {
      lista.push({ id: copiado.id, escolha: "", nota: "", usados: 0, definicao: copiado, copiado: true });
    }

    return lista;
  }

  /** O ator do proprietário, se ainda existir no mundo. */
  get atorProprietario() {
    return this.proprietario ? game.actors.get(this.proprietario) : null;
  }

  /** Um ativo pode ser contratado agora? */
  checarAtivo(id) {
    const ativo = ATIVOS[id];
    if (!ativo) return { ok: false, faltando: { nivel: null, ativos: [] } };
    return checarRequisitos(ativo, { nivel: this.nivel, ativosContratados: this.ativos.map((a) => a.id) });
  }
}
