# Diário de Calorias

Aplicativo simples para registrar o que você come e os exercícios que faz, e ver o **saldo calórico do dia** (déficit ou superávit). Funciona no celular e no computador, abre pelo navegador, pode ser instalado na tela inicial e funciona sem internet.

**👉 Usar agora:** https://kennedy9616.github.io/diario-calorias-app/

**⬇️ Baixar:** [diario-calorias-app.zip](https://github.com/kennedy9616/diario-calorias-app/archive/refs/heads/main.zip)

---

## O que ele faz

- Busca de alimentos (arroz, feijão, frango, frutas…) com calorias, carboidratos e proteínas por 100 g.
- Cadastro de alimentos que não estão na lista: você informa os valores do rótulo e eles ficam salvos.
- Registro de exercícios (caminhada, academia, corrida, bicicleta, natação…) com intensidade e tempo.
- Cálculo do gasto diário: taxa metabólica basal (TMB) + rotina + exercícios.
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

Faça uma cópia de segurança de vez em quando. Se você limpar os dados do navegador ou desinstalar o app, os registros que estão só no navegador são apagados.

## Usar a versão baixada

1. Baixe o [arquivo .zip](https://github.com/kennedy9616/diario-calorias-app/archive/refs/heads/main.zip) e extraia.
2. Abra o arquivo `index.html` no navegador.

Assim o app funciona normalmente, mas **não dá para instalar nem usar sem internet**, porque o navegador só permite isso em páginas `https://`. Para instalar, use o link do GitHub Pages acima.

Para testar no computador com todos os recursos, rode um servidor local dentro da pasta, por exemplo:

```bash
python -m http.server 8000
```

e abra http://localhost:8000. No VS Code, a extensão **Live Server** também funciona.

## Estrutura do projeto

```
├── index.html             página (só HTML)
├── css/
│   └── style.css          estilos, tema claro e escuro
├── js/
│   ├── data.js            tabela de alimentos e de exercícios (METs)
│   ├── utils.js           formatação, datas e avisos
│   ├── state.js           estado do app e cálculos (TMB, gasto, totais)
│   ├── storage.js         salvar e carregar: navegador, arquivo e cópia de segurança
│   ├── render.js          desenha o resumo, as listas e o gráfico
│   ├── forms.js           formulários de alimentos, exercícios e dados pessoais
│   ├── install.js         instalação na tela inicial e service worker
│   └── app.js             inicialização
├── icons/                 ícones do app (Android, iPhone e navegador)
├── manifest.webmanifest   nome, cores e ícones do app instalado
└── sw.js                  service worker: guarda os arquivos para usar sem internet
```

Não há dependências nem etapa de build: é HTML, CSS e JavaScript puro. Os scripts são carregados em ordem pelo `index.html`.

**Ao adicionar ou renomear um arquivo**, inclua-o na lista `FILES` do `sw.js` e aumente a versão em `CACHE` (por exemplo, `diario-calorias-v3`), para que os celulares baixem a versão nova.

## Publicar no GitHub Pages

1. No repositório, abra **Settings › Pages**.
2. Em **Build and deployment › Source**, escolha **Deploy from a branch**.
3. Em **Branch**, escolha `main` e a pasta `/ (root)`, e clique em **Save**.
4. Em um ou dois minutos, o app fica disponível em `https://<seu-usuario>.github.io/diario-calorias-app/`.

## Fontes e aviso

- Taxa metabólica basal pela equação de **Mifflin-St Jeor**.
- Calorias dos alimentos aproximadas por 100 g, com base na **Tabela TACO (Unicamp)** e em rótulos médios.
- Gasto dos exercícios pelo **Compendium of Physical Activities** (METs), contando só o gasto *extra* além do basal.

Os valores são estimativas para acompanhamento pessoal. Metas e ajustes de dieta devem vir do seu médico ou nutricionista.
