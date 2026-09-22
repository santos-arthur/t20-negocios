/**
 * Tudo que o módulo sabe sobre o sistema Tormenta20 mora aqui.
 *
 * O resto do código pergunta "qual o bônus de Nobreza desse ator?" sem saber
 * onde o sistema guarda isso. Se o sistema mudar de schema — ou se o módulo
 * rodar num mundo sem ele — só este arquivo precisa mudar, e as funções
 * degradam para um modo manual em vez de quebrar a interface.
 */

import { PERICIA_NOBREZA, PERICIA_OFICIO, SISTEMA } from "../constants.mjs";

/** O sistema Tormenta20 está ativo e com a estrutura que esperamos? */
export function temSistemaT20() {
  return game.system.id === SISTEMA && !!CONFIG.T20?.pericias;
}

/** Chaves das perícias de Ofício conhecidas pelo sistema. */
export function chavesDeOficio() {
  if (!temSistemaT20()) return [];
  return [...(CONFIG.T20.oficios ?? [])];
}

/**
 * As perícias com que se administra um negócio: Nobreza e cada Ofício,
 * inclusive os ofícios personalizados que o jogador tenha criado na ficha.
 *
 * @returns {{key: string, label: string, valor: number|null}[]}
 */
export function periciasDeAdministracao(actor) {
  if (!temSistemaT20()) return [];

  const rotulo = (key) => game.i18n.localize(CONFIG.T20.pericias[key]?.label ?? key);
  const lista = [];

  const nobreza = actor?.system?.pericias?.[PERICIA_NOBREZA];
  lista.push({
    key: PERICIA_NOBREZA,
    label: rotulo(PERICIA_NOBREZA),
    valor: nobreza ? nobreza.value ?? 0 : null
  });

  const prefixo = game.i18n.localize("T20.SkillOfic");
  for (const key of chavesDeOficio()) {
    const pericia = actor?.system?.pericias?.[key];
    lista.push({
      key,
      label: `${prefixo}: ${rotulo(key)}`,
      valor: pericia ? pericia.value ?? 0 : null
    });
  }

  // Ofícios personalizados ficam num mapa à parte na ficha do personagem.
  for (const [key, pericia] of Object.entries(actor?.system?.pericias ?? {})) {
    if (!pericia?.custom) continue;
    if (lista.some((p) => p.key === key)) continue;
    if (!ehOficio(key, pericia)) continue;
    lista.push({ key, label: `${prefixo}: ${pericia.label || key}`, valor: pericia.value ?? 0 });
  }

  return lista;
}

/** Perícia personalizada que se comporta como Ofício. */
function ehOficio(key, pericia) {
  if (CONFIG.T20?.oficios?.has?.(key)) return true;
  return pericia?.atributo === "int" && pericia?.st === true;
}

/**
 * Bônus total de uma perícia num ator, ou `null` quando não dá para saber
 * (ator ausente, sistema diferente, perícia inexistente).
 */
export function bonusDePericia(actor, key) {
  const pericia = actor?.system?.pericias?.[key];
  if (!pericia || key === PERICIA_OFICIO) return null;
  return Number(pericia.value ?? 0);
}

/**
 * Rola um teste de administração contra uma CD.
 *
 * Usa o bônus da ficha quando existe; caso contrário aceita um bônus digitado
 * à mão, de modo que o módulo continue utilizável em qualquer sistema.
 */
export async function rolarTeste({ actor, pericia, bonus, cd, titulo }) {
  const modificador = Number.isFinite(bonus) ? bonus : (bonusDePericia(actor, pericia) ?? 0);
  const formula = modificador >= 0 ? `1d20 + ${modificador}` : `1d20 - ${Math.abs(modificador)}`;

  const roll = await new Roll(formula).evaluate();
  return {
    roll,
    total: roll.total,
    modificador,
    sucesso: roll.total >= cd,
    cd,
    titulo
  };
}

/**
 * O melhor bônus que o personagem tem entre as perícias de administração.
 *
 * É o que ele usaria para cuidar do negócio, e serve para estimar o rendimento
 * antes de a perícia ser escolhida. `null` quando não há como saber.
 */
export function melhorBonusDeAdministracao(actor) {
  const valores = periciasDeAdministracao(actor)
    .map((p) => p.valor)
    .filter((v) => Number.isFinite(v));
  return valores.length ? Math.max(...valores) : null;
}

/**
 * Rola a perícia pela ficha do personagem, abrindo o diálogo de rolagem do
 * próprio sistema — com os bônus, efeitos e modificadores que ele já conhece.
 *
 * É melhor do que somar um bônus à mão: o sistema aplica efeitos ativos, o
 * gasto de mana e as opções de rolagem que a mesa já usa em todo teste.
 *
 * @returns {Promise<{suportado: boolean, cancelado: boolean, resultado: object|null}>}
 */
export async function rolarPelaFicha(actor, pericia, { cd, titulo }) {
  if (!temSistemaT20() || !pericia || typeof actor?.rollPericia !== "function") {
    return { suportado: false, cancelado: false, resultado: null };
  }

  // `message: false` devolve a Roll em vez de publicar um card do sistema —
  // quem publica é o módulo, com o contexto do negócio.
  const roll = await actor.rollPericia(pericia, { message: false });
  if (!roll) return { suportado: true, cancelado: true, resultado: null };

  return {
    suportado: true,
    cancelado: false,
    resultado: {
      roll,
      total: roll.total,
      modificador: null,
      sucesso: roll.total >= cd,
      cd,
      titulo,
      actor,
      pericia,
      rotuloPericia: rotuloDePericia(actor, pericia)
    }
  };
}

/** Rótulo legível de uma perícia, com carinho para ofícios personalizados. */
export function rotuloDePericia(actor, key) {
  const custom = actor?.system?.pericias?.[key];
  if (custom?.custom && custom.label) return custom.label;
  const config = CONFIG.T20?.pericias?.[key];
  return config ? game.i18n.localize(config.label) : key;
}

/**
 * Onde o sistema guarda os T$ na ficha do personagem.
 *
 * Cuidado com os nomes: o campo chamado `to` é o tibar de OURO (rótulo "TO") e
 * o chamado `tp` é o tibar comum (rótulo "T$"), que vale um décimo dele. O
 * cofre do negócio e todos os valores do módulo são contados em T$, então é
 * `tp` que recebe e paga — usar `to` multiplicaria tudo por dez.
 */
export const CAMPO_TIBARES = "system.dinheiro.tp";

/** Quantos T$ o ator tem em mãos, ou `null` se não der para ler. */
export function tibaresDe(actor) {
  const valor = foundry.utils.getProperty(actor ?? {}, CAMPO_TIBARES);
  return Number.isFinite(valor) ? valor : null;
}

/** Debita T$ da ficha do proprietário, quando isso for possível. */
export async function debitarTibares(actor, quantia) {
  const atual = tibaresDe(actor);
  if (atual === null || !actor?.isOwner) return false;
  await actor.update({ [CAMPO_TIBARES]: Math.max(0, atual - quantia) });
  return true;
}

/** Credita T$ na ficha do proprietário. */
export async function creditarTibares(actor, quantia) {
  const atual = tibaresDe(actor);
  if (atual === null || !actor?.isOwner) return false;
  await actor.update({ [CAMPO_TIBARES]: atual + quantia });
  return true;
}
