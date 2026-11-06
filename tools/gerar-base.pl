#!/usr/bin/env perl
# ==========================================================================
# Gera data/alimentos-base.js — a base compacta que o app carrega.
#
# Entradas (mesmo formato/schema):
#   data/alimentos_unificados.json  base de referência (TACO + USDA)
#   data/alimentos_usuario.json     alimentos cadastrados por usuários
#
# Uso (na raiz do projeto):
#   perl tools/gerar-base.pl              gera o arquivo
#   perl tools/gerar-base.pl --verificar  só confere se o arquivo está atualizado
#                                         (sai com código 1 se não estiver; usado no CI)
#
# Não precisa instalar nada: usa só módulos que já vêm com o Perl
# (o Perl vem junto com o Git no Windows e já existe no Linux e no macOS).
# ==========================================================================
use strict;
use warnings;
use utf8;
use Encode qw(encode_utf8);
binmode STDOUT, ":encoding(UTF-8)";
binmode STDERR, ":encoding(UTF-8)";
use JSON::PP;
use Digest::SHA qw(sha256_hex);
use File::Basename qw(dirname);
use File::Spec;

my $RAIZ     = File::Spec->rel2abs(File::Spec->catdir(dirname(__FILE__), '..'));
my $ORIGEM   = "$RAIZ/data/alimentos_unificados.json";
my $USUARIO  = "$RAIZ/data/alimentos_usuario.json";
my $DESTINO  = "$RAIZ/data/alimentos-base.js";
my $VERIFICAR = grep { $_ eq '--verificar' } @ARGV;

# Ordem dos nutrientes no arquivo gerado — precisa ser a mesma de NUTRIENTES em js/data.js.
my @NUTRIENTES = qw(
  calorias_kcal carboidratos_g proteinas_g gorduras_totais_g fibras_g sodio_mg
  acucares_totais_g gorduras_saturadas_g colesterol_mg calcio_mg ferro_mg potassio_mg
);
my $MAX_PORCOES = 6;   # porções caseiras por alimento (as primeiras da fonte)

sub ler_json {
  my ($arq) = @_;
  open my $fh, '<:raw', $arq or die "Não consegui abrir $arq: $!\n";
  local $/;
  my $txt = <$fh>;
  close $fh;
  return ($txt, JSON::PP->new->utf8->decode($txt));
}

# arredonda preservando null (null = sem dado, não é zero)
sub arred {
  my ($v, $casas) = @_;
  return undef unless defined $v && $v =~ /^-?[\d.]+(?:[eE][-+]?\d+)?$/;
  my $r = 0 + sprintf("%.${casas}f", $v);
  return $r == 0 ? 0 : $r;   # evita "-0"
}
# casas decimais: kcal e a maioria dos mg com 1; gramas e ferro (valores pequenos) com 2
my %CASAS = map { $_ => ($_ eq "ferro_mg" ? 2 : /_mg$|_kcal$/ ? 1 : 2) } @NUTRIENTES;

my ($txt_ref, $ref) = ler_json($ORIGEM);
my @fontes_meta = @{ $ref->{fontes} || [] };
my @alimentos   = @{ $ref->{alimentos} || [] };
my $txt_usu = '';
if (-e $USUARIO) {
  my $usu;
  ($txt_usu, $usu) = ler_json($USUARIO);
  push @alimentos, @{ $usu->{alimentos} || [] };
  push @fontes_meta, { id => 'usuario', nome => 'Cadastrados por usuários do Diário de Calorias' }
    unless grep { $_->{id} eq 'usuario' } @fontes_meta;
}

# índice das fontes (o app recebe só o número da fonte em cada item)
my (@fontes, %idx_fonte);
for my $f (@fontes_meta) {
  next if exists $idx_fonte{ $f->{id} };
  $idx_fonte{ $f->{id} } = scalar @fontes;
  push @fontes, { id => $f->{id}, nome => $f->{nome}, licenca => ($f->{licenca} // $f->{licenca_normalizacao}) };
}

my (@itens, %visto, %ignorados);
for my $a (@alimentos) {
  my $id   = $a->{id};
  my $nome = $a->{nome};
  my $nut  = $a->{nutrientes_por_100g} || {};
  if (!defined $id || !defined $nome || $nome eq '') { $ignorados{'sem id ou nome'}++; next; }
  if ($visto{$id}++)                                { $ignorados{'id repetido'}++; next; }
  my $kcal = arred($nut->{calorias_kcal}, 1);
  if (!defined $kcal)                               { $ignorados{'sem calorias'}++; next; }
  my $fi = $idx_fonte{ $a->{fonte_id} // '' };
  if (!defined $fi)                                 { $ignorados{'fonte desconhecida'}++; next; }

  my @valores = map { arred($nut->{$_}, $CASAS{$_}) } @NUTRIENTES;

  my @porcoes;
  for my $p (@{ $a->{porcoes} || [] }) {
    my $g = arred($p->{peso_g}, 1);
    next unless defined $g && $g > 0 && defined $p->{descricao};
    next if $p->{descricao} =~ /^quantity not specified$/i;
    push @porcoes, [ $p->{descricao}, $g ];
    last if @porcoes >= $MAX_PORCOES;
  }

  my @item = ($id, $nome, $fi, \@valores);
  push @item, \@porcoes if @porcoes;
  push @itens, \@item;
}

my %base = (
  versao_schema => $ref->{versao_schema},
  data_coleta   => $ref->{data_coleta},
  origem_sha256 => substr(sha256_hex($txt_ref . $txt_usu), 0, 16),
  nutrientes    => \@NUTRIENTES,
  fontes        => \@fontes,
  total         => scalar @itens,
  itens         => \@itens,
);

my $json = JSON::PP->new->ascii->canonical->encode(\%base);
# cabeçalho só com ASCII: o arquivo inteiro fica ASCII e não depende de charset
my $saida = encode_utf8(
            "/* Gerado por tools/gerar-base.pl a partir de data/alimentos_unificados.json\n"
          . "   e data/alimentos_usuario.json. Nao edite a mao: rode `perl tools/gerar-base.pl`. */\n"
          . "self.ALIMENTOS_BASE=$json;\n");

my $resumo = sprintf "%d alimentos (%s)", scalar @itens,
  join(', ', map { my $i = $idx_fonte{$_->{id}}; "$_->{id}: " . scalar(grep { $_->[2] == $i } @itens) } @fontes);
my $ign = join(', ', map { "$_: $ignorados{$_}" } sort keys %ignorados);

if ($VERIFICAR) {
  my $atual = '';
  if (open my $fh, '<:raw', $DESTINO) { local $/; $atual = <$fh>; close $fh; }
  if ($atual ne $saida) {
    print STDERR "data/alimentos-base.js está desatualizado. Rode: perl tools/gerar-base.pl\n";
    exit 1;
  }
  print "OK: data/alimentos-base.js está atualizado — $resumo\n";
  exit 0;
}

open my $out, '>:raw', $DESTINO or die "Não consegui gravar $DESTINO: $!\n";
print $out $saida;
close $out;
printf "Gerado data/alimentos-base.js: %s, %.1f MB\n", $resumo, length($saida) / 1048576;
print "Ignorados: $ign\n" if $ign;
