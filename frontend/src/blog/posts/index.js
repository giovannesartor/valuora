import comoCalcularValorEmpresa from './como-calcular-valor-empresa';
import oQueEValuationDcf from './o-que-e-valuation-dcf';
import quantoValeEmpresaFaturamento from './quanto-vale-empresa-faturamento';
import comoMontarPitchDeck from './como-montar-pitch-deck';
import valuationParaVenderEmpresa from './valuation-para-vender-empresa';
import multiplosPorSetor from './multiplos-valuation-por-setor';
import valuationStartup from './valuation-startup';
import oQueEWacc from './o-que-e-wacc';
import valuationCaptacaoInvestimento from './valuation-captacao-investimento';

// Lista ordenada por data (mais recente primeiro)
const allPosts = [
  comoCalcularValorEmpresa,
  oQueEValuationDcf,
  quantoValeEmpresaFaturamento,
  comoMontarPitchDeck,
  valuationParaVenderEmpresa,
  multiplosPorSetor,
  valuationStartup,
  oQueEWacc,
  valuationCaptacaoInvestimento,
].sort((a, b) => new Date(b.date) - new Date(a.date));

export function getAllPosts() {
  return allPosts;
}

export function getPostBySlug(slug) {
  return allPosts.find(p => p.slug === slug) || null;
}

export function getRelatedPosts(slug, limit = 3) {
  return allPosts.filter(p => p.slug !== slug).slice(0, limit);
}
