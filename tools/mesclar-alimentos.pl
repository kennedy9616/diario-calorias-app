#!/usr/bin/env perl
# ==========================================================================
# Junta alimentos exportados pelo app ("Exportar alimentos cadastrados")
# em data/alimentos_usuario.json e gera de novo a base do app.
#
# Uso (na raiz do projeto):
#   perl tools/mesclar-alimentos.pl alimentos-usuario-2026-11-05.json [outro.json ...]
#
# Regras:
#   - aceita só itens no formato da base (schema de alimentos_unificados.json);
#   - não repete: ignora id já existente e nome igual (sem acento/maiúsculas);
#   - recusa valores impossíveis (kcal fora de 0–950 por 100 g, gramas fora de 0–100);
#   - data/alimentos_unificados.json (TACO + USDA) não é alterado: ele é gerado
#     a partir das fontes oficiais e pode ser refeito a qualquer momento.
# ==========================================================================
use strict;
use warnings;
use utf8;
use JSON::PP;
use Unicode::Normalize qw(NFD);
use File::Basename qw(dirname);
use File::Spec;
binmode STDOUT, ':encoding(UTF-8)';
binmode STDERR, ':encoding(UTF-8)';

my $RAIZ    = File::Spec->rel2abs(File::Spec->catdir(dirname(__FILE__), '..'));
my $USUARIO = "$RAIZ/data/alimentos_usuario.json";
my @NUTRIENTES = qw(
  calorias_kcal carboidratos_g proteinas_g gorduras_totais_g fibras_g sodio_mg
  acucares_totais_g gorduras_saturadas_g colesterol_mg calcio_mg ferro_mg potassio_mg
);

die "Uso: perl tools/mesclar-alimentos.pl <arquivo-exportado.json> [...]\n" unless @ARGV;

sub ler_json {
  my ($arq) = @_;
  open my $fh, '<:raw', $arq or die "Não consegui abrir $arq: $!\n";
  local $/;
  my $dados = eval { JSON::PP->new->utf8->decode(<$fh>) };
  die "$arq não é um JSON válido: $@\n" unless $dados;
  return $dados;
}
sub chave_nome {
  my $s = NFD(lc($_[0] // ''));
  $s =~ s/\p{Mn}//g;
  $s =~ s/\s+/ /g;
  $s =~ s/^ | $//g;
  return $s;
}
sub numero_ou_null {
  my ($v) = @_;
  return undef unless defined $v;
  return undef if ref $v;
  return undef unless $v =~ /^-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?$/;
  return 0 + $v;
}

my $destino = -e $USUARIO ? ler_json($USUARIO) : {
  versao_schema => '1.0.0',
  descricao     => 'Alimentos cadastrados por usuários do Diário de Calorias.',
  alimentos     => [],
};
my %ids   = map { $_->{id} => 1 } @{ $destino->{alimentos} };
my %nomes = map { chave_nome($_->{nome}) => $_->{nome} } @{ $destino->{alimentos} };

my ($novos, $repetidos, $invalidos) = (0, 0, 0);
for my $arq (@ARGV) {
  my $entrada = ler_json($arq);
  my $lista = ref $entrada eq 'HASH' ? $entrada->{alimentos} : $entrada;
  die "$arq não tem a lista \"alimentos\".\n" unless ref $lista eq 'ARRAY';

  for my $a (@$lista) {
    my $nome = ref $a eq 'HASH' ? $a->{nome} : undef;
    my $rotulo = $nome // '(sem nome)';
    my $nut = ref $a eq 'HASH' && ref $a->{nutrientes_por_100g} eq 'HASH' ? $a->{nutrientes_por_100g} : {};
    my %limpo = map { $_ => numero_ou_null($nut->{$_}) } @NUTRIENTES;

    my @erros;
    push @erros, 'sem nome' unless defined $nome && $nome =~ /\S/;
    push @erros, 'id deve começar com "usuario:"' unless ($a->{id} // '') =~ /^usuario:[\w-]+$/;
    push @erros, 'sem calorias' unless defined $limpo{calorias_kcal};
    push @erros, 'kcal fora de 0–950 por 100 g' if defined $limpo{calorias_kcal} && ($limpo{calorias_kcal} < 0 || $limpo{calorias_kcal} > 950);
    for my $k (grep { /_g$/ } @NUTRIENTES) {
      push @erros, "$k fora de 0–100 g" if defined $limpo{$k} && ($limpo{$k} < 0 || $limpo{$k} > 100);
    }
    for my $k (grep { /_mg$/ } @NUTRIENTES) {
      push @erros, "$k negativo" if defined $limpo{$k} && $limpo{$k} < 0;
    }
    if (@erros) { $invalidos++; print STDERR "Recusado \"$rotulo\": ", join('; ', @erros), "\n"; next; }

    $nome =~ s/^\s+|\s+$//g;
    my $chave = chave_nome($nome);
    if ($ids{ $a->{id} } || exists $nomes{$chave}) {
      $repetidos++;
      print "Já existe, ignorado: \"$nome\"\n";
      next;
    }

    push @{ $destino->{alimentos} }, {
      id                  => $a->{id},
      fonte_id            => 'usuario',
      codigo_fonte        => undef,
      nome                => $nome,
      idioma              => 'pt-BR',
      categoria           => undef,
      preparo             => undef,
      base_g              => 100,
      nutrientes_por_100g => \%limpo,
      porcoes             => [],
      observacoes         => [],
      macros_completos    => (defined $limpo{carboidratos_g} && defined $limpo{proteinas_g} && defined $limpo{gorduras_totais_g}) ? JSON::PP::true : JSON::PP::false,
      url_fonte           => undef,
      criado_em           => (defined $a->{criado_em} && !ref $a->{criado_em}) ? $a->{criado_em} : undef,
    };
    $ids{ $a->{id} } = 1;
    $nomes{$chave} = $nome;
    $novos++;
    print "Incluído: \"$nome\" ($limpo{calorias_kcal} kcal/100 g)\n";
  }
}

if ($novos) {
  @{ $destino->{alimentos} } = sort { chave_nome($a->{nome}) cmp chave_nome($b->{nome}) } @{ $destino->{alimentos} };
  open my $out, '>:raw', $USUARIO or die "Não consegui gravar $USUARIO: $!\n";
  print $out JSON::PP->new->utf8->canonical->indent->indent_length(2)->space_after->encode($destino);
  close $out;
}
print "\nResumo: $novos incluídos, $repetidos já existiam, $invalidos recusados.\n";

if ($novos) {
  print "Gerando a base do app...\n";
  system($^X, File::Spec->catfile($RAIZ, 'tools', 'gerar-base.pl')) == 0 or die "Falha ao gerar a base.\n";
  print "Pronto. Revise e faça o commit de data/alimentos_usuario.json e data/alimentos-base.js.\n";
}
