/**
 * As fórmulas das regras de Negócios.
 *
 * Tudo aqui é função pura: recebe o estado do negócio, devolve números.
 * Assim as regras ficam testáveis e num lugar só — quando uma errata mudar
 * um custo, é este arquivo que muda.
 *
 * Fonte das regras: Jornada Heroica - Fim dos Tempos Arco 2: Valkaria.
 */

/**
 * Quanto vale um tibar de ouro em tibares.
 *
 * O capítulo usa duas unidades. O rendimento comum e os investimentos são
 * contados em T$; o Empório e o Cassino, em TO. Essa troca de unidade é o que
 * dá sentido ao Empório: ele não repete a fórmula do rendimento comum, ele a
 * converte para uma moeda dez vezes maior — e é por isso que custa uma vaga de
 * ativo e exige o Bazar.
 */
export const TO_EM_TIBARES = 10;

/** CD do teste de Ofício ou Nobreza para fundar um negócio. */
export const CD_CRIACAO = 20;

/** Custo em tibares para fundar um negócio (ou para cada nova tentativa). */
export const CUSTO_CRIACAO = 1000;

/** Meses de trabalho exigidos tanto para fundar quanto para expandir. */
export const MESES_DE_TRABALHO = 1;

/**
 * CD para expandir o negócio até `proximoNivel`.
 * O ativo Estúdio reduz essa CD em 5.
 */
export function cdExpansao(proximoNivel, { estudio = false } = {}) {
  const base = 20 + 2 * proximoNivel;
  return estudio ? base - 5 : base;
}

/**
 * Custo em tibares para expandir o negócio até `proximoNivel`.
 * O ativo Escritório reduz esse custo à metade.
 */
export function custoExpansao(proximoNivel, { escritorio = false } = {}) {
  const base = 1000 * proximoNivel;
  return escritorio ? Math.floor(base / 2) : base;
}

/** Quantidade de ativos que um negócio de determinado nível comporta. */
export function slotsDeAtivos(nivel) {
  return Math.max(0, nivel);
}

/**
 * Rendimento automático por aventura (ou mês), sem dedicação do proprietário:
 * T$ 100 x o nível. Com o Empório a conta passa a ser em TO, dez vezes maior.
 */
export function rendimentoBase(nivel, { emporio = false } = {}) {
  const base = 100 * nivel;
  return emporio ? base * TO_EM_TIBARES : base;
}

/**
 * Rendimento de um mês inteiro dedicado ao negócio: o proprietário faz um
 * teste de Ofício ou Nobreza e o resultado multiplica o nível. O Empório
 * também converte este valor para TO.
 */
export function rendimentoDedicado(resultadoDoTeste, nivel, { emporio = false } = {}) {
  return resultadoDoTeste * fatorDedicado({ emporio }) * nivel;
}

/**
 * O que um mês dedicado pode render, do pior ao melhor resultado possível do
 * teste — `1d20 + bônus`, e não uma estimativa arbitrária.
 */
export function faixaDedicada(bonus, nivel, { emporio = false } = {}) {
  return {
    minimo: rendimentoDedicado(1 + bonus, nivel, { emporio }),
    maximo: rendimentoDedicado(20 + bonus, nivel, { emporio })
  };
}

/**
 * O que multiplica o resultado do teste no rendimento dedicado. Serve para
 * mostrar a fórmula na interface com o mesmo número que a conta usa.
 */
export function fatorDedicado({ emporio = false } = {}) {
  return emporio ? 10 * TO_EM_TIBARES : 10;
}

/**
 * Prêmio do ativo Cassino, contado em TO: em resultado par o negócio ganha
 * 10 x nível²; em ímpar perde metade dessa quantia.
 */
export function premioCassino(nivel, resultadoDoDado) {
  const aposta = 10 * nivel * nivel * TO_EM_TIBARES;
  const par = resultadoDoDado % 2 === 0;
  return { par, valor: par ? aposta : -Math.floor(aposta / 2) };
}

/**
 * Ganho do ativo Mercado Multinivelado. Cada NPC com nome recrutado sobe o
 * multiplicador em um degrau, até o limite do próprio nível do negócio.
 */
export function ganhoMercadoMultinivelado(nivel, npcsRecrutados) {
  const multiplicador = Math.min(Math.max(npcsRecrutados, 0), nivel);
  return nivel * 100 * multiplicador;
}

/**
 * O negócio ainda pode crescer? O teto é da mesa: as regras falam em 7, mas
 * quem administra o mundo decide.
 */
export function podeExpandir(nivel, maximo) {
  return nivel < maximo;
}

/**
 * Descreve o porte do negócio conforme a faixa de nível — usado como legenda
 * na interface, não como regra mecânica. As faixas acompanham o teto da mesa,
 * para que continuem fazendo sentido se ele mudar.
 */
export function porte(nivel, maximo = 7) {
  if (nivel <= Math.round(maximo * 2 / 7)) return "T20NEG.PortePequeno";
  if (nivel <= Math.round(maximo * 5 / 7)) return "T20NEG.PorteMedio";
  return "T20NEG.PorteGrande";
}
