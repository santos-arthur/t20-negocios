/*
 * Diagnóstico do módulo Negócios — cole no console do Foundry (F12).
 *
 * Segue a corrente inteira de um bônus: do ativo contratado até o número na
 * ficha, dizendo em que elo ele se perde.
 */
(async () => {
  const ID = "t20-negocios";
  const TIPO = `${ID}.negocio`;
  const log = (r, v) => console.log(`%c${r}`, "font-weight:bold", v);

  log("Foundry", `${game.version} | ${game.system.id} ${game.system.version}`);
  const mod = game.modules.get(ID);
  if (!mod?.active) return console.error("Módulo inativo.");
  log("Módulo", `ativo, versão ${mod.version}`);
  log("Aplicação automática", game.settings.get(ID, "aplicarEfeitos"));

  const negocios = game.actors.filter((a) => a.type === TIPO);
  if (!negocios.length) return console.warn("Nenhum negócio no mundo.");

  for (const negocio of negocios) {
    console.group(`%c${negocio.name} (nv ${negocio.system.nivel})`, "font-weight:bold");
    log("Ativos", negocio.system.ativos.map((a) => a.id).join(", ") || "(nenhum)");
    log("Beneficiários", negocio.system.beneficiarios.map((b) =>
      game.actors.get(b.actorId)?.name ?? b.actorId).join(", ") || "(nenhum)");

    for (const b of negocio.system.beneficiarios) {
      const actor = game.actors.get(b.actorId);
      if (!actor) continue;
      console.group(`→ ${actor.name}`);

      const api = game.modules.get(ID).api;
      const desejados = api.Beneficios.montarEfeitos(negocio, b);
      log("Efeitos que deveriam existir", desejados.map((e) => e.name));

      const existentes = api.Beneficios.efeitosExistentes(actor, negocio.id);
      log("Efeitos na ficha", existentes.map((e) =>
        `${e.name} [${e.disabled ? "desligado" : "ligado"}${e.active ? ", ativo" : ", INATIVO"}]`));

      for (const efeito of existentes) {
        if (!efeito.changes.length) continue;
        for (const ch of efeito.changes) {
          const atual = foundry.utils.getProperty(actor, ch.key);
          console.log(`   ${efeito.name}: ${ch.key} ${["=","*","+","↓","↑","="][ch.mode] ?? ch.mode} ${ch.value}`,
            "→ valor agora:", atual);
        }
      }

      // O caso mais comum: o bônus entra num array de fórmulas que o sistema soma.
      const pv = actor.system.attributes?.pv;
      if (pv) log("PV", `max ${pv.max} | bonus.total = ${JSON.stringify(pv.bonus?.total)}`);
      const pm = actor.system.attributes?.pm;
      if (pm) log("PM", `max ${pm.max} | bonus.total = ${JSON.stringify(pm.bonus?.total)}`);

      console.groupEnd();
    }
    console.groupEnd();
  }

  console.log("%cSe 'Efeitos na ficha' estiver vazio ou diferente do esperado, use " +
    "Sincronizar fichas na aba Benefícios e rode isto de novo.", "font-style:italic");
})();
