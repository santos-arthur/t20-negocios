/*
 * Testes das regras, rodados fora do Foundry: `node testes/regras.test.mjs`.
 *
 * O objetivo é conferir as fórmulas contra os exemplos do próprio livro e
 * garantir que o catálogo não perca entradas nem textos. O ambiente do Foundry
 * é simulado no mínimo necessário — só o que os arquivos de dados e serviços
 * realmente consultam.
 *
 * Fonte das regras: Jornada Heroica - Fim dos Tempos Arco 2: Valkaria.
 */
import fs from "node:fs";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const textos = JSON.parse(fs.readFileSync(`${RAIZ}/lang/pt-BR.json`, "utf8"));

// Rótulos que, no Foundry, vêm do arquivo de idioma do sistema.
Object.assign(textos, {
  "T20.SkillLuta": "Luta", "T20.SkillDipl": "Diplomacia", "T20.SkillEnga": "Enganação",
  "T20.SkillInti": "Intimidação", "T20.SkillInve": "Investigação", "T20.SkillFort": "Fortitude",
  "T20.SkillConh": "Conhecimento", "T20.SkillNobr": "Nobreza", "T20.SkillJoga": "Jogatina",
  "T20.SkillFurt": "Furtividade", "T20.SkillOfic": "Ofício"
});

globalThis.game = {
  system: { id: "tormenta20" },
  user: { isGM: true, id: "u1" },
  users: [{ isGM: true, active: true, id: "u1" }],
  actors: [],
  settings: {
    _v: { "t20-negocios.aplicarEfeitos": true, "t20-negocios.avancoPorMarcos": false },
    get(m, k) { return this._v[`${m}.${k}`]; },
    set(m, k, v) { this._v[`${m}.${k}`] = v; }
  },
  i18n: {
    localize: (k) => textos[k] ?? k,
    format: (k, d = {}) => (textos[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => d[n] ?? `{${n}}`)
  }
};

globalThis.CONFIG = {
  T20: {
    pericias: {
      fort: { label: "T20.SkillFort" }, conh: { label: "T20.SkillConh" },
      nobr: { label: "T20.SkillNobr" }, joga: { label: "T20.SkillJoga" },
      furt: { label: "T20.SkillFurt" }, dipl: { label: "T20.SkillDipl" },
      enga: { label: "T20.SkillEnga" }, luta: { label: "T20.SkillLuta" },
      inti: { label: "T20.SkillInti" }, inve: { label: "T20.SkillInve" },
      alfa: { label: "T20.SkillAlfa", crafting: true },
      alqu: { label: "T20.SkillAlqu", crafting: true }, arme: { label: "T20.SkillArme", crafting: true },
      arte: { label: "T20.SkillArte", crafting: true }, cozi: { label: "T20.SkillCozi", crafting: true },
      enge: { label: "T20.SkillEnge", crafting: true }
    },
    oficios: new Set(["alfa", "alqu", "arme", "arte", "cozi", "enge"])
  }
};

const { ATIVOS, checarRequisitos, listarAtivos, dependentesDe } = await import(`${RAIZ}/scripts/data/ativos.mjs`);
const Regras = await import(`${RAIZ}/scripts/data/regras.mjs`);
const Beneficios = await import(`${RAIZ}/scripts/services/beneficios.mjs`);
const Chat = await import(`${RAIZ}/scripts/services/chat.mjs`);

let falhas = 0;
const conferir = (nome, real, esperado) => {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log(`  ✗ ${nome}\n      esperado ${JSON.stringify(esperado)}\n      obtido   ${JSON.stringify(real)}`); }
  else console.log(`  ✓ ${nome}`);
};

console.log("\n— Regras do livro (exemplos conferidos com o texto) —");
conferir("fundação custa T$ 1.000 contra CD 20", [Regras.CUSTO_CRIACAO, Regras.CD_CRIACAO], [1000, 20]);
conferir("nível 3→4: CD 28", Regras.cdExpansao(4), 28);
conferir("nível 3→4: T$ 4.000", Regras.custoExpansao(4), 4000);
conferir("Estúdio abate 5 da CD", Regras.cdExpansao(4, { estudio: true }), 23);
conferir("Escritório corta o custo pela metade", Regras.custoExpansao(4, { escritorio: true }), 2000);
conferir("negócio nível 5 rende T$ 500", Regras.rendimentoBase(5), 500);
conferir("teste 25 num nível 5 rende T$ 1.250", Regras.rendimentoDedicado(25, 5), 1250);

