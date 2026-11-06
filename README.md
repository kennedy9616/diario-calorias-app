# Diário de Calorias

Aplicativo para registrar o que você come, a água que bebe, os exercícios e o peso, e acompanhar metas e evolução. Tem quatro seções: **Água**, **Calorias**, **Analytics** e **Perfil**. Funciona no celular e no computador, abre pelo navegador, pode ser instalado na tela inicial e funciona sem internet.

**👉 Usar agora:** https://kennedy9616.github.io/diario-calorias-app/

**⬇️ Baixar:** [última versão (Releases)](https://github.com/kennedy9616/diario-calorias-app/releases/latest) · [.zip da versão publicada](https://github.com/kennedy9616/diario-calorias-app/archive/refs/heads/master.zip)

---

## O que ele faz

**Água**
- Copo configurável (150 a 500 ml ou volume próprio): cada toque registra o volume, com desfazer, edição e exclusão.
- Silhueta que enche conforme o progresso da meta do dia (não mede hidratação); o total real continua somando acima da meta.
- Meta estimada pela referência da EFSA ou meta personalizada, com histórico.

**Calorias**
- Busca em mais de **13 mil alimentos** (Tabela TACO e USDA), com nomes em português, calorias e 11 nutrientes por 100 g.
- Porções caseiras ("1 cup", "1 slice"…) nos alimentos que têm essa informação, e informação nutricional completa da quantidade escolhida.
- Cadastro de alimentos que não estão na lista: você informa os valores do rótulo e eles ficam salvos, no mesmo formato da base de alimentos.
- Registro de exercícios (caminhada, academia, corrida, bicicleta, natação…) com intensidade e tempo.
- Cálculo do gasto diário: taxa metabólica basal (TMB) + rotina + exercícios.
- Resumo do dia com carboidratos, proteínas, gorduras, fibras e sódio.
- Meta diária de consumo com barra de progresso; edição de alimentos e exercícios.
- Gráfico do saldo estimado dos últimos 7 dias (só dias marcados como completos).

**Analytics**
- Filtros de período (hoje, 7, 30, 90 dias ou personalizado) e comparação com o período anterior.
- Água, calorias e peso por dia, distribuição dos macronutrientes e indicadores com a cobertura dos registros. Dia sem registro não conta como zero.

**Perfil**
- Nome, idade, altura, sexo das equações, objetivo (perder, manter ou ganhar peso), rotina e copo padrão.
- Histórico de peso e medidas com edição; peso atual = pesagem mais recente.
- Taxa metabólica basal e metas de calorias, proteína e água, cada uma com vigência.

Tema escuro com detalhes em verde (claro automático, conforme o aparelho). Navegação inferior no celular e lateral no computador.

## Instalar no celular

O app abre no navegador, mas você pode colocar um ícone na tela inicial. Ele abre em tela cheia, como um aplicativo, e funciona sem internet.

### Android (Chrome, Edge ou Samsung Internet)

1. Abra https://kennedy9616.github.io/diario-calorias-app/
2. Toque em **Instalar** na faixa que aparece no topo da página.
   Se a faixa não aparecer, abra o menu do navegador (**⋮**) e toque em **Instalar app** ou **Adicionar à tela inicial**.

### iPhone e iPad (Safari)

1. Abra https://kennedy9616.github.io/diario-calorias-app/ no **Safari**.
2. Toque no botão **Compartilhar** (quadrado com seta para cima).
3. Toque em **Adicionar à Tela de Início** e depois em **Adicionar**.

> No iPhone, o app da tela inicial e o Safari guardam dados **separados**. Depois de instalar, use sempre pelo ícone.

### Computador (Chrome ou Edge)

Clique no ícone de instalar na barra de endereço, ou em **Instalar** na faixa do topo da página.

## Nomes dos alimentos

Os nomes do USDA foram traduzidos automaticamente para português brasileiro, com revisão de termos e por amostragem. Marcas, pratos e variedades podem manter sua denominação original. O JSON conserva `nome_original` e `idioma_original` para conferência; valores nutricionais, IDs, categorias e porções da fonte são preservados.

## Onde ficam os seus dados

Os dados ficam **só no seu aparelho**, dentro do navegador. Nada é enviado para servidor nenhum.

Pelo botão no canto superior direito (**Salvo no…**) você pode:

- **Baixar cópia de segurança**: baixa um arquivo `.json` com todos os registros. No iPhone, escolha **Salvar em Arquivos**.
- **Abrir arquivo de dados**: carrega uma cópia salva antes, por exemplo para passar os dados de um aparelho para outro. Nada é perdido: os registros são somados.
- **Criar arquivo de dados** (Chrome e Edge no computador): grava automaticamente num arquivo numa pasta sua a cada registro.
- **Exportar alimentos cadastrados**: baixa os alimentos que você cadastrou, no formato da base de alimentos, para incluí-los no app (veja [CONTRIBUTING.md](CONTRIBUTING.md#base-de-alimentos)).

Faça uma cópia de segurança de vez em quando. Se você limpar os dados do navegador ou desinstalar o app, os registros que estão só no navegador são apagados.

## Usar a versão baixada

1. Baixe o [arquivo .zip](https://github.com/kennedy9616/diario-calorias-app/archive/refs/heads/master.zip) e extraia.
2. Abra o arquivo `index.html` no navegador.

Assim o app funciona normalmente, mas **não dá para instalar nem usar sem internet**, porque o navegador só permite isso em páginas `https://`. Para instalar, use o link do GitHub Pages acima.

Para testar no computador com todos os recursos, rode um servidor local dentro da pasta, por exemplo:

```bash
python -m http.server 8000
```

e abra http://localhost:8000. No VS Code, a extensão **Live Server** também funciona.

## Estrutura do projeto

```
├── index.html                 página (só HTML)
├── css/
│   └── style.css              estilos, tema claro e escuro
├── js/
│   ├── data.js                lista curta de alimentos, exercícios (METs), nutrientes e traduções para a busca
│   ├── utils.js               formatação, datas, números com vírgula e avisos
│   ├── ui.js                  ícones, erros de campo e janela de edição
│   ├── state.js               estado do app e cálculos (TMB, gasto, totais, virada do dia)
│   ├── foods.js               base de alimentos: carregamento, busca e alimentos cadastrados
│   ├── storage.js             salvar e carregar: navegador, arquivo e cópia de segurança
│   ├── render.js              desenha o resumo, as listas e o gráfico de saldo
│   ├── forms.js               formulários de alimentos, exercícios e Perfil; edição de registros
│   ├── body.js                peso atual, medidas, tendência e TMB
│   ├── metas.js               metas versionadas (calorias e proteína) e histórico
│   ├── charts.js              gráficos SVG com valores por toque e teclado
│   ├── analytics.js           períodos, agregações e tela de Analytics
│   ├── water.js               água: copo, registros, desfazer, silhueta e meta
│   ├── install.js             instalação na tela inicial e service worker
│   ├── nav.js                 navegação entre as 4 seções (#agua, #calorias…)
│   └── app.js                 inicialização
├── data/
│   ├── alimentos_unificados.json   base de referência: TACO + USDA (13.822 itens, 15 MB)
│   ├── alimentos_usuario.json      alimentos cadastrados por usuários (mesmo formato)
│   └── alimentos-base.js           base compacta que o app carrega (gerada, ~2 MB)
├── tools/
│   ├── gerar-base.pl          gera data/alimentos-base.js
│   └── mesclar-alimentos.pl   inclui alimentos exportados pelo app em alimentos_usuario.json
├── icons/                     ícones do app (Android, iPhone e navegador)
├── manifest.webmanifest       nome, cores e ícones do app instalado
└── sw.js                      service worker: guarda os arquivos para usar sem internet
```

O app é HTML, CSS e JavaScript puro, sem dependências. Os scripts são carregados em ordem pelo `index.html`. A base de alimentos é carregada logo depois que a tela aparece.

As ferramentas em `tools/` usam Perl, que já vem com o Git no Windows e já existe no Linux e no macOS. Não é preciso instalar nada.

**Ao adicionar ou renomear um arquivo**, inclua-o na lista `FILES` do `sw.js` e aumente a versão em `CACHE`, para que os celulares baixem a versão nova.

**A cada versão**, troque a versão em `APP_VERSION` (`js/state.js`), em `data-versao` e em todas as `?v=` do `index.html`. Os testes conferem que são iguais. A versão no endereço impede que o navegador misture arquivos de publicações diferentes (o GitHub Pages manda guardar cada arquivo por 10 minutos).

## Contribuir

O projeto usa **Git Flow**: `master` é a produção, publicada no GitHub Pages, e `develop` é a integração. As funcionalidades entram por pull request a partir de branches `feature/*`. Veja o passo a passo em [CONTRIBUTING.md](CONTRIBUTING.md) e as mudanças de cada versão em [CHANGELOG.md](CHANGELOG.md).

## Fontes e aviso

- Taxa metabólica basal pela equação de **Mifflin-St Jeor**.
- Alimentos: **Tabela TACO**, 4ª edição (NEPA/Unicamp, 2011), normalizada por Fabio F. Brolesi ([brolesi/taco](https://github.com/brolesi/taco), MIT); **USDA FoodData Central**, SR Legacy (2018) e FNDDS 2021–2023 (domínio público, CC0); e rótulos médios na lista curta do app. Valores por 100 g, aproximados. Valor ausente na fonte aparece como "—" (sem dado), e não como zero.
- Gasto dos exercícios pelo **Compendium of Physical Activities** (METs), contando só o gasto *extra* além do basal.
- Meta de água estimada pela **EFSA** (2010, *Dietary Reference Values for water*): 2,0 L/dia de água total para mulheres e 2,5 L/dia para homens adultos, menos 20% que vêm dos alimentos.
- Energia dos macronutrientes pelos fatores gerais de **Atwater** (4, 4 e 9 kcal/g).

Os valores são estimativas para acompanhamento pessoal. Metas e ajustes de dieta devem vir do seu médico ou nutricionista.
