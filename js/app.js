"use strict";

/* ==========================================================
   app.js - Lógica do CIVITTA (página de ocorrências)
   Seções: 1) log  2) validação  3) CRUD  4) eventos
   Modelo de cada item: { id, tipo, local, descricao, status, dataRegistro }
   ========================================================== */


/* ==========================================================
   1) REGISTRO DE ATIVIDADES (painel de log)
   ========================================================== */

/* ==========================================================
   log.js - Painel de registro de atividades
   Cada operação gera uma linha: data/hora - ação: resultado
   ========================================================== */

const MAXIMO_DE_REGISTROS = 50;

/**
 * Formata uma data no padrão brasileiro, ex.: 17/11/2026 08:30
 * @param {Date} data
 * @returns {string}
 */
function formatarDataHora(data = new Date()) {
  return data
    .toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    .replace(",", "");
}

/**
 * Cria o <li> de um registro do painel (usa textContent, nunca innerHTML).
 * @param {string} acao
 * @param {string} resultado
 * @param {boolean} sucesso
 * @returns {HTMLLIElement}
 */
function criarItemDeLog(acao, resultado, sucesso) {
  const item = document.createElement("li");
  item.dataset.resultado = sucesso ? "sucesso" : "erro";

  const hora = document.createElement("time");
  hora.dateTime = new Date().toISOString();
  hora.textContent = formatarDataHora();

  const rotuloAcao = document.createElement("strong");
  rotuloAcao.textContent = acao;

  const textoResultado = document.createElement("span");
  textoResultado.textContent = resultado;

  item.append(hora, " — ", rotuloAcao, ": ", textoResultado);
  return item;
}

/**
 * Adiciona um registro no topo do painel.
 * @param {string} acao      Ex.: "Adicionar"
 * @param {string} resultado Ex.: "ocorrência adicionada com sucesso"
 * @param {boolean} sucesso  false para operações que falharam
 */
function registrarLog(acao, resultado, sucesso = true) {
  try {
    const lista = document.getElementById("log-atividades");
    const aviso = document.getElementById("log-vazio");
    if (!lista) return;

    lista.prepend(criarItemDeLog(acao, resultado, sucesso));

    // Mantém o painel com tamanho controlado
    while (lista.children.length > MAXIMO_DE_REGISTROS) {
      lista.lastElementChild.remove();
    }
    if (aviso) aviso.hidden = true;
  } catch (erro) {
    // O log nunca pode quebrar a página
    console.error("Falha ao registrar atividade:", erro);
  }
}


/* ==========================================================
   2) VALIDAÇÃO E MENSAGENS NA TELA
   ========================================================== */

/* ==========================================================
   validacao.js - Validação das entradas e mensagens na tela
   Regra: nenhum dado do usuário é usado sem passar por aqui.
   ========================================================== */

const LIMITES = {
  local: { minimo: 3, maximo: 80 },
  descricao: { minimo: 10, maximo: 300 },
};

const TIPOS_VALIDOS = ["buraco", "iluminacao", "lixo", "praca", "outro"];
const STATUS_VALIDOS = ["aberta", "andamento", "resolvida"];