// O capítulo conta o Empório e o Cassino em TO, que vale dez tibares.
conferir("Empório: nível 5 rende TO 500, ou T$ 5.000",
  Regras.rendimentoBase(5, { emporio: true }), 5000);
conferir("Empório: teste 25 num nível 5 rende T$ 12.500",
  Regras.rendimentoDedicado(25, 5, { emporio: true }), 12500);
// A interface mostra a fórmula com o mesmo fator que a conta usa.
conferir("fator do rendimento dedicado: 10, ou 100 com Empório",
  [Regras.fatorDedicado(), Regras.fatorDedicado({ emporio: true })], [10, 100]);

// A faixa é o intervalo real de 1d20 + bônus, e não uma estimativa.
conferir("faixa de um nível 3 com bônus +15",
  Regras.faixaDedicada(15, 3), { minimo: 480, maximo: 1050 });
conferir("sem bônus, o piso é o resultado 1",
  Regras.faixaDedicada(0, 1).minimo, 10);
conferir("Cassino nível 1, dado par: TO 10 = T$ 100", Regras.premioCassino(1, 2).valor, 100);
conferir("Cassino nível 2, dado par: TO 40 = T$ 400", Regras.premioCassino(2, 4).valor, 400);
conferir("Cassino nível 3, dado par: TO 90 = T$ 900", Regras.premioCassino(3, 6).valor, 900);
conferir("Cassino nível 3, dado ímpar: perde metade", Regras.premioCassino(3, 7).valor, -450);
conferir("Mercado: multiplicador limitado ao nível", Regras.ganhoMercadoMultinivelado(3, 9), 900);
conferir("nível 7 é o teto padrão", Regras.podeExpandir(7, 7), false);
conferir("mas o teto é da mesa", Regras.podeExpandir(7, 10), true);

console.log("\n— Catálogo —");
conferir("45 ativos", Object.keys(ATIVOS).length, 45);
conferir("ordenação alfabética em pt-BR", listarAtivos()[0].id, "academia");
conferir("Academia exige nível 7", checarRequisitos(ATIVOS.academia, { nivel: 6, ativosContratados: [] }).ok, false);
conferir("Academia liberada no nível 7", checarRequisitos(ATIVOS.academia, { nivel: 7, ativosContratados: [] }).ok, true);
conferir("Forjaria exige Oficina", checarRequisitos(ATIVOS.forjaria, { nivel: 5, ativosContratados: [] }).ok, false);
conferir("Forjaria com Oficina", checarRequisitos(ATIVOS.forjaria, { nivel: 5, ativosContratados: ["oficina"] }).ok, true);
conferir("Lab. Secreto exige Fachada e nível 5",
  checarRequisitos(ATIVOS["laboratorio-secreto"], { nivel: 5, ativosContratados: ["fachada"] }).ok, true);
conferir("Oficina é pré-requisito de 5 ativos",
  dependentesDe("oficina", Object.keys(ATIVOS)).length, 5);

console.log("\n— Tradução —");
const semTexto = [];
for (const a of Object.values(ATIVOS)) {
  for (const campo of ["nome", "resumo", "efeito"]) {
    if (!textos[a[campo]]) semTexto.push(a[campo]);
  }
}
conferir("todo ativo tem nome, resumo e efeito", semTexto, []);

console.log("\n— Benefícios —");
const negocioFalso = (ativos, nivel = 7) => ({
  id: "neg1", name: "Taverna do Corvo", img: "x.webp", uuid: "Actor.neg1",
  system: {
    nivel,
    ativosEfetivos: ativos.map((a) => ({
      id: a.id ?? a, escolha: a.escolha ?? "", usados: 0, copiado: false,
      definicao: ATIVOS[a.id ?? a]
    }))
  }
});
const todos = { actorId: "a1", conjuradorArcano: true, conjuradorDivino: true, devoto: true };
const leigo = { actorId: "a2", conjuradorArcano: false, conjuradorDivino: false, devoto: false };

const b1 = Beneficios.beneficiosDe(negocioFalso(["botica", "clinica", "livraria"]), leigo);
conferir("três ativos automatizados", b1.automaticos.length, 3);

// Bônus de perícia são oferecidos na rolagem daquela perícia, não somados
// sempre: o do Fortitude não vale para todo teste de Fortitude do personagem,
// vale enquanto ele frequenta a botica.
conferir("Botica é oferecida na rolagem de Fortitude",
  [...b1.automaticos.find((a) => a.id === "botica").aoUsar.pericias], ["fort"]);
