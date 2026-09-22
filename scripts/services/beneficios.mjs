/**
 * Traduz os ativos de um negócio nos benefícios de cada personagem com acesso.
 *
 * A saída tem duas metades, e a separação é deliberada:
 *
 *  - `automaticos`: bônus que o sistema sabe somar sozinho. Viram um único
 *    Active Effect por negócio na ficha do personagem.
 *  - `lembretes`: proficiências, magias extras, permissões narrativas e efeitos
 *    situacionais. O módulo os exibe e não os aplica. Automatizar esses casos
 *    produziria fichas silenciosamente erradas, e uma ficha errada custa mais
 *    caro do que um lembrete que o jogador lê.
 *
 * Os benefícios de ativos são benefícios de estruturas: acumulam com outras
 * fontes, mas não com outros benefícios de estrutura.
 *
 * Fonte das regras: Jornada Heroica - Fim dos Tempos Arco 2: Valkaria.
 */

import { CONFIGS, FLAGS, MODULO } from "../constants.mjs";
import { exigencia } from "../data/ativos.mjs";
import { chavesDeOficio } from "./t20-adapter.mjs";

/** Ícone do efeito criado nas fichas dos beneficiários. */
const ICONE_EFEITO = "icons/environment/settlement/house-manor.webp";

/**
 * Monta a lista de benefícios de um beneficiário específico.
 *
 * @param {Actor} negocio
 * @param {object} beneficiario Entrada de `system.beneficiarios`.
 * @returns {{automaticos: object[], lembretes: object[], bloqueados: object[]}}
 */
export function beneficiosDe(negocio, beneficiario) {
  const contexto = {
    nivel: negocio.system.nivel,
    oficios: chavesDeOficio(),
    avancoPorMarcos: game.settings.get(MODULO, CONFIGS.avancoPorMarcos)
  };

  const automaticos = [];
  const lembretes = [];
  const bloqueados = [];

  for (const ativo of negocio.system.ativosEfetivos) {
    const def = ativo.definicao;
    const entrada = {
      id: def.id,
      nome: game.i18n.localize(def.nome),
      efeito: game.i18n.localize(def.efeito),
      escolha: ativo.escolha,
      temEscolha: !!def.escolha,
      rotuloEscolha: def.escolha ? game.i18n.localize(def.escolha.label) : null,
      copiado: ativo.copiado,
      nota: def.nota ? game.i18n.localize(def.nota) : null,
      aoUsar: def.aoUsar?.({ ...contexto, escolha: ativo.escolha }) ?? null,
      naRolagem: !!def.aoUsar
    };

    // Ativos condicionais só valem para quem cumpre a condição. Quem não
    // cumpre vê a entrada em "bloqueados", e não um bônus que não existe.
    if (def.condicao && !beneficiario[def.condicao]) {
      bloqueados.push({ ...entrada, condicao: exigencia(def.condicao) });
      continue;
    }

    const changes = def.changes?.({ ...contexto, escolha: ativo.escolha }) ?? [];
    const automatizado = changes.length > 0 || !!entrada.aoUsar;
    if (automatizado) automaticos.push({ ...entrada, changes });

    // Um ativo pode ter parte automática e parte manual: a Propaganda oferece o
    // bônus na rolagem, o Cassino também, mas a aposta é rolada à mão.
    if (!automatizado || def.usos) lembretes.push(entrada);
  }

  return { automaticos, lembretes, bloqueados };
}

/**
 * Monta os Active Effects de um beneficiário — um por ativo, e não um só para
 * o negócio inteiro.
 *
 * Um efeito por ativo custa mais linhas na ficha, mas paga: o jogador vê de
 * onde cada bônus vem, e pode desligar um ativo isolado sem perder os outros.
 *
 * @returns {object[]} Dados prontos para createEmbeddedDocuments.
 */
export function montarEfeitos(negocio, beneficiario) {
  const { automaticos, lembretes, bloqueados } = beneficiosDe(negocio, beneficiario);
  const efeitos = [];

  // Bônus incondicionais: somados o tempo todo. Um ativo cujo benefício só
  // existe na rolagem não tem nada a somar aqui.
  for (const entrada of automaticos) {
    if (!entrada.changes?.length) continue;
    efeitos.push(base(negocio, entrada, {
      changes: entrada.changes.map((c) => ({ priority: 20, ...c }))
    }));
  }

  // Bônus condicionais: oferecidos na rolagem a que pertencem.
  for (const entrada of [...automaticos, ...lembretes]) {
    const chave = `${entrada.id}-uso`;
    if (!entrada.aoUsar || efeitos.some((e) => e.flags[MODULO][FLAGS.ativo] === chave)) continue;
    efeitos.push(efeitoAoUsar(negocio, entrada, chave));
  }

  return efeitos;
}

/** O esqueleto comum a todo efeito criado pelo módulo. */
function base(negocio, entrada, { nome, description, changes = [], disabled = false, system } = {}) {
  return {
    name: game.i18n.format("T20NEG.NomeDoEfeito", {
      negocio: negocio.name,
      ativo: nome ?? entrada.nome
    }),
    img: negocio.img || ICONE_EFEITO,
    description: description ?? `<p>${entrada.efeito ?? ""}</p>`,
    origin: negocio.uuid,
    disabled,
    transfer: false,
    changes,
    ...(system ? { system } : {}),
    flags: {
      [MODULO]: {
        [FLAGS.origem]: negocio.id,
        [FLAGS.ativo]: entrada.id
      }
    }
  };
}