// Local: letras (com acento), números, espaços e pontuação simples
const PADRAO_LOCAL = /^[\p{L}\p{N}\s.,'\-ºª/]+$/u;
// Bloqueia os símbolos usados para injetar HTML
const PADRAO_SIMBOLOS_PERIGOSOS = /[<>]/;

/* ---------- Limpeza do texto ---------- */

/**
 * Remove espaços nas pontas e espaços repetidos.
 * @param {*} texto
 * @returns {string}
 */
function normalizarTexto(texto) {
  return String(texto ?? "").trim().replace(/\s+/g, " ");
}

/* ---------- Regras de cada campo (retornam "" se estiver válido) ---------- */

function validarTipo(valor) {
  if (!valor) return "Selecione o tipo de problema.";
  if (!TIPOS_VALIDOS.includes(valor)) return "Tipo de problema inválido.";
  return "";
}

function validarLocal(valor) {
  const { minimo, maximo } = LIMITES.local;
  if (!valor) return "Informe o local do problema.";
  if (valor.length < minimo) return `O local precisa ter pelo menos ${minimo} caracteres.`;
  if (valor.length > maximo) return `O local pode ter no máximo ${maximo} caracteres.`;
  if (!PADRAO_LOCAL.test(valor)) return "Use apenas letras, números e pontuação simples no local.";
  return "";
}

function validarDescricao(valor) {
  const { minimo, maximo } = LIMITES.descricao;
  if (!valor) return "Descreva o problema.";
  if (valor.length < minimo) return `A descrição precisa ter pelo menos ${minimo} caracteres.`;
  if (valor.length > maximo) return `A descrição pode ter no máximo ${maximo} caracteres.`;
  if (PADRAO_SIMBOLOS_PERIGOSOS.test(valor)) return "Não use os símbolos < e > na descrição.";
  return "";
}

function validarStatus(valor) {
  if (!valor) return "Selecione o status.";
  if (!STATUS_VALIDOS.includes(valor)) return "Status inválido.";
  return "";
}

/**
 * Valida todos os campos de uma ocorrência.
 * @param {{tipo: string, local: string, descricao: string, status: string}} dados
 * @returns {{valido: boolean, erros: Object<string, string>}}
 */
function validarOcorrencia(dados) {
  const resultados = {
    tipo: validarTipo(dados.tipo),
    local: validarLocal(dados.local),
    descricao: validarDescricao(dados.descricao),
    status: validarStatus(dados.status),
  };

  // Mantém só os campos que tiveram erro
  const erros = Object.fromEntries(
    Object.entries(resultados).filter(([, mensagem]) => mensagem !== "")
  );
  return { valido: Object.keys(erros).length === 0, erros };
}

/* ---------- Mensagens na tela ---------- */

/**
 * Mostra (ou limpa, se a mensagem for vazia) o erro de um campo.
 * @param {string} campo     id do campo: tipo, local, descricao ou status
 * @param {string} mensagem
 */
function mostrarErroCampo(campo, mensagem) {
  const entrada = document.getElementById(campo);
  const areaDeErro = document.getElementById(`erro-${campo}`);
  if (!entrada || !areaDeErro) return;

  areaDeErro.textContent = mensagem;
  entrada.classList.toggle("is-invalid", mensagem !== "");
  entrada.setAttribute("aria-invalid", mensagem !== "" ? "true" : "false");
}

function limparTodosErros() {
  ["tipo", "local", "descricao", "status"].forEach((campo) => mostrarErroCampo(campo, ""));
}

/**
 * Mostra a mensagem geral do formulário.
 * @param {string} texto
 * @param {"sucesso"|"erro"} tipo
 */
function mostrarMensagem(texto, tipo) {
  const area = document.getElementById("mensagem-formulario");
  if (!area) return;
  area.textContent = texto;
  area.className = `mensagem ${tipo}`;
}

function limparMensagem() {
  const area = document.getElementById("mensagem-formulario");
  if (!area) return;
  area.textContent = "";
  area.className = "mensagem";
}


/* ==========================================================
   3) DADOS E CRUD DAS OCORRÊNCIAS
   ========================================================== */

/* ==========================================================
   ocorrencias.js - Dados e operações (CRUD) das ocorrências
   Modelo de cada item:
   { id, tipo, local, descricao, status, dataRegistro }
   Os dados ficam em memória e também no localStorage, para
   sobreviver ao recarregamento da página.
   ========================================================== */

const CHAVE_ARMAZENAMENTO = "civitta:ocorrencias";
const MENSAGEM_ERRO_CARREGAR = "Não foi possível carregar os dados. Tente novamente.";
const MENSAGEM_ERRO_SALVAR = "Não foi possível salvar os dados. Tente novamente.";

const ROTULOS_TIPO = {
  buraco: "Buraco ou calçada danificada",
  iluminacao: "Iluminação queimada",
  lixo: "Lixo ou entulho acumulado",
  praca: "Praça ou parque danificado",
  outro: "Outro",
};

const ROTULOS_STATUS = {
  aberta: "Aberta",
  andamento: "Em andamento",
  resolvida: "Resolvida",
};

// Lista usada pela página (fonte única de verdade na tela)
let ocorrencias = [];

/* ---------- Armazenamento ---------- */

/**
 * Confere se um item lido do navegador tem o formato esperado.
 * Protege contra dados corrompidos ou alterados à mão.
 */
function ehOcorrenciaValida(item) {
  if (!item || typeof item !== "object") return false;
  if (typeof item.id !== "string" || item.id === "") return false;
  if (Number.isNaN(Date.parse(item.dataRegistro))) return false;
  return validarOcorrencia({
    tipo: item.tipo,
    local: normalizarTexto(item.local),
    descricao: normalizarTexto(item.descricao),
    status: item.status,
  }).valido;
}

/**
 * Lê as ocorrências guardadas no navegador.
 * @returns {Array} lista de ocorrências válidas (vazia se algo falhar)
 */
function carregarOcorrencias() {
  try {
    const bruto = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    if (!bruto) return [];

    const dados = JSON.parse(bruto);
    if (!Array.isArray(dados)) throw new Error("Formato inesperado dos dados");

    return dados.filter(ehOcorrenciaValida);
  } catch (erro) {
    console.error("Erro ao carregar ocorrências:", erro); // detalhe técnico só no console
    registrarLog("Carregar", "não foi possível carregar os dados", false);
    mostrarMensagem(MENSAGEM_ERRO_CARREGAR, "erro");
    return [];
  }
}

/**
 * Guarda a lista atual no navegador.
 * @returns {boolean} true se salvou
 */
function salvarOcorrencias() {
  try {
    localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(ocorrencias));
    return true;
  } catch (erro) {
    console.error("Erro ao salvar ocorrências:", erro);
    registrarLog("Salvar", "dados não foram guardados no navegador", false);
    mostrarMensagem(MENSAGEM_ERRO_SALVAR, "erro");
    return false;
  }
}