conferir("e não soma nada de forma passiva",
  b1.automaticos.find((a) => a.id === "botica").changes, []);

// Bônus que não são de teste continuam passivos.
conferir("Clínica soma +3 PV sempre",
  b1.automaticos.find((a) => a.id === "clinica").changes, [{ key: "system.attributes.pv.bonus.total", mode: 2, value: "3" }]);
conferir("e não aparece na rolagem", b1.automaticos.find((a) => a.id === "clinica").naRolagem, false);

const b2 = Beneficios.beneficiosDe(negocioFalso(["altar", "circulo-de-poder"]), leigo);
conferir("quem não conjura não recebe os PM do Altar", b2.automaticos.length, 0);
conferir("e vê os dois ativos como bloqueados", b2.bloqueados.map((x) => x.id), ["altar", "circulo-de-poder"]);

const b3 = Beneficios.beneficiosDe(negocioFalso(["altar", "circulo-de-poder"]), todos);
conferir("conjurador dos dois tipos recebe os dois", b3.automaticos.length, 2);

const b4 = Beneficios.beneficiosDe(negocioFalso(["oficina"]), leigo);
conferir("Oficina é oferecida nos 6 ofícios", b4.automaticos[0].aoUsar.pericias.length, 6);

const b5 = Beneficios.beneficiosDe(negocioFalso([{ id: "propaganda", escolha: "enga" }]), leigo);
conferir("Propaganda respeita a perícia escolhida",
  [...b5.automaticos[0].aoUsar.pericias], ["enga"]);

const b6 = Beneficios.beneficiosDe(negocioFalso(["guilda-de-aventureiros"]), leigo);
conferir("Guilda sem marcos: só lembrete de XP", [b6.automaticos.length, b6.lembretes.length], [0, 1]);
game.settings.set("t20-negocios", "avancoPorMarcos", true);
const b7 = Beneficios.beneficiosDe(negocioFalso(["guilda-de-aventureiros"]), leigo);
conferir("Guilda com marcos: +2 PV e +2 PM por patamar",
  b7.automaticos[0].changes.map((c) => c.value), ["2*@patamar", "2*@patamar"]);
game.settings.set("t20-negocios", "avancoPorMarcos", false);

const b8 = Beneficios.beneficiosDe(negocioFalso(["arena", "fachada", "cassino"]), leigo);
// O Cassino entra nos dois lados de propósito: o +1 em Jogatina o módulo
// oferece na rolagem, mas a aposta por aventura continua sendo rolada à mão.
conferir("Arena e Cassino permanecem como lembretes",
  b8.lembretes.map((l) => l.id).sort(), ["arena", "cassino"]);
conferir("Fachada e Cassino são automatizados",
  b8.automaticos.map((a) => a.id).sort(), ["cassino", "fachada"]);

// Um efeito por ativo: o jogador vê de onde cada bônus vem, e pode desligar
// um sem perder os outros.
const efeitos = Beneficios.montarEfeitos(negocioFalso(["clinica", "logistica", "arena"]), leigo);
conferir("um efeito por ativo com bônus, e nada pela Arena", efeitos.length, 2);
conferir("cada efeito leva o nome do negócio e o do ativo",
  efeitos.map((e) => e.name).sort(),
  ["Taverna do Corvo: Clínica", "Taverna do Corvo: Logística"]);
conferir("cada um carrega só o próprio change",
  efeitos.every((e) => e.changes.length === 1), true);
conferir("e é marcado com o id do ativo",
  efeitos[0].flags["t20-negocios"].ativoId, "clinica");
conferir("a Clínica soma no caminho que o sistema lê",
  efeitos[0].changes[0].key, "system.attributes.pv.bonus.total");
conferir("e vem habilitada", efeitos[0].disabled, false);

conferir("ativo sem bônus não gera efeito",
  Beneficios.montarEfeitos(negocioFalso(["alojamentos"]), leigo).length, 0);

// Os de perícia geram efeito de rolagem, e nenhum passivo.
const daBotica = Beneficios.montarEfeitos(negocioFalso(["botica"]), leigo);
conferir("a Botica gera só o efeito de rolagem", daBotica.length, 1);
conferir("oferecido em Fortitude",
  [...daBotica[0].system.abilityUse.names], ["Fortitude"]);
