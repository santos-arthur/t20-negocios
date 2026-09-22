/**
 * Publicação dos resultados no chat.
 *
 * Todo teste e todo pagamento vira uma mensagem — não por enfeite, mas porque
 * um negócio é combinado entre mestre e jogador ao longo de meses de jogo, e o
 * log do chat é o único lugar onde essa combinação fica registrada.
 */

import { MODULO } from "../constants.mjs";

const TEMPLATE = `modules/${MODULO}/templates/chat/card.hbs`;

/**
 * Publica um card do módulo.
 *
 * @param {object} opcoes
 * @param {Actor} opcoes.negocio
 * @param {string} opcoes.titulo
 * @param {string} [opcoes.texto]      Parágrafo de contexto.
 * @param {object[]} [opcoes.linhas]   `[{ rotulo, valor }]`
 * @param {Roll} [opcoes.roll]         Rolagem a anexar à mensagem.
 * @param {"sucesso"|"falha"|null} [opcoes.desfecho]
 */
export async function publicar({ negocio, titulo, texto = "", linhas = [], roll = null, desfecho = null }) {
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    titulo,
    texto,
    linhas: linhas.filter(Boolean),
    desfecho,
    negocio: { nome: negocio?.name, img: negocio?.img, nivel: negocio?.system?.nivel },
    fonte: game.i18n.localize("T20NEG.Fonte")
  });

  const dados = {
    content,
    speaker: ChatMessage.getSpeaker({ actor: negocio?.system?.atorProprietario ?? undefined }),
    flags: { [MODULO]: { card: true } }
  };

  if (roll) {
    dados.rolls = [roll];
    dados.sound = CONFIG.sounds.dice;
  }

  return ChatMessage.create(dados);
}

/** Formata um valor em tibares para exibição. */
export function tibares(valor) {
  const n = Math.abs(Math.round(valor));
  const sinal = valor < 0 ? "−" : "";
  return `${sinal}T$ ${n.toLocaleString("pt-BR")}`;
}
