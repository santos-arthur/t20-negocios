/**
 * Identificadores e constantes compartilhadas.
 *
 * Fonte das regras: Jornada Heroica - Fim dos Tempos Arco 2: Valkaria.
 */

export const MODULO = "t20-negocios";

/** O único sistema em que o módulo funciona. */
export const SISTEMA = "tormenta20";

/** Subtipo de Actor registrado por este módulo. */
export const TIPO_NEGOCIO = `${MODULO}.negocio`;

/** Canal de socket usado para delegar gravações ao Mestre. */
export const SOCKET = `module.${MODULO}`;

/** Chaves de configuração do mundo. */
export const CONFIGS = {
  /** Aplicar Active Effects nos personagens com acesso. */
  aplicarEfeitos: "aplicarEfeitos",
  /** O grupo usa avanço por marcos em vez de XP. */
  avancoPorMarcos: "avancoPorMarcos",
  /** Até onde um negócio pode crescer nesta mesa. */
  nivelMaximo: "nivelMaximo",
  /** Pasta onde os negócios criados pelo módulo são guardados. */
  pastaNegocios: "pastaNegocios"
};

/** Flags gravadas em documentos de terceiros (atores beneficiários). */
export const FLAGS = {
  /** Id do negócio que originou um Active Effect. */
  origem: "negocioId",
  /** Id do ativo que o efeito representa — há um efeito por ativo. */
  ativo: "ativoId"
};

export const NIVEL_MIN = 1;

/** O teto que as regras preveem, e o padrão da configuração do mundo. */
export const NIVEL_MAXIMO_PADRAO = 7;

/**
 * Teto absoluto do schema. A configuração do mundo manda dentro deste limite;
 * ele existe só para o campo ter um máximo válido, já que a configuração pode
 * mudar depois de um negócio ter sido gravado.
 */
export const NIVEL_TETO = 20;

/** O nível máximo em vigor nesta mesa. */
export function nivelMaximo() {
  const configurado = game.settings?.get(MODULO, CONFIGS.nivelMaximo);
  return Number.isInteger(configurado) && configurado > 0 ? configurado : NIVEL_MAXIMO_PADRAO;
}

/** Ícone padrão de um negócio recém-criado. */
export const ICONE_PADRAO = "icons/environment/settlement/house-farmland-small.webp";

/** Perícias que podem ser usadas para administrar um negócio. */
export const PERICIA_NOBREZA = "nobr";

/** Chave da perícia Ofício genérica no sistema Tormenta20. */
export const PERICIA_OFICIO = "ofic";
