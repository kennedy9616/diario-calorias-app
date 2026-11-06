# Como contribuir

O projeto usa **Git Flow**.

## Branches

| Branch | Para quê | Sai de | Entra em |
|---|---|---|---|
| `master` | Produção. É o que está publicado no GitHub Pages. Cada merge vira uma versão (tag `vX.Y.Z`). | — | — |
| `develop` | Integração: próxima versão em preparação. | `master` | — |
| `feature/<nome>` | Uma funcionalidade ou melhoria. | `develop` | `develop` (PR) |
| `release/<X.Y.Z>` | Fechar uma versão: número da versão, CHANGELOG, ajustes finais. | `develop` | `master` (PR) e de volta em `develop` |
| `hotfix/<X.Y.Z>` | Correção urgente em produção. | `master` | `master` (PR) e `develop` |

Nunca faça commit direto em `master` ou `develop`: tudo entra por pull request.

## Fluxo de uma funcionalidade

```bash
git checkout develop && git pull
git checkout -b feature/minha-melhoria
# ... trabalho e commits ...
git push -u origin feature/minha-melhoria
# abra o PR para develop
```

## Fluxo de uma versão

```bash
git checkout develop && git pull
git checkout -b release/1.2.0
# atualize APP_VERSION (js/state.js), data-versao e as ?v= do index.html, CACHE (sw.js) e o CHANGELOG.md
git push -u origin release/1.2.0
# PR release/1.2.0 → master; depois do merge:
git checkout master && git pull
git tag -a v1.2.0 -m "v1.2.0" && git push origin v1.2.0
# leve a versão de volta para develop
git checkout develop && git merge --no-ff master && git push
```

Versões seguem [SemVer](https://semver.org/lang/pt-BR/): `MAJOR.MINOR.PATCH`.

## Testes

Testes de regressão em `tests/*.test.cjs` (`node:test`, sem dependências). Toda feature nova chega com testes (TDD).

```bash
git config core.hooksPath .githooks   # uma vez por clone: testes antes de merge em develop/master e de push
sh tools/run-tests.sh                 # ou: node tools/test.cjs
```

Teste de ponta a ponta no Chrome (opcional, fora do CI): sobe o app numa subpasta como no GitHub Pages e confere as 4 seções, os critérios de aceite, o teclado, o recarregamento, as larguras de 360 a 1280 px e o console.

```bash
node tools/e2e/e2e.cjs               # Chrome em outro lugar: CHROME=/caminho/do/chrome
```

Merges sempre com `--no-ff`. O CI roda os mesmos testes em todo PR para `develop` e `master`.

## Antes de abrir o PR

- [ ] `sh tools/run-tests.sh` passa.

- [ ] Testei no navegador do computador e no celular (ou em modo celular do DevTools).
- [ ] Se mudei arquivos do app (criei, renomeei ou apaguei), atualizei a lista `FILES` do `sw.js` e aumentei a versão em `CACHE`.
- [ ] Se mexi em `data/`, rodei `perl tools/gerar-base.pl` e fiz o commit do `data/alimentos-base.js`.
- [ ] Atualizei o `CHANGELOG.md` (seção "Não lançado").

O CI (GitHub Actions) confere automaticamente: base de alimentos atualizada, sintaxe do JavaScript, JSON válidos e arquivos do service worker.

## Revisão

Todo PR passa por **QA** (testes funcionais no navegador, celular, offline e dados antigos) e por **revisão de código** antes do merge.

## Base de alimentos

- `data/alimentos_unificados.json`: base de referência (TACO + USDA). Ela é gerada a partir das fontes oficiais. **Não edite à mão.**
- `data/alimentos_usuario.json`: alimentos cadastrados por usuários, no mesmo formato.
- `data/alimentos-base.js`: versão compacta que o app carrega. É **gerada**: rode `perl tools/gerar-base.pl`.

Os nomes USDA em `alimentos_unificados.json` são localizados para `pt-BR`; `nome_original` e `idioma_original` preservam a denominação da fonte. Ao atualizar a base oficial, reaplique as traduções somente quando ID e nome original coincidirem. Não traduza nem altere IDs, nutrientes ou pesos de porções. Revise nomes novos antes de publicar. As categorias e porções mantêm o idioma da fonte.

O hotfix 1.1.1 usou o [modelo Argos inglês → português brasileiro](https://github.com/argosopentech/argospm-index) com revisão de terminologia e por amostragem. A terminologia de cortes foi conferida com o [catálogo da ABIEC](https://abiec.com.br/wp-content/uploads/2025/11/Catalogo-de-Cortes.pdf). A tradução não é uma nova fonte de composição nutricional.

### Incluir alimentos cadastrados no app

1. No app, menu do topo › **Exportar alimentos cadastrados**. Isso baixa o arquivo `alimentos-usuario-AAAA-MM-DD.json`.
2. Numa branch `feature/alimentos-...`, rode:
   ```bash
   perl tools/mesclar-alimentos.pl caminho/para/alimentos-usuario-AAAA-MM-DD.json
   ```
   A ferramenta valida os valores, ignora repetidos e gera a base de novo.
3. Revise o `data/alimentos_usuario.json`, faça o commit dele e do `data/alimentos-base.js` e abra o PR para `develop`.
