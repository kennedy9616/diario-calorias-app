# Changelog

Mudanças de cada versão. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões em [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

## [1.1.1] - 2026-11-06

### Corrigido
- Nomes dos 13.225 registros USDA localizados para português brasileiro, com revisão de termos alimentares e preservação das denominações originais no JSON.
- Base compacta regenerada e cache atualizado para apresentar os nomes em português no app.
- Validação garante que IDs, nutrientes, porções e os registros da TACO não foram alterados pela localização.

## [1.1.0] - 2026-11-05

### Adicionado
- Base completa com **13.815 alimentos**: Tabela TACO (591, em português) e USDA FoodData Central (13.224, em inglês).
- A busca em português também encontra os alimentos do USDA ("frango" acha "chicken"). Os resultados vêm ordenados por relevância e mostram um selo com a fonte.
- Porções caseiras (ex.: "1 cup", "1 slice") nos alimentos que têm essa informação.
- Informação nutricional completa do alimento escolhido: 12 nutrientes, calculados para a quantidade.
- Gorduras no resumo do dia, e também fibras e sódio.
- Alimento cadastrado pelo usuário é salvo na hora, no mesmo formato de `data/alimentos_unificados.json`. Agora o cadastro também aceita gorduras e valida os valores.
- Menu **Exportar alimentos cadastrados** e a ferramenta `tools/mesclar-alimentos.pl`, que leva esses alimentos para a base do app.
- Ferramenta `tools/gerar-base.pl`, que gera a base compacta do app (`data/alimentos-base.js`).
- CI no GitHub Actions; Git Flow documentado em `CONTRIBUTING.md`.

### Alterado
- Alimentos cadastrados na versão 1.0 são convertidos automaticamente para o formato novo, sem perder nada.

### Corrigido
- Busca ignora palavras de ligação e evita correspondências no meio de palavras em inglês.
- Identificadores de alimentos antigos consideram o nome e os valores nutricionais; alimentos da comunidade aparecem depois das fontes oficiais.
- Resumo diferencia nutrientes sem informação de valores iguais a zero; alimentos comuns vinculados à TACO recebem os nutrientes disponíveis.
- Exportações de alimentos podem ser importadas novamente sem substituir o arquivo de origem pelo diário completo.
- Recuperadas as correções da revisão anterior e acrescentadas verificações de regressão no CI.

## [1.0.0] - 2026-11-05

### Adicionado
- App separado em HTML, CSS e JavaScript.
- Instalação na tela inicial (Android, iPhone e computador) e uso sem internet.
- Ícone adaptável (maskable) para Android.
