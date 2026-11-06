/* ==========================================================
   Dados de referência: alimentos, exercícios e refeições
   ========================================================== */

// [nome, kcal/100g, carboidrato g/100g, proteína g/100g]
// Valores aproximados — Tabela TACO (Unicamp) e rótulos médios.
const FOODS = [
  ["Arroz branco cozido", 128, 28.1, 2.5], ["Arroz integral cozido", 124, 25.8, 2.6],
  ["Feijão carioca cozido", 76, 13.6, 4.8], ["Feijão preto cozido", 77, 14, 4.5], ["Feijoada", 117, 11.6, 8.7],
  ["Macarrão cozido", 158, 31, 5.8], ["Cuscuz de milho cozido", 113, 25.3, 2.2], ["Farinha de mandioca", 365, 89, 1.6],
  ["Farofa pronta", 406, 80, 2.1], ["Tapioca (massa pronta)", 240, 59, 0], ["Pão francês", 300, 58.6, 8],
  ["Pão de forma integral", 253, 49.9, 9.4], ["Pão de queijo", 363, 34.2, 5.1], ["Biscoito cream cracker", 432, 68.7, 10.1],
  ["Biscoito recheado", 472, 70.5, 6.4], ["Aveia em flocos", 394, 66.6, 13.9], ["Granola", 420, 68, 10],
  ["Batata inglesa cozida", 52, 11.9, 1.2], ["Batata frita", 267, 35.6, 5], ["Batata doce cozida", 77, 18.4, 0.6],
  ["Mandioca (macaxeira) cozida", 125, 30.1, 0.6], ["Inhame cozido", 97, 23.2, 2],
  ["Ovo cozido", 146, 0.6, 13.3], ["Ovo frito", 240, 1.2, 15.6], ["Peito de frango grelhado", 159, 0, 32],
  ["Coxa de frango assada", 215, 0, 28.5], ["Carne moída refogada", 212, 0, 26.7], ["Patinho grelhado", 219, 0, 35.9],
  ["Alcatra grelhada", 241, 0, 31.9], ["Picanha grelhada", 289, 0, 26.4], ["Carne de sol cozida", 265, 0, 30],
  ["Lombo de porco assado", 210, 0, 35.7], ["Linguiça frita", 280, 0, 20.5], ["Tilápia grelhada", 128, 0, 26],
  ["Peixe frito", 230, 5, 22], ["Sardinha em lata (óleo)", 285, 0, 15.9], ["Atum em lata (água)", 116, 0, 26],
  ["Peito de peru fatiado", 112, 2, 22], ["Presunto", 94, 2.1, 14.3], ["Queijo muçarela", 330, 3, 22.6],
  ["Queijo coalho", 326, 3, 26], ["Queijo minas frescal", 264, 3.2, 17.4], ["Requeijão", 257, 2.4, 9.6],
  ["Leite integral", 61, 4.6, 3], ["Leite desnatado", 35, 5, 3.4], ["Iogurte natural", 51, 1.9, 4.1],
  ["Whey protein (pó)", 400, 8, 80], ["Café sem açúcar", 9, 1.5, 0.7], ["Açúcar", 387, 99.5, 0.3], ["Mel", 309, 84, 0],
  ["Manteiga", 726, 0.1, 0.4], ["Margarina", 596, 0, 0], ["Azeite de oliva", 884, 0, 0], ["Óleo de soja", 884, 0, 0],
  ["Banana prata", 98, 26, 1.3], ["Maçã", 56, 15.2, 0.3], ["Mamão papaia", 40, 10.4, 0.5], ["Laranja", 37, 8.9, 1],
  ["Melancia", 33, 8.1, 0.9], ["Melão", 29, 7.5, 0.7], ["Abacate", 96, 6, 1.2], ["Manga", 51, 12.8, 0.9],
  ["Uva", 53, 13.6, 0.7], ["Abacaxi", 48, 12.3, 0.9], ["Açaí (polpa sem açúcar)", 58, 6.2, 0.8],
  ["Alface", 14, 2.4, 1.7], ["Tomate", 15, 3.1, 1.1], ["Cenoura crua", 34, 7.7, 1.3], ["Brócolis cozido", 25, 4.4, 2.1],
  ["Abobrinha cozida", 15, 3, 1.1], ["Chuchu cozido", 19, 4.8, 0.4], ["Pepino", 10, 2, 0.9], ["Abóbora cozida", 20, 4.8, 0.6],
  ["Castanha de caju", 570, 29.1, 18.5], ["Amendoim torrado", 606, 18.7, 22.5], ["Chocolate ao leite", 540, 59.6, 7.2],
  ["Refrigerante comum", 42, 10.6, 0], ["Refrigerante zero", 0, 0, 0], ["Suco de laranja natural", 33, 7.6, 0.7],
  ["Cerveja", 41, 3.3, 0.3], ["Pizza de muçarela", 280, 30, 12], ["Hambúrguer (sanduíche)", 260, 26, 14],
  ["Coxinha", 283, 34.5, 9.6], ["Pastel frito", 330, 32, 7]
];

// MET [leve, moderada, intensa] — Compendium of Physical Activities
const EXS = [
  { id: "caminhada", n: "Caminhada", m: [3.0, 4.3, 5.0], d: ["passo tranquilo, ~4 km/h", "passo firme, ~5,5 km/h", "passo acelerado, ~6,5 km/h"] },
  { id: "corrida", n: "Corrida / trote", m: [7.0, 9.0, 11.0], d: ["trote, ~7 km/h", "~9 km/h", "~11 km/h ou mais"] },
  { id: "academia", n: "Academia (musculação)", m: [3.5, 5.0, 6.0], d: ["cargas leves, descanso longo", "treino normal", "pesado, pouco descanso"] },
  { id: "funcional", n: "Funcional / HIIT", m: [4.3, 6.0, 8.0], d: ["circuito leve", "circuito moderado", "HIIT, muito ofegante"] },
  { id: "bike", n: "Bicicleta", m: [4.0, 6.8, 8.0], d: ["passeio, <16 km/h", "16–19 km/h", "19–22 km/h"] },
  { id: "bikeind", n: "Bicicleta ergométrica / spinning", m: [3.5, 6.8, 8.8], d: ["carga leve", "carga moderada", "spinning intenso"] },
  { id: "eliptico", n: "Elíptico (transport)", m: [4.0, 5.0, 6.5], d: ["leve", "moderado", "intenso"] },
  { id: "natacao", n: "Natação", m: [6.0, 8.3, 9.8], d: ["recreativa", "ritmo moderado", "ritmo forte"] },
  { id: "hidro", n: "Hidroginástica", m: [4.0, 5.3, 6.0], d: ["leve", "moderada", "intensa"] },
  { id: "futebol", n: "Futebol", m: [5.0, 7.0, 10.0], d: ["bate-bola", "pelada", "jogo competitivo"] },
  { id: "danca", n: "Dança", m: [4.5, 5.5, 7.8], d: ["leve", "moderada", "aeróbica intensa"] },
  { id: "corda", n: "Pular corda", m: [8.8, 11.8, 12.3], d: ["ritmo lento", "moderado", "rápido"] },
  { id: "escada", n: "Subir escadas", m: [4.0, 6.0, 8.8], d: ["devagar", "moderado", "rápido"] }
];

const MEALS = ["Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar", "Ceia"];
