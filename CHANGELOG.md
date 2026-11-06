# Changelog

Mudanças de cada versão. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões em [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

## [1.2.1] - 2026-11-06

### Corrigido
- **Abas quebradas e barra com botões brancos depois da atualização para a 1.2.0.** O GitHub Pages manda guardar os arquivos por 10 minutos (`Cache-Control: max-age=600`) e eles tinham sempre o mesmo endereço. Por isso o `index.html` novo carregava o `style.css` e os scripts da 1.1.0 que estavam no cache. O CSS antigo não estilizava a barra, que ficava com os botões padrão brancos e os ícones grandes. O `forms.js` antigo procurava o campo `pMeta`, removido na 1.2.0, e o erro interrompia a inicialização, deixando as abas sem resposta.
  - CSS e scripts agora têm a versão no endereço (`?v=`); o `index.html` declara a versão (`data-versao`) e o app recarrega uma vez se página e scripts não baterem.
  - Service worker: a página sempre revalida na rede, a cópia offline é baixada sem o cache HTTP e cada arquivo é guardado uma vez (sem a `?v=`).
  - A inicialização segue mesmo se uma parte falhar (a navegação inicia primeiro).
- Dados salvos ilegíveis não são mais sobrescritos: o app guarda uma cópia antes de gravar e, sem espaço para a cópia, não grava por cima.
- Falha ao gravar no navegador aparece no status ("Erro ao salvar"), além do aviso.
- Virada do dia com o app aberto: o dia de hoje é recalculado (ao voltar para o app e a cada minuto); o histórico fica.

### Adicionado
- **Navegação** com 4 destinos (Água, Calorias, Analytics, Perfil) em links `#`: voltar, avançar e recarregar funcionam, também em subpasta do GitHub Pages. Barra inferior no celular (área segura respeitada) e coluna lateral em telas a partir de 960 px; seção ativa com `aria-current`, foco visível e atalho "Pular para o conteúdo".
- **Água**: copo configurável (150, 200, 250, 300, 500 ml ou volume próprio de 50 a 1.000 ml), salvo nas preferências. Cada toque cria um registro com id, volume, tipo e horário; desfazer, editar e excluir registros. Silhueta humana em SVG que enche de baixo para cima (máscara, onda sutil, respeita `prefers-reduced-motion`), limitada a 100% da meta, com o total real e o excedente em texto.
- **Meta de água estimada** pela referência da EFSA (2010): água total de 2,5 L/dia (coeficiente masculino) ou 2,0 L/dia (feminino) menos 20% vindos dos alimentos = 2,0 L ou 1,6 L de bebidas. Só para adultos de 18 a 64 anos sem condição especial; peso e altura não entram (a referência não varia com eles). Meta personalizada e meta de profissional continuam disponíveis, com origem visível.
- **Analytics** por período: hoje, 7, 30 e 90 dias ou intervalo personalizado (datas inicial e final incluídas), comparado com o período anterior de mesma duração. Indicadores com cobertura ("5 de 7 dias com registro"): água média, dias com meta de água atingida, calorias médias, calorias × meta, variação de peso e dias com registros. Gráficos de água e calorias por dia (com a meta vigente de cada dia e "Ver em tabela"), peso (só medições reais) e distribuição de energia dos macronutrientes (Atwater 4/4/9). Valores por toque, mouse ou teclado (setas). Estado vazio com atalhos para começar.
- **Perfil** (antigo Histórico): nome, data de nascimento ou idade, altura, sexo das equações, objetivo (perder, manter ou **ganhar** peso), rotina, volume do copo e condições especiais, salvos com botão e validação por campo (aceita vírgula decimal). Peso atual, registro e **edição** de medições, gráfico, TMB, metas de calorias, proteína e água, e histórico de metas com vigência.
- Edição de alimentos (quantidade e refeição, nutrientes proporcionais) e de exercícios (tempo e intensidade, gasto recalculado com o peso daquele dia).
- Explicação da convenção do saldo na aba Calorias (consumo, gasto estimado, saldo e meta).
- Testes: navegação, cache/publicação, persistência e migração, copo e silhueta, períodos e agregações (104 testes).

### Alterado
- **Peso atual** = pesagem com a data mais recente (média do dia, se houver várias). Uma medição antiga incluída depois não troca o peso atual.
- **Peso usado nos cálculos**: média de 7 dias quando há pesagens em 3 ou mais desses dias (como antes); senão, a **última pesagem** (antes era o peso digitado em "Meus dados"); sem pesagens, o peso do cadastro antigo. Os dias já registrados mantêm o gasto guardado da época.
- Perfil novo começa sem peso, altura, idade e sexo inventados (antes: 70 kg, 170 cm, 30 anos, masculino). Sem esses dados, gasto, saldo e metas estimadas aparecem como "—", com o que falta preencher.
- Metas saíram de Analytics para o Perfil; o resumo detalhado do dia (diferença da meta, déficit estimado, proteína e nutrientes) e o gráfico de saldo foram para Calorias.
- Dados salvos passam para a versão 5 (preferências e nome); dados da 1.2.0 abrem sem perda.
- Tema escuro refinado (contraste, `color-scheme` para controles nativos), ícones de traço padronizados, estados de foco, toque e erro consistentes.

## [1.2.0] - 2026-11-06

### Adicionado
- Testes de regressão automatizados (`tests/`, `node:test`), obrigatórios no CI e nos hooks de merge/push (`.githooks`).
- Barra de navegação inferior com 4 abas: Água, Calorias, Analytics e Histórico. A aba aberta fica no endereço (`#agua`...).
- Aba Histórico: taxa metabólica basal (Mifflin-St Jeor) com dados detalhados (data de nascimento, coeficiente da equação, condições especiais), registro de peso e medidas corporais, tendência de 7 dias, variação semanal com cobertura e gráfico de evolução.
- A TMB é recalculada automaticamente pela média de peso dos últimos 7 dias quando há pesagens em 3 ou mais desses dias (pesagem isolada não muda o cálculo). Cada dia guarda TMB e peso de referência da época.
- Aba Analytics: resumo do dia (consumo, diferença da meta, déficit estimado só em dia completo, proteína % da meta, carboidratos, gorduras, fibras, açúcares, colesterol e minerais), semana (calorias × meta do dia, regularidade, consumo médio dos dias completos, minutos equivalentes de atividade e dias de força) com visão em tabela.
- Metas versionadas de calorias (estimativa com déficit 0/10/15%, profissional ou manual) e proteína (EFSA 0,83 g/kg ou ISSN 1,4–2,0 g/kg com treino regular), com método, fonte, vigência e dados usados. Cada dia é comparado com a meta vigente naquele dia.
- Opção “Registrei tudo o que comi neste dia” (diário completo).
- Aba Água: registro em ml (botões rápidos e volume livre), água pura e outras bebidas separadas, soma do dia, copo com o nível em relação à meta, últimos 7 dias e meta versionada (hábito ajustável ou limite de profissional; só água pura ou todas as bebidas), com a referência EFSA de água total. Volume muito alto gera aviso neutro; sem prêmio por excesso.

### Alterado
- Diário parcial não mostra “déficit”: o saldo só ganha cor e rótulo de déficit/superávit em dia marcado como completo.
- A meta de calorias saiu de Meus dados; a meta antiga vira uma meta manual versionada, sem perda.
- Alimentos registrados guardam os 12 nutrientes da quantidade (açúcares, gordura saturada, colesterol, cálcio, ferro, potássio).
- Verificações do `tools/smoke.cjs` (incluindo as da localização 1.1.1) migradas para `tests/`.

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