conferir("e já marcado", daBotica[0].system.abilityUse.automatic, true);

// Os condicionais viram efeitos oferecidos na rolagem, já marcados.
// O Dojo vale em ataque desarmado, que no sistema é rolagem de ataque.
const comDojo = Beneficios.montarEfeitos(negocioFalso(["dojo"]), leigo);
conferir("o Dojo gera um efeito só", comDojo.length, 1);
conferir("oferecido na rolagem de ataque",
  [...comDojo[0].system.abilityUse.types], ["attack"]);
conferir("sem filtrar por arma", [...comDojo[0].system.abilityUse.names], []);
conferir("já marcado por padrão", comDojo[0].system.abilityUse.automatic, true);
conferir("e desligado fora da rolagem", comDojo[0].disabled, true);
conferir("com a chave de ataque", comDojo[0].system.changes[0].key, "ataque");

// Sem lista de nomes, o sistema oferece o efeito em toda rolagem daquele tipo.
const comIntegracao = Beneficios.montarEfeitos(negocioFalso(["integracao"]), leigo);
const emAtributos = comIntegracao.find((e) => e.system?.onuse);
conferir("Integração é oferecida em testes de atributo",
  [...(emAtributos?.system.abilityUse.types ?? [])], ["ability"]);
conferir("em todos eles, sem restringir por nome",
  [...(emAtributos?.system.abilityUse.names ?? [])], []);
conferir("somando 2", emAtributos?.system.changes[0].value, "2");

// O Ginásio soma dano, não acerto — chave diferente, mesmo caminho.
const comGinasio = Beneficios.montarEfeitos(negocioFalso(["ginasio"]), leigo);
conferir("Ginásio é oferecido na rolagem de ataque",
  [...comGinasio[0].system.abilityUse.types], ["attack"]);
conferir("somando no dano, não no acerto",
  comGinasio[0].system.changes, [{ key: "dano", value: "1", type: "add", priority: 0 }]);

// O Laboratório Alquímico soma um dado do mesmo tipo ao preparado.
const comLab = Beneficios.montarEfeitos(negocioFalso(["laboratorio-alquimico"]), leigo);
conferir("Laboratório é oferecido ao usar consumível",
  [...comLab[0].system.abilityUse.types], ["consumable"]);
conferir("somando um dado do mesmo tipo",
  comLab[0].system.changes, [{ key: "dano", value: "1d", type: "add", priority: 0 }]);

// O Jardim desconta PM pelo custo do próprio efeito.
const comJardim = Beneficios.montarEfeitos(negocioFalso(["jardim"]), leigo);
conferir("Jardim aparece nas três formas do poder",
  [...comJardim[0].system.abilityUse.names],
  ["Forma Selvagem", "Forma Selvagem Aprimorada", "Forma Selvagem Superior"]);
conferir("sem tipo, para o filtro ser só o nome",
  [...comJardim[0].system.abilityUse.types], []);
// O sistema soma o custo do efeito ao da habilidade: negativo é desconto.
conferir("descontando 1 PM", comJardim[0].system.abilityUse.custo, -1);

// Uma busca pode ser em qualquer perícia, mas a maioria das rolagens não é
// uma busca — este vem desmarcado.
const comPlano = Beneficios.montarEfeitos(negocioFalso(["plano-de-carreira"]), leigo);
conferir("Plano de Carreira é oferecido em toda perícia",
  [...comPlano[0].system.abilityUse.names], []);
conferir("do tipo perícia", [...comPlano[0].system.abilityUse.types], ["skill"]);
conferir("e desmarcado por padrão", comPlano[0].system.abilityUse.automatic, false);
conferir("somando 2", comPlano[0].system.changes[0].value, "2");

const comPatio = Beneficios.montarEfeitos(
  negocioFalso([{ id: "patio-de-treinamento", escolha: "Espada longa" }]), leigo);
const noAtaque = comPatio.find((e) => e.system?.onuse);
conferir("o Pátio se liga à arma escolhida",
  [...(noAtaque?.system.abilityUse.names ?? [])], ["Espada longa"]);
conferir("como bônus de ataque", noAtaque?.system.changes[0].key, "ataque");

console.log("\n— Formatação —");
conferir("tibares com separador", Chat.tibares(4000), "T$ 4.000");
conferir("tibares negativos", Chat.tibares(-45), "−T$ 45");

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTudo passou.\n");
process.exit(falhas ? 1 : 0);
