# Changelog

Mudanças de cada versão. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões em [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado
- Testes de regressão automatizados (`tests/`, `node:test`), obrigatórios no CI e nos hooks de merge/push (`.githooks`).
- Barra de navegação inferior com 4 abas: Água, Calorias, Analytics e Histórico. A aba aberta fica no endereço (`#agua`...).
- Aba Histórico: taxa metabólica basal (Mifflin-St Jeor) com dados detalhados (data de nascimento, coeficiente da equação, condições especiais), registro de peso e medidas corporais, tendência de 7 dias, variação semanal com cobertura e gráfico de evolução.
- A TMB é recalculada automaticamente pela média de peso dos últimos 7 dias quando há pesagens em 3 ou mais desses dias (pesagem isolada não muda o cálculo). Cada dia guarda TMB e peso de referência da época.
- Aba Analytics: resumo do dia (consumo, diferença da meta, déficit estimado só em dia completo, proteína % da meta, carboidratos, gorduras, fibras, açúcares, colesterol e minerais), semana (calorias × meta do dia, regularidade, consumo médio dos dias completos, minutos equivalentes de atividade e dias de força) com visão em tabela.
- Metas versionadas de calorias (estimativa com déficit 0/10/15%, profissional ou manual) e proteína (EFSA 0,83 g/kg ou ISSN 1,4–2,0 g/kg com treino regular), com método, fonte, vigência e dados usados. Cada dia é comparado com a meta vigente naquele dia.
- Opção “Registrei tudo o que comi neste dia” (diário completo).
- Aba Água: registro em ml (botões rápidos e volume livre), água pura e outras bebidas separadas, soma do dia, copo com o nível em relação à meta, últimos 7 dias e meta versionada (hábito ajustável ou limite de profissional; só água pura ou todas as bebidas), com a referência EFSA de água total. Volume muito alto gera aviso neutro; sem prêmio por excesso.


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
