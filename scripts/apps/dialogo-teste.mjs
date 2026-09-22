/**
 * O diálogo de teste de administração — Ofício ou Nobreza.
 *
 * É o mesmo diálogo para expandir o negócio e para dedicar um mês ao
 * rendimento, porque em regras é sempre o mesmo teste. Muda o que está em jogo,
 * que o chamador descreve nas caixas do topo.
 *
 * A rolagem em si sai pela ficha do personagem, no diálogo do próprio sistema:
 * é ele que conhece os efeitos ativos, o gasto de mana e as opções de rolagem
 * que a mesa já usa.
 */

import { MODULO } from "../constants.mjs";
import * as T20 from "../services/t20-adapter.mjs";

const { DialogV2 } = foundry.applications.api;

/**
 * Abre o diálogo e devolve o resultado do teste, ou `null` se cancelado — seja
 * aqui, seja no diálogo de rolagem do sistema.
 *
 * @param {object} opcoes
 * @param {string} opcoes.titulo
 * @param {string} opcoes.descricao
 * @param {number} opcoes.cd            0 quando o teste não tem CD.
 * @param {object[]} [opcoes.caixas]    `[{ rotulo, valor, nota }]`
 * @param {Actor} [opcoes.proprietario] Personagem sugerido.
 * @param {string} [opcoes.rotuloBotao]
 * @param {string} [opcoes.icone]
 * @returns {Promise<object|null>}
 */
export async function pedirTeste({
  titulo, descricao, cd, caixas = [], proprietario = null, rotuloBotao,
  icone = "fa-solid fa-dice-d20", aoTrocarPericia = null
}) {
  const candidatos = game.actors
    .filter((a) => a.type === "character" && a.isOwner)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  if (proprietario && !candidatos.includes(proprietario)) candidatos.unshift(proprietario);
  const inicial = proprietario ?? candidatos[0] ?? null;

  const content = await foundry.applications.handlebars.renderTemplate(
    `modules/${MODULO}/templates/dialogo-teste.hbs`,
    {
      descricao,
      caixas,
      temSistema: T20.temSistemaT20(),
      atores: candidatos.map((a) => ({ id: a.id, nome: a.name, selecionado: a.id === inicial?.id })),
      pericias: periciasDe(inicial)
    }
  );

  const escolha = await DialogV2.wait({
    window: { title: titulo, icon: "fa-solid fa-scale-balanced" },
    classes: ["tormenta20", "t20neg", "t20neg-dialogo", "themed", "theme-light"],
    position: { width: 480 },
    content,
    buttons: [
      {
        action: "rolar",
        label: rotuloBotao ?? game.i18n.localize("T20NEG.BotaoRolar"),
        icon: icone,
        default: true,
        callback: (_evento, botao) => {
          const form = botao.form;
          return {
            actorId: form.elements.actorId?.value || null,
            pericia: form.elements.pericia?.value || null,
            bonus: Number(form.elements.bonus?.value ?? 0)
          };
        }
      },
      { action: "cancelar", label: game.i18n.localize("T20NEG.BotaoCancelar"), icon: "fa-solid fa-xmark" }
    ],
    render: (_evento, dialogo) => ligarCampos(dialogo.element, aoTrocarPericia),
    rejectClose: false
  });

  if (!escolha || escolha === "cancelar") return null;

  const actor = escolha.actorId ? game.actors.get(escolha.actorId) : null;

  // O teste sai pela ficha; fechar aquele diálogo desiste da ação inteira.
  const pelaFicha = await T20.rolarPelaFicha(actor, escolha.pericia, { cd, titulo });
  if (pelaFicha.cancelado) return null;
  if (pelaFicha.resultado) return pelaFicha.resultado;

  // Sem o sistema Tormenta20, o bônus vem digitado à mão.
  const resultado = await T20.rolarTeste({ actor, pericia: escolha.pericia, bonus: escolha.bonus, cd, titulo });
  return { ...resultado, actor, pericia: escolha.pericia };
}

/** Opções de perícia para um ator, já com o bônus da ficha. */
export function periciasDe(actor) {
  return T20.periciasDeAdministracao(actor).map((p, i) => ({
    ...p,
    selecionado: i === 0,
    valor: p.valor ?? 0
  }));
}

/**
 * Mantém os campos em sincronia: trocar de personagem recarrega as perícias.
 * Sem isso o jogador rolaria com a perícia de outro personagem sem perceber.
 */
export function ligarCampos(root, aoTrocarPericia = null) {
  const seletorAtor = root.querySelector("[name=actorId]");
  const seletorPericia = root.querySelector("[name=pericia]");
  if (!seletorAtor || !seletorPericia) return;

  // Caixas que dependem do bônus — como a faixa de rendimento — são reescritas
  // quando o bônus muda, senão mostrariam a conta de outro personagem.
  const atualizar = () => {
    const bonus = Number(seletorPericia.selectedOptions[0]?.dataset.valor ?? 0);
    for (const [seletor, texto] of Object.entries(aoTrocarPericia?.(bonus) ?? {})) {
      const alvo = root.querySelector(seletor);
      if (alvo) alvo.textContent = texto;
    }
  };

  seletorAtor.addEventListener("change", () => {
    const actor = game.actors.get(seletorAtor.value);
    seletorPericia.innerHTML = periciasDe(actor)
      .map((p) => `<option value="${p.key}" data-valor="${p.valor}">${foundry.utils.escapeHTML(p.label)}</option>`)
      .join("");
    atualizar();
  });

  seletorPericia.addEventListener("change", atualizar);
  atualizar();
}
