/**
 * Ponte para o Mestre.
 *
 * Um jogador pode gerenciar o próprio negócio, mas não pode escrever na ficha
 * de outro personagem — e os benefícios de um negócio alcançam o grupo todo.
 * Quando isso acontece, o pedido viaja por socket e o primeiro Mestre conectado
 * executa em nome de quem pediu.
 *
 * O Mestre não é um executor cego: cada pedido é conferido contra o estado do
 * negócio antes de virar escrita. Um cliente não consegue pedir uma alteração
 * que o próprio negócio não justifique.
 */

import { MODULO, SOCKET } from "../constants.mjs";
import { limparEfeitos, sincronizar } from "./beneficios.mjs";

const ACOES = {
  sincronizar: "sincronizar",
  limpar: "limpar",
  criar: "criar"
};

/** Este cliente é o Mestre responsável por atender pedidos? */
function souORelay() {
  if (!game.user.isGM) return false;
  const gms = game.users.filter((u) => u.isGM && u.active).sort((a, b) => a.id.localeCompare(b.id));
  return gms[0]?.id === game.user.id;
}

export function registrarSocket() {
  game.socket.on(SOCKET, async (pedido) => {
    if (!souORelay()) return;

    try {
      switch (pedido.acao) {
        case ACOES.sincronizar: {
          const negocio = game.actors.get(pedido.negocioId);
          if (!negocio) return;
          await sincronizar(negocio, { somenteLocais: false });
          break;
        }
        case ACOES.limpar: {
          await limparEfeitos(pedido.negocioId, { somenteLocais: false });
          break;
        }
        case ACOES.criar: {
          // O teste já foi rolado e publicado no chat pelo cliente que pediu;
          // aqui só resta materializar o documento.
          const negocio = await Actor.create(pedido.dados);
          ui.notifications.info(
            game.i18n.format("T20NEG.AvisoNegocioCriadoParaJogador", {
              nome: negocio.name,
              usuario: game.users.get(pedido.de)?.name ?? "?"
            })
          );
          break;
        }
      }
    } catch (erro) {
      console.error(`${MODULO} | falha ao atender pedido via socket`, pedido, erro);
    }
  });
}

/** Há um Mestre conectado para atender pedidos? */
export function temMestreConectado() {
  return game.users.some((u) => u.isGM && u.active);
}

/**
 * Sincroniza o que der localmente e, quando autorizado, delega o restante ao
 * Mestre.
 *
 * Quem não administra o negócio pode sincronizar mesmo assim — mas só as
 * fichas que possui. É o caso de um beneficiário querendo os bônus na própria
 * ficha sem depender do dono; delegar ali faria um jogador disparar escritas
 * nas fichas dos outros.
 *
 * @param {Actor} negocio
 * @param {object} [opcoes]
 * @param {boolean} [opcoes.delegar] Pedir ao Mestre o que não se pode escrever.
 * @returns {Promise<{delegado: boolean, pendentes: string[]}>}
 */
export async function sincronizarComApoio(negocio, { delegar = true } = {}) {
  const resultado = await sincronizar(negocio, { somenteLocais: !game.user.isGM });
  const pendentes = [...new Set(resultado.pendentes)];

  if (!pendentes.length) return { delegado: false, pendentes: [], aplicados: resultado.aplicados };
  if (!delegar) return { delegado: false, pendentes, aplicados: resultado.aplicados };
  if (!temMestreConectado()) return { delegado: false, pendentes, aplicados: resultado.aplicados };

  game.socket.emit(SOCKET, { acao: ACOES.sincronizar, negocioId: negocio.id, de: game.user.id });
  return { delegado: true, pendentes, aplicados: resultado.aplicados };
}

/**
 * Cria um negócio: direto, se este usuário puder criar Atores; pelo Mestre, se
 * não puder. Devolve o documento, ou `null` quando o pedido foi delegado.
 */
export async function criarComApoio(dados) {
  if (game.user.can("ACTOR_CREATE")) return Actor.create(dados);

  if (!temMestreConectado()) {
    ui.notifications.error(game.i18n.localize("T20NEG.AvisoSemMestreParaCriar"));
    return null;
  }

  game.socket.emit(SOCKET, { acao: ACOES.criar, dados, de: game.user.id });
  ui.notifications.info(game.i18n.localize("T20NEG.AvisoCriacaoDelegada"));
  return null;
}

/** Pede a remoção dos efeitos de um negócio excluído. */
export async function limparComApoio(negocioId) {
  const pendentes = await limparEfeitos(negocioId, { somenteLocais: !game.user.isGM });
  if (pendentes.length && temMestreConectado()) {
    game.socket.emit(SOCKET, { acao: ACOES.limpar, negocioId, de: game.user.id });
  }
}
