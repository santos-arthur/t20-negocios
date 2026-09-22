/*
 * Confere que todo símbolo usado existe de fato: `node testes/simbolos.test.mjs`.
 *
 * Existe por um caso concreto. A checagem de `import { x }` não alcança o uso
 * por namespace — `import * as Beneficios` seguido de `Beneficios.foo()`. Uma
 * função chamada assim, mas nunca definida, passa por toda validação estática,
 * carrega sem erro e só estoura quando aquela linha roda no Foundry.
 */

import fs from "node:fs";
import path from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

function arquivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? arquivos(p) : p.endsWith(".mjs") ? [p] : [];
  });
}

/** Nomes que um módulo exporta. */
function exportados(fonte) {
  const nomes = new Set();
  for (const re of [
    /^export\s+(?:async\s+)?function\s+(\w+)/gm,
    /^export\s+(?:const|let|var)\s+(\w+)/gm,
    /^export\s+class\s+(\w+)/gm
  ]) {
    for (const m of fonte.matchAll(re)) nomes.add(m[1]);
  }
  for (const m of fonte.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const parte of m[1].split(",")) {
      const nome = parte.trim().split(/\s+as\s+/).pop()?.trim();
      if (nome) nomes.add(nome);
    }
  }
  return nomes;
}

const fontes = new Map(arquivos(`${RAIZ}/scripts`).map((f) => [f, fs.readFileSync(f, "utf8")]));
const exports_ = new Map([...fontes].map(([f, s]) => [f, exportados(s)]));

let falhas = 0;
const erro = (msg) => { falhas++; console.log(`  ✗ ${msg}`); };

console.log("\n— Imports nomeados —");
let nomeados = 0;
for (const [arquivo, fonte] of fontes) {
  for (const m of fonte.matchAll(/^import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/gm)) {
    const alvo = path.normalize(path.join(path.dirname(arquivo), m[2]));
    if (!exports_.has(alvo)) { erro(`${path.basename(arquivo)}: alvo inexistente ${m[2]}`); continue; }
    for (const parte of m[1].split(",")) {
      const nome = parte.trim().split(/\s+as\s+/)[0]?.trim();
      if (!nome) continue;
      nomeados++;
      if (!exports_.get(alvo).has(nome)) {
        erro(`${path.basename(arquivo)}: importa '${nome}' de ${m[2]}, que não exporta`);
      }
    }
  }
}
console.log(`  ✓ ${nomeados} imports nomeados conferidos`);

console.log("\n— Uso por namespace —");
let usos = 0;
for (const [arquivo, fonte] of fontes) {
  for (const m of fonte.matchAll(/^import\s*\*\s*as\s*(\w+)\s*from\s*"([^"]+)"/gm)) {
    const [, alias, caminho] = m;
    const alvo = path.normalize(path.join(path.dirname(arquivo), caminho));
    if (!exports_.has(alvo)) { erro(`${path.basename(arquivo)}: alvo inexistente ${caminho}`); continue; }
    for (const uso of fonte.matchAll(new RegExp(`\\b${alias}\\.(\\w+)`, "g"))) {
      usos++;
      if (!exports_.get(alvo).has(uso[1])) {
        erro(`${path.basename(arquivo)}: usa ${alias}.${uso[1]}, que ${path.basename(alvo)} não exporta`);
      }
    }
  }
}
console.log(`  ✓ ${usos} usos por namespace conferidos`);

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTudo passou.\n");
process.exit(falhas ? 1 : 0);
