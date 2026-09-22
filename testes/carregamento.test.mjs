/*
 * Teste de fumaça do carregamento: `node testes/carregamento.test.mjs`.
 *
 * Importa o módulo inteiro num ambiente Foundry simulado e dispara o hook de
 * init. Existe por um motivo concreto: um `import` de um nome que o arquivo
 * alvo deixou de exportar é um erro de *link* em ESM — o módulo inteiro falha
 * ao carregar, em silêncio do ponto de vista do Foundry, e a única pista é a
 * ficha aparecer genérica. A checagem de sintaxe não pega isso; só carregar
 * de verdade pega.
 *
 * Fonte das regras: Jornada Heroica - Fim dos Tempos Arco 2: Valkaria.
 */

import fs from "node:fs";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const textos = JSON.parse(fs.readFileSync(`${RAIZ}/lang/pt-BR.json`, "utf8"));

/* -------------------------------------------- */
/*  Ambiente simulado                           */
/* -------------------------------------------- */

class DataFieldFalso {
  constructor(opcoes = {}) { Object.assign(this, opcoes); }
}
class SchemaFieldFalso extends DataFieldFalso {
  constructor(campos, opcoes) { super(opcoes); this.fields = campos; }
}
class ArrayFieldFalso extends DataFieldFalso {
  constructor(elemento, opcoes) { super(opcoes); this.element = elemento; }
}

const campos = {
  StringField: DataFieldFalso, NumberField: DataFieldFalso, BooleanField: DataFieldFalso,
  HTMLField: DataFieldFalso, DocumentIdField: DataFieldFalso, ObjectField: DataFieldFalso,
  SchemaField: SchemaFieldFalso, ArrayField: ArrayFieldFalso, TypedObjectField: ArrayFieldFalso
};

class ApplicationV2Falsa {
  constructor(opcoes = {}) { this.options = opcoes; }
  static DEFAULT_OPTIONS = {};
  static PARTS = {};
  render() { return this; }
  close() {}
  _onRender() {}
  async _prepareContext() { return {}; }
  async _preparePartContext(_p, ctx) { return ctx; }
  _prepareSubmitData() { return {}; }
  _configureRenderParts() { return { ...this.constructor.PARTS }; }
}
const MixinHandlebars = (Base) => class extends Base {};

const registros = { dataModels: {}, sheets: [], settings: [], hooksOnce: {}, hooksOn: {} };

globalThis.foundry = {
  abstract: { TypeDataModel: class { static defineSchema() { return {}; } static migrateData(d) { return d; } } },
  data: { fields: campos },
  applications: {
    api: {
      ApplicationV2: ApplicationV2Falsa,
      DocumentSheetV2: ApplicationV2Falsa,
      DialogV2: { wait: async () => null, confirm: async () => false },
      HandlebarsApplicationMixin: MixinHandlebars
    },
    sheets: { ActorSheetV2: ApplicationV2Falsa },
    apps: { DocumentSheetConfig: { registerSheet: (...a) => registros.sheets.push(a) } },
    handlebars: { renderTemplate: async () => "", loadTemplates: () => {} },
    instances: new Map()
  },
  utils: {
    debounce: (f) => f,
    escapeHTML: (s) => String(s),
    getProperty: (o, c) => c.split(".").reduce((a, k) => a?.[k], o),
    deepClone: (o) => structuredClone(o),
    mergeObject: (a, b) => Object.assign({}, a, b)
  }
};

globalThis.Hooks = {
  once: (nome, fn) => { (registros.hooksOnce[nome] ??= []).push(fn); },
  on: (nome, fn) => { (registros.hooksOn[nome] ??= []).push(fn); }
};

globalThis.CONFIG = { Actor: { dataModels: registros.dataModels, sheetClasses: {} }, T20: { pericias: {}, oficios: new Set() }, sounds: {} };
globalThis.Actor = class { static documentName = "Actor"; };
globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3, OBSERVER: 2, LIMITED: 1, NONE: 0 } };
globalThis.Handlebars = { registerHelper: () => {} };
globalThis.ui = { notifications: { info: () => {}, warn: () => {}, error: () => {} } };
globalThis.game = {
  version: "14.368",
  system: { id: "tormenta20", version: "1.6.2" },
  user: { isGM: true, id: "u1", can: () => true },
  users: [],
  actors: [],
  folders: new Map(),
  modules: new Map([["t20-negocios", { active: true, version: "0.1.0" }]]),
  socket: { on: () => {}, emit: () => {} },
  settings: {
    _v: {},
    register(mod, chave, def) { registros.settings.push(chave); this._v[`${mod}.${chave}`] = def.default; },
    get(mod, chave) { return this._v[`${mod}.${chave}`]; },
    set(mod, chave, v) { this._v[`${mod}.${chave}`] = v; }
  },
  i18n: {
    localize: (k) => textos[k] ?? k,
    format: (k, d = {}) => (textos[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => d[n] ?? `{${n}}`)
  }
};

/* -------------------------------------------- */
/*  Execução                                    */
/* -------------------------------------------- */

let falhas = 0;
const conferir = (nome, ok, detalhe = "") => {
  if (ok) console.log(`  ✓ ${nome}`);
  else { falhas++; console.log(`  ✗ ${nome}${detalhe ? `\n      ${detalhe}` : ""}`); }
};

console.log("\n— Carregamento —");
try {
  await import(`${RAIZ}/scripts/main.mjs`);
  conferir("o módulo carrega sem erro de import", true);
} catch (erro) {
  conferir("o módulo carrega sem erro de import", false, `${erro.name}: ${erro.message}`);
  console.log("\n1 FALHA\n");
  process.exit(1);
}

conferir("registra um hook de init", !!registros.hooksOnce.init?.length);

console.log("\n— Hook de init —");
try {
  for (const fn of registros.hooksOnce.init) fn();
  conferir("o init roda sem lançar", true);
} catch (erro) {
  conferir("o init roda sem lançar", false, `${erro.name}: ${erro.message}`);
}

conferir("registra o DataModel do subtipo", !!registros.dataModels["t20-negocios.negocio"],
  `dataModels tem: ${Object.keys(registros.dataModels).join(", ") || "(vazio)"}`);
conferir("registra a ficha", registros.sheets.length > 0);
conferir("registra as configurações do mundo",
  ["aplicarEfeitos", "avancoPorMarcos", "nivelMaximo", "pastaNegocios"]
    .every((c) => registros.settings.includes(c)),
  `registradas: ${registros.settings.join(", ")}`);

console.log("\n— Schema do negócio —");
try {
  const schema = registros.dataModels["t20-negocios.negocio"].defineSchema();
  const esperados = ["nivel", "ramo", "local", "proprietario", "cofre", "ativos",
                     "beneficiarios", "npcsRecrutados", "dividaCassino", "registro", "notas"];
  const faltando = esperados.filter((c) => !(c in schema));
  conferir("o schema define todos os campos", !faltando.length, `faltando: ${faltando.join(", ")}`);
} catch (erro) {
  conferir("o schema é construído", false, `${erro.name}: ${erro.message}`);
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTudo passou.\n");
process.exit(falhas ? 1 : 0);