/* ---------- Utilidades ---------- */

function gerarId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buscarOcorrencia(id) {
  return ocorrencias.find((item) => item.id === id);
}

/* ---------- CRUD ---------- */

/**
 * ADICIONAR: cria uma ocorrência nova no topo da lista.
 * @param {{tipo, local, descricao, status}} dados já validados
 * @returns {boolean}
 */
function adicionarOcorrencia(dados) {
  try {
    const nova = {
      id: gerarId(),
      tipo: dados.tipo,
      local: dados.local,
      descricao: dados.descricao,
      status: dados.status,
      dataRegistro: new Date().toISOString(),
    };
    ocorrencias.unshift(nova);
    salvarOcorrencias();
    renderizarLista();
    registrarLog("Adicionar", "ocorrência adicionada com sucesso");
    return true;
  } catch (erro) {
    console.error("Erro ao adicionar:", erro);
    registrarLog("Adicionar", "não foi possível adicionar a ocorrência", false);
    return false;
  }
}

/**
 * EDITAR: atualiza os dados de uma ocorrência existente.
 * @param {string} id
 * @param {{tipo, local, descricao, status}} dados já validados
 * @returns {boolean}
 */
function editarOcorrencia(id, dados) {
  try {
    const item = buscarOcorrencia(id);
    if (!item) {
      registrarLog("Editar", "ocorrência não encontrada", false);
      return false;
    }
    item.tipo = dados.tipo;
    item.local = dados.local;
    item.descricao = dados.descricao;
    item.status = dados.status;

    salvarOcorrencias();
    renderizarLista();
    registrarLog("Editar", "ocorrência atualizada com sucesso");
    return true;
  } catch (erro) {
    console.error("Erro ao editar:", erro);
    registrarLog("Editar", "não foi possível atualizar a ocorrência", false);
    return false;
  }
}

