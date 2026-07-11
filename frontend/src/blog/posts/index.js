import comoCalcularValorEmpresa from './como-calcular-valor-empresa';
import comoCalcularValorEmpresaEn from './como-calcular-valor-empresa-en';
import oQueEValuationDcf from './o-que-e-valuation-dcf';
import oQueEValuationDcfEn from './o-que-e-valuation-dcf-en';
import quantoValeEmpresaFaturamento from './quanto-vale-empresa-faturamento';
import quantoValeEmpresaFaturamentoEn from './quanto-vale-empresa-faturamento-en';
import comoMontarPitchDeck from './como-montar-pitch-deck';
import comoMontarPitchDeckEn from './como-montar-pitch-deck-en';
import valuationParaVenderEmpresa from './valuation-para-vender-empresa';
import valuationParaVenderEmpresaEn from './valuation-para-vender-empresa-en';
import multiplosPorSetor from './multiplos-valuation-por-setor';
import multiplosPorSetorEn from './multiplos-valuation-por-setor-en';
import valuationStartup from './valuation-startup';
import valuationStartupEn from './valuation-startup-en';
import oQueEWacc from './o-que-e-wacc';
import oQueEWaccEn from './o-que-e-wacc-en';
import valuationCaptacaoInvestimento from './valuation-captacao-investimento';
import valuationCaptacaoInvestimentoEn from './valuation-captacao-investimento-en';

const allPosts = [
  comoCalcularValorEmpresa,
  comoCalcularValorEmpresaEn,
  oQueEValuationDcf,
  oQueEValuationDcfEn,
  quantoValeEmpresaFaturamento,
  quantoValeEmpresaFaturamentoEn,
  comoMontarPitchDeck,
  comoMontarPitchDeckEn,
  valuationParaVenderEmpresa,
  valuationParaVenderEmpresaEn,
  multiplosPorSetor,
  multiplosPorSetorEn,
  valuationStartup,
  valuationStartupEn,
  oQueEWacc,
  oQueEWaccEn,
  valuationCaptacaoInvestimento,
  valuationCaptacaoInvestimentoEn,
].sort((a, b) => new Date(b.date) - new Date(a.date));

export function getAllPosts(lang) {
  if (lang === 'en') return allPosts.filter(p => p.slug.endsWith('-en'));
  if (lang === 'pt') return allPosts.filter(p => !p.slug.endsWith('-en'));
  return allPosts;
}

export function getPostBySlug(slug) {
  return allPosts.find(p => p.slug === slug) || null;
}

export function getRelatedPosts(slug, limit = 3) {
  const lang = slug.endsWith('-en') ? 'en' : 'pt';
  const posts = getAllPosts(lang);
  return posts.filter(p => p.slug !== slug).slice(0, limit);
}
