/* ==========================================================
   Dados de referência: alimentos, exercícios e refeições
   ========================================================== */

// [nome, kcal/100g, carboidrato g/100g, proteína g/100g, id na base (opcional)]
// Valores da Tabela TACO (Unicamp) e de rótulos médios. Quando há id da TACO, o app usa
// os 12 nutrientes desse item assim que a base completa carrega (nome simples, dados completos).
const FOODS = [
  ["Arroz branco cozido", 128, 28.1, 2.5, "taco:3"], ["Arroz integral cozido", 124, 25.8, 2.6, "taco:1"],
  ["Feijão carioca cozido", 76, 13.6, 4.8, "taco:561"], ["Feijão preto cozido", 77, 14, 4.5, "taco:567"], ["Feijoada", 117, 11.6, 8.7, "taco:540"],
  ["Macarrão cozido", 158, 31, 5.8], ["Cuscuz de milho cozido", 113, 25.3, 2.2, "taco:533"], ["Farinha de mandioca", 365, 89, 1.6, "taco:122"],
  ["Farofa pronta", 406, 80, 2.1, "taco:131"], ["Tapioca (massa pronta)", 240, 59, 0], ["Pão francês", 300, 58.6, 8, "taco:53"],
  ["Pão de forma integral", 253, 49.9, 9.4, "taco:52"], ["Pão de queijo", 363, 34.2, 5.1, "taco:140"], ["Biscoito cream cracker", 432, 68.7, 10.1, "taco:13"],
  ["Biscoito recheado", 472, 70.5, 6.4, "taco:9"], ["Aveia em flocos", 394, 66.6, 13.9, "taco:7"], ["Granola", 420, 68, 10],
  ["Batata inglesa cozida", 52, 11.9, 1.2, "taco:91"], ["Batata frita", 267, 35.6, 5, "taco:93"], ["Batata doce cozida", 77, 18.4, 0.6, "taco:88"],
  ["Mandioca (macaxeira) cozida", 125, 30.1, 0.6, "taco:129"], ["Inhame cozido", 97, 23.2, 2],
  ["Ovo cozido", 146, 0.6, 13.3, "taco:488"], ["Ovo frito", 240, 1.2, 15.6, "taco:490"], ["Peito de frango grelhado", 159, 0, 32, "taco:410"],
  ["Coxa de frango assada", 215, 0, 28.5, "taco:396"], ["Carne moída refogada", 212, 0, 26.7, "taco:326"], ["Patinho grelhado", 219, 0, 35.9, "taco:377"],
  ["Alcatra grelhada", 241, 0, 31.9, "taco:370"], ["Picanha grelhada", 289, 0, 26.4, "taco:381"], ["Carne de sol cozida", 265, 0, 30],
  ["Lombo de porco assado", 210, 0, 35.7, "taco:432"], ["Linguiça frita", 280, 0, 20.5, "taco:422"], ["Tilápia grelhada", 128, 0, 26],
  ["Peixe frito", 230, 5, 22], ["Sardinha em lata (óleo)", 285, 0, 15.9, "taco:319"], ["Atum em lata (água)", 116, 0, 26],
  ["Peito de peru fatiado", 112, 2, 22], ["Presunto", 94, 2.1, 14.3, "taco:439"], ["Queijo muçarela", 330, 3, 22.6, "taco:463"],
  ["Queijo coalho", 326, 3, 26], ["Queijo minas frescal", 264, 3.2, 17.4, "taco:461"], ["Requeijão", 257, 2.4, 9.6, "taco:468"],
  ["Leite integral", 61, 4.6, 3], ["Leite desnatado", 35, 5, 3.4], ["Iogurte natural", 51, 1.9, 4.1, "taco:448"],
  ["Whey protein (pó)", 400, 8, 80], ["Café sem açúcar", 9, 1.5, 0.7, "taco:471"], ["Açúcar", 387, 99.5, 0.3, "taco:492"], ["Mel", 309, 84, 0, "taco:507"],
  ["Manteiga", 726, 0.1, 0.4, "taco:261"], ["Margarina", 596, 0, 0, "taco:263"], ["Azeite de oliva", 884, 0, 0, "taco:260"], ["Óleo de soja", 884, 0, 0, "taco:272"],
  ["Banana prata", 98, 26, 1.3, "taco:182"], ["Maçã", 56, 15.2, 0.3, "taco:222"], ["Mamão papaia", 40, 10.4, 0.5, "taco:226"], ["Laranja", 37, 8.9, 1, "taco:214"],
  ["Melancia", 33, 8.1, 0.9, "taco:235"], ["Melão", 29, 7.5, 0.7, "taco:236"], ["Abacate", 96, 6, 1.2, "taco:163"], ["Manga", 51, 12.8, 0.9, "taco:231"],
  ["Uva", 53, 13.6, 0.7, "taco:256"], ["Abacaxi", 48, 12.3, 0.9, "taco:164"], ["Açaí (polpa sem açúcar)", 58, 6.2, 0.8, "taco:168"],
  ["Alface", 14, 2.4, 1.7, "taco:79"], ["Tomate", 15, 3.1, 1.1, "taco:157"], ["Cenoura crua", 34, 7.7, 1.3, "taco:110"], ["Brócolis cozido", 25, 4.4, 2.1, "taco:100"],
  ["Abobrinha cozida", 15, 3, 1.1, "taco:70"], ["Chuchu cozido", 19, 4.8, 0.4, "taco:112"], ["Pepino", 10, 2, 0.9, "taco:142"], ["Abóbora cozida", 20, 4.8, 0.6],
  ["Castanha de caju", 570, 29.1, 18.5, "taco:588"], ["Amendoim torrado", 606, 18.7, 22.5, "taco:558"], ["Chocolate ao leite", 540, 59.6, 7.2, "taco:495"],
  ["Refrigerante comum", 42, 10.6, 0], ["Refrigerante zero", 0, 0, 0], ["Suco de laranja natural", 33, 7.6, 0.7, "taco:215"],
  ["Cerveja", 41, 3.3, 0.3, "taco:474"], ["Pizza de muçarela", 280, 30, 12], ["Hambúrguer (sanduíche)", 260, 26, 14],
  ["Coxinha", 283, 34.5, 9.6, "taco:386"], ["Pastel frito", 330, 32, 7]
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

// Nutrientes por 100 g, na mesma ordem de data/alimentos-base.js (tools/gerar-base.pl).
// k = nome do campo no schema de data/alimentos_unificados.json
const NUTRIENTES = [
  { k: "calorias_kcal", n: "Calorias", u: "kcal" },
  { k: "carboidratos_g", n: "Carboidratos", u: "g" },
  { k: "proteinas_g", n: "Proteínas", u: "g" },
  { k: "gorduras_totais_g", n: "Gorduras totais", u: "g" },
  { k: "fibras_g", n: "Fibras", u: "g" },
  { k: "sodio_mg", n: "Sódio", u: "mg" },
  { k: "acucares_totais_g", n: "Açúcares", u: "g" },
  { k: "gorduras_saturadas_g", n: "Gorduras saturadas", u: "g" },
  { k: "colesterol_mg", n: "Colesterol", u: "mg" },
  { k: "calcio_mg", n: "Cálcio", u: "mg" },
  { k: "ferro_mg", n: "Ferro", u: "mg" },
  { k: "potassio_mg", n: "Potássio", u: "mg" }
];
// posição de cada nutriente no array (NUT.kcal = 0, NUT.carb = 1, ...)
const NUT = { kcal: 0, carb: 1, prot: 2, gord: 3, fibra: 4, sodio: 5 };

// A base do USDA está em inglês. Buscar em português também procura estas traduções
// (ex.: "frango" encontra "Chicken, breast..."). Chaves sem acento. A tradução precisa
// casar com uma palavra inteira do nome (aceita plural com s/es): "oil" não acha "boiled".
// palavras de ligação ignoradas na busca quando há outras palavras ("arroz com feijão")
const PALAVRAS_LIGACAO = ["a", "o", "as", "os", "de", "da", "do", "das", "dos", "com", "e", "em", "na", "no", "nas", "nos", "ao", "aos", "para", "por", "um", "uma"];

const SINONIMOS = {
  abacate: ["avocado"], abacaxi: ["pineapple"], abobora: ["pumpkin", "squash"], abobrinha: ["zucchini"],
  acucar: ["sugar"], agua: ["water"], alface: ["lettuce"], alho: ["garlic"], amendoa: ["almond"],
  amendoim: ["peanut"], arroz: ["rice"], assado: ["roasted", "baked"], atum: ["tuna"], aveia: ["oat"],
  azeite: ["olive oil"], azeitona: ["olive"], bacalhau: ["cod"], batata: ["potato"], berinjela: ["eggplant"],
  biscoito: ["cookie", "cracker", "biscuit"], bolacha: ["cookie", "cracker"], bolo: ["cake"], bovina: ["beef"],
  brocolis: ["broccoli"], cafe: ["coffee"], camarao: ["shrimp"], caranguejo: ["crab"], carne: ["beef", "meat"],
  carneiro: ["lamb", "mutton"], castanha: ["nut", "cashew"], cebola: ["onion"], cenoura: ["carrot"],
  cereja: ["cherry", "cherries"], cerveja: ["beer"], cha: ["tea"], chocolate: ["chocolate"], coco: ["coconut"],
  cogumelo: ["mushroom"], cordeiro: ["lamb"], couve: ["kale", "collard"],
  cozido: ["cooked", "boiled"], creme: ["cream"], cru: ["raw"], crua: ["raw"], desnatado: ["skim", "nonfat"],
  doce: ["sweet", "candy"], ervilha: ["pea"], espinafre: ["spinach"], farinha: ["flour"], feijao: ["bean"],
  figado: ["liver"], frango: ["chicken"], frito: ["fried"], frita: ["fried"], galinha: ["chicken"],
  geleia: ["jam", "jelly"], gelatina: ["gelatin"], grao: ["chickpea"], grelhado: ["grilled", "broiled"],
  hamburguer: ["hamburger", "burger"], inhame: ["yam", "taro"], integral: ["whole"], iogurte: ["yogurt"],
  lagosta: ["lobster"], laranja: ["orange"], leite: ["milk"], lentilha: ["lentil"], limao: ["lemon", "lime"],
  linguica: ["sausage"], lula: ["squid"], maca: ["apple"], macarrao: ["pasta", "macaroni", "spaghetti", "noodle"],
  maionese: ["mayonnaise"], mamao: ["papaya"], mandioca: ["cassava"], manga: ["mango"], manteiga: ["butter"],
  margarina: ["margarine"], mel: ["honey"], melancia: ["watermelon"], melao: ["melon"], milho: ["corn"],
  molho: ["sauce", "gravy"], morango: ["strawberry", "strawberries"], mostarda: ["mustard"], mucarela: ["mozzarella"],
  mussarela: ["mozzarella"], nata: ["cream"], noz: ["walnut"], oleo: ["oil"], ovo: ["egg"], pao: ["bread"],
  panqueca: ["pancake"], parmesao: ["parmesan"], pato: ["duck"], peito: ["breast"], peixe: ["fish"],
  pepino: ["cucumber"], pera: ["pear"], peru: ["turkey"], pessego: ["peach"], pimentao: ["pepper"],
  pipoca: ["popcorn"], polvo: ["octopus"], porco: ["pork"], presunto: ["ham"], pudim: ["pudding"],
  queijo: ["cheese"], refrigerante: ["soda", "cola", "soft drink"], repolho: ["cabbage"], requeijao: ["cream cheese"],
  sal: ["salt"], salada: ["salad"], salmao: ["salmon"], salsicha: ["sausage", "frankfurter"],
  sanduiche: ["sandwich"], sardinha: ["sardine"], soja: ["soy"], sopa: ["soup"], sorvete: ["ice cream"],
  suco: ["juice"], suina: ["pork"], tomate: ["tomato"], torrada: ["toast"], torta: ["pie"], trigo: ["wheat"],
  uva: ["grape"], vinagre: ["vinegar"], vinho: ["wine"]
};

// Medidas corporais do histórico (faixas aceitas, para barrar erro de digitação)
const MEDIDAS_CAMPOS = [
  { k: "peso_kg", n: "Peso", u: "kg", min: 20, max: 400, id: "mPeso" },
  { k: "cintura_cm", n: "Cintura", u: "cm", min: 30, max: 300, id: "mCintura" },
  { k: "quadril_cm", n: "Quadril", u: "cm", min: 30, max: 300, id: "mQuadril" },
  { k: "braco_cm", n: "Braço", u: "cm", min: 10, max: 100, id: "mBraco" },
  { k: "coxa_cm", n: "Coxa", u: "cm", min: 20, max: 150, id: "mCoxa" },
  { k: "gordura_pct", n: "Gordura corporal", u: "%", min: 2, max: 75, id: "mGordura" }
];

// Condições em que o app não sugere metas automáticas (fluxo individualizado)
const CONDICOES = [
  { k: "gestante", id: "condGestante", n: "Gestante" },
  { k: "lactante", id: "condLactante", n: "Amamentando" },
  { k: "ta", id: "condTA", n: "Transtorno alimentar (atual ou passado)" },
  { k: "renal", id: "condRenal", n: "Doença renal" },
  { k: "liquidos", id: "condLiquidos", n: "Restrição de líquidos" }
];