/**
 * REMOVER: apaga uma ocorrência da lista.
 * @param {string} id
 * @returns {boolean}
 */
function removerOcorrencia(id) {
  try {
    const posicao = ocorrencias.findIndex((item) => item.id === id);
    if (posicao === -1) {
      registrarLog("Remover", "ocorrência não encontrada", false);
      return false;
    }
    ocorrencias.splice(posicao, 1);

    salvarOcorrencias();
    renderizarLista();
    registrarLog("Remover", "ocorrência removida com sucesso");
    return true;
  } catch (erro) {
    console.error("Erro ao remover:", erro);
    registrarLog("Remover", "não foi possível remover a ocorrência", false);
    return false;
  }
}

/* ---------- LISTAR (atualiza a página pelo DOM) ---------- */

/**
 * Cria o card de uma ocorrência a partir do <template> do HTML.
 * Todo texto entra por textContent, nunca por innerHTML.
 * @returns {DocumentFragment}
 */
function criarElementoOcorrencia(ocorrencia) {
  const modelo = document.getElementById("modelo-ocorrencia");
  const copia = modelo.content.cloneNode(true);

  const artigo = copia.querySelector(".ocorrencia");
  artigo.dataset.id = ocorrencia.id;
  artigo.dataset.status = ocorrencia.status;

  copia.querySelector(".ocorrencia-tipo").textContent = ROTULOS_TIPO[ocorrencia.tipo];
  copia.querySelector(".ocorrencia-local").textContent = ocorrencia.local;
  copia.querySelector(".ocorrencia-status").textContent = ROTULOS_STATUS[ocorrencia.status];
  copia.querySelector(".ocorrencia-descricao").textContent = ocorrencia.descricao;

  const data = copia.querySelector(".ocorrencia-data");
  data.dateTime = ocorrencia.dataRegistro;
  data.textContent = formatarDataHora(new Date(ocorrencia.dataRegistro));

  return copia;
}

/** Redesenha a lista inteira e mostra/esconde o aviso de lista vazia. */
function renderizarLista() {
  const lista = document.getElementById("lista-ocorrencias");
  const aviso = document.getElementById("mensagem-vazia");
  if (!lista) return;

  lista.replaceChildren(...ocorrencias.map(criarElementoOcorrencia));
  if (aviso) aviso.hidden = ocorrencias.length > 0;
}

/** Carrega os dados guardados e desenha a lista (chamada ao abrir a página). */
function iniciarOcorrencias() {
  ocorrencias = carregarOcorrencias();
  renderizarLista();
  registrarLog("Carregar", `${ocorrencias.length} ocorrência(s) carregada(s)`);
}


/* ==========================================================
   4) EVENTOS DA PÁGINA E INICIALIZAÇÃO
   ========================================================== */


const CAMPOS_DO_FORMULARIO = ["tipo", "local", "descricao", "status"];

function lerFormulario() {
  return {
    tipo: document.getElementById("tipo").value,
    local: normalizarTexto(document.getElementById("local").value),
    descricao: normalizarTexto(document.getElementById("descricao").value),
    status: document.getElementById("status").value,
  };
}

function exibirErros(erros) {
  CAMPOS_DO_FORMULARIO.forEach((campo) => mostrarErroCampo(campo, erros[campo] ?? ""));

  const primeiroComErro = CAMPOS_DO_FORMULARIO.find((campo) => erros[campo]);
  if (primeiroComErro) document.getElementById(primeiroComErro).focus();
}