/** Os Active Effects que este negócio já criou num ator. */
export function efeitosExistentes(actor, negocioId) {
  return actor.effects.filter((e) => e.getFlag(MODULO, FLAGS.origem) === negocioId);
}

/** Este negócio já tem algum efeito nesta ficha? */
export function efeitoExistente(actor, negocioId) {
  return efeitosExistentes(actor, negocioId)[0] ?? null;
}

/**
 * Efeito que o sistema oferece no diálogo de rolagem.
 *
 * `onuse` tira o efeito da conta normal e o coloca como opção; `automatic`
 * deixa a opção já marcada, para o caso comum não dar trabalho. `names` limita
 * a quais perícias (ou armas) ele aparece — sem isso, apareceria em todas.
 */
function efeitoAoUsar(negocio, entrada, chave) {
  const { tipos, pericias, nomes, changes, automatico, custo } = entrada.aoUsar;
  const rotulos = [
    ...nomes,
    ...pericias.map((chave) => game.i18n.localize(CONFIG.T20?.pericias?.[chave]?.label ?? chave))
  ];

  return base(negocio, { id: chave, nome: entrada.nome }, {
    description: `<p>${entrada.efeito}</p>`,
    // O sistema espera o efeito desligado: quem o liga é a marcação na rolagem.
    disabled: true,
    system: {
      onuse: true,
      changes,
      abilityUse: {
        automatic: automatico ?? true,
        aumenta: false,
        custo: custo ?? null,
        names: rotulos,
        types: tipos
      }
    }
  });
}

/**
 * Sincroniza as fichas dos beneficiários com o estado atual do negócio:
 * cria, atualiza ou remove o efeito de cada um.
 *
 * Só toca em atores que o usuário atual pode editar. Os demais são devolvidos
 * em `pendentes` para que a camada de socket peça ao Mestre — assim o jogador
 * nunca vê um erro de permissão, e sim o trabalho sendo concluído por quem pode.
 *
 * @returns {Promise<{aplicados: string[], removidos: string[], pendentes: string[]}>}
 */
export async function sincronizar(negocio, { somenteLocais = true } = {}) {
  const resultado = { aplicados: [], removidos: [], pendentes: [] };
  if (!game.settings.get(MODULO, CONFIGS.aplicarEfeitos)) return resultado;

  const comAcesso = new Set(negocio.system.beneficiarios.map((b) => b.actorId));

  for (const beneficiario of negocio.system.beneficiarios) {
    const actor = game.actors.get(beneficiario.actorId);
    if (!actor) continue;

    if (somenteLocais && !actor.isOwner) {
      resultado.pendentes.push(actor.id);
      continue;
    }

    await reconciliar(actor, negocio, montarEfeitos(negocio, beneficiario));
    resultado.aplicados.push(actor.id);
  }

  // Quem saiu da lista de beneficiários perde os efeitos.
  for (const actor of game.actors) {
    if (comAcesso.has(actor.id)) continue;
    const orfaos = efeitosExistentes(actor, negocio.id);
    if (!orfaos.length) continue;
    if (somenteLocais && !actor.isOwner) {
      resultado.pendentes.push(actor.id);
      continue;
    }
    await actor.deleteEmbeddedDocuments("ActiveEffect", orfaos.map((e) => e.id));
    resultado.removidos.push(actor.id);
  }

  return resultado;
}

/**
 * Deixa os efeitos do negócio na ficha exatamente como devem estar: cria o que
 * falta, atualiza o que mudou e apaga o que sobrou.
 *
 * Reconciliar em vez de apagar tudo e recriar preserva os ids dos efeitos — e
 * com eles qualquer ajuste que o jogador tenha feito à mão, como desligar um.
 */
async function reconciliar(actor, negocio, desejados) {
  const atuais = new Map(
    efeitosExistentes(actor, negocio.id).map((e) => [e.getFlag(MODULO, FLAGS.ativo), e])
  );

  const criar = [];
  const atualizar = [];

  for (const efeito of desejados) {
    const chave = efeito.flags[MODULO][FLAGS.ativo];
    const atual = atuais.get(chave);
    if (atual) {
      // `disabled` não entra: se o jogador desligou o efeito, ele fica desligado.
      const { disabled, ...resto } = efeito;
      atualizar.push({ ...resto, _id: atual.id });
      atuais.delete(chave);
    } else {
      criar.push(efeito);
    }
  }

  const apagar = [...atuais.values()].map((e) => e.id);

  if (apagar.length) await actor.deleteEmbeddedDocuments("ActiveEffect", apagar);
  if (atualizar.length) await actor.updateEmbeddedDocuments("ActiveEffect", atualizar);
  if (criar.length) await actor.createEmbeddedDocuments("ActiveEffect", criar);
}

/** Remove os efeitos deste negócio de todas as fichas — usado ao excluí-lo. */
export async function limparEfeitos(negocioId, { somenteLocais = true } = {}) {
  const pendentes = [];
  for (const actor of game.actors) {
    const efeitos = efeitosExistentes(actor, negocioId);
    if (!efeitos.length) continue;
    if (somenteLocais && !actor.isOwner) {
      pendentes.push(actor.id);
      continue;
    }
    await actor.deleteEmbeddedDocuments("ActiveEffect", efeitos.map((e) => e.id));
  }
  return pendentes;
}
