# Diário de Calorias

Aplicativo simples para registrar o que você come e os exercícios que faz, e ver o **saldo calórico do dia** (déficit ou superávit). Funciona no celular e no computador, abre pelo navegador, pode ser instalado na tela inicial e funciona sem internet.

**👉 Usar agora:** https://kennedy9616.github.io/diario-calorias-app/

**⬇️ Baixar:** [última versão (Releases)](https://github.com/kennedy9616/diario-calorias-app/releases/latest) · [.zip da versão publicada](https://github.com/kennedy9616/diario-calorias-app/archive/refs/heads/master.zip)

---

## O que ele faz

- Busca em mais de **13 mil alimentos** (Tabela TACO e USDA), com calorias e 11 nutrientes por 100 g. Buscar em português também encontra os alimentos do USDA, que estão em inglês ("frango" acha "chicken").
- Porções caseiras ("1 cup", "1 slice"…) nos alimentos que têm essa informação, e informação nutricional completa da quantidade escolhida.
- Cadastro de alimentos que não estão na lista: você informa os valores do rótulo e eles ficam salvos, no mesmo formato da base de alimentos.
- Registro de exercícios (caminhada, academia, corrida, bicicleta, natação…) com intensidade e tempo.
- Cálculo do gasto diário: taxa metabólica basal (TMB) + rotina + exercícios.
- Resumo do dia com carboidratos, proteínas, gorduras, fibras e sódio.
- Meta diária de consumo com barra de progresso.
- Gráfico do saldo dos últimos 7 dias.
- Tema claro e escuro automático, conforme o aparelho.

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
│   ├── utils.js               formatação, datas e avisos
│   ├── state.js               estado do app e cálculos (TMB, gasto, totais)
│   ├── foods.js               base de alimentos: carregamento, busca e alimentos cadastrados
│   ├── storage.js             salvar e carregar: navegador, arquivo e cópia de segurança
│   ├── render.js              desenha o resumo, as listas e o gráfico
│   ├── forms.js               formulários de alimentos, exercícios e dados pessoais
│   ├── install.js             instalação na tela inicial e service worker
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

## Contribuir

O projeto usa **Git Flow**: `master` é a produção, publicada no GitHub Pages, e `develop` é a integração. As funcionalidades entram por pull request a partir de branches `feature/*`. Veja o passo a passo em [CONTRIBUTING.md](CONTRIBUTING.md) e as mudanças de cada versão em [CHANGELOG.md](CHANGELOG.md).

## Fontes e aviso

- Taxa metabólica basal pela equação de **Mifflin-St Jeor**.
- Alimentos: **Tabela TACO**, 4ª edição (NEPA/Unicamp, 2011), normalizada por Fabio F. Brolesi ([brolesi/taco](https://github.com/brolesi/taco), MIT); **USDA FoodData Central**, SR Legacy (2018) e FNDDS 2021–2023 (domínio público, CC0); e rótulos médios na lista curta do app. Valores por 100 g, aproximados. Valor ausente na fonte aparece como "—" (sem dado), e não como zero.
- Gasto dos exercícios pelo **Compendium of Physical Activities** (METs), contando só o gasto *extra* além do basal.

Os valores são estimativas para acompanhamento pessoal. Metas e ajustes de dieta devem vir do seu médico ou nutricionista.