function entrarNoModoEdicao(ocorrencia) {
  document.getElementById("ocorrencia-id").value = ocorrencia.id;
  document.getElementById("tipo").value = ocorrencia.tipo;
  document.getElementById("local").value = ocorrencia.local;
  document.getElementById("descricao").value = ocorrencia.descricao;
  document.getElementById("status").value = ocorrencia.status;

  document.getElementById("titulo-formulario").textContent = "Editar ocorrência";
  document.getElementById("botao-salvar").textContent = "Salvar alterações";
  document.getElementById("botao-cancelar").hidden = false;

  limparTodosErros();
  limparMensagem();
  document.getElementById("form-ocorrencia").scrollIntoView({ block: "start" });
  document.getElementById("tipo").focus();
}

function sairDoModoEdicao() {
  document.getElementById("form-ocorrencia").reset();
  document.getElementById("ocorrencia-id").value = "";

  document.getElementById("titulo-formulario").textContent = "Relatar uma ocorrência";
  document.getElementById("botao-salvar").textContent = "Salvar ocorrência";
  document.getElementById("botao-cancelar").hidden = true;

  limparTodosErros();
}


function tratarEnvio(evento) {
  evento.preventDefault();

  try {
    limparTodosErros();
    limparMensagem();

    const dados = lerFormulario();
    const { valido, erros } = validarOcorrencia(dados);

    if (!valido) {
      exibirErros(erros);
      mostrarMensagem("Corrija os campos destacados e tente novamente.", "erro");
      registrarLog("Validar", "dados inválidos, nada foi salvo", false);
      return;
    }

    const idEmEdicao = document.getElementById("ocorrencia-id").value;
    const deuCerto = idEmEdicao
      ? editarOcorrencia(idEmEdicao, dados)
      : adicionarOcorrencia(dados);

    if (!deuCerto) {
      mostrarMensagem("Não foi possível concluir a ação. Tente novamente.", "erro");
      return;
    }

    sairDoModoEdicao();
    mostrarMensagem(
      idEmEdicao ? "Ocorrência atualizada com sucesso." : "Ocorrência adicionada com sucesso.",
      "sucesso"
    );
  } catch (erro) {
    console.error("Erro ao tratar o envio:", erro);
    registrarLog("Salvar", "erro inesperado", false);
    mostrarMensagem("Não foi possível salvar a ocorrência. Tente novamente.", "erro");
  }
}

function tratarDigitacao(evento) {
  if (CAMPOS_DO_FORMULARIO.includes(evento.target.id)) {
    mostrarErroCampo(evento.target.id, "");
  }
}

function tratarCancelamento() {
  sairDoModoEdicao();
  limparMensagem();
}

function tratarCliqueNaLista(evento) {
  const botao = evento.target.closest("button");
  const cartao = evento.target.closest(".ocorrencia");
  if (!botao || !cartao) return;

  const id = cartao.dataset.id;

  if (botao.classList.contains("botao-editar")) {
    const ocorrencia = buscarOcorrencia(id);
    if (ocorrencia) entrarNoModoEdicao(ocorrencia);
    return;
  }

  if (botao.classList.contains("botao-remover")) {
    if (!window.confirm("Remover esta ocorrência?")) return;

    const removeuEmEdicao = document.getElementById("ocorrencia-id").value === id;
    const deuCerto = removerOcorrencia(id);

    if (deuCerto && removeuEmEdicao) sairDoModoEdicao();
    mostrarMensagem(
      deuCerto ? "Ocorrência removida com sucesso." : "Não foi possível remover a ocorrência. Tente novamente.",
      deuCerto ? "sucesso" : "erro"
    );
  }
}

function iniciarPagina() {
  const formulario = document.getElementById("form-ocorrencia");
  if (!formulario) return;

  formulario.addEventListener("submit", tratarEnvio);
  formulario.addEventListener("input", tratarDigitacao);
  document.getElementById("botao-cancelar").addEventListener("click", tratarCancelamento);
  document.getElementById("lista-ocorrencias").addEventListener("click", tratarCliqueNaLista);

  iniciarOcorrencias();
}

document.addEventListener("DOMContentLoaded", iniciarPagina);