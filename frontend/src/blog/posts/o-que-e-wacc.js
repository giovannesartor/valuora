export default {
  slug: 'o-que-e-wacc',
  title: 'O que é WACC e Por que Ele Importa no Valuation',
  description: 'Entenda o que é o WACC (Custo Médio Ponderado de Capital), como calculá-lo para empresas brasileiras, e qual é o impacto dessa taxa no valor final de uma empresa.',
  date: '2026-05-21',
  readTime: '8 min',
  category: 'Valuation',
  ctaType: 'valuation',
  keywords: 'o que é WACC, WACC cálculo, custo médio ponderado de capital, WACC empresa Brasil',
  content: `
    <p>O <strong>WACC</strong> (Weighted Average Cost of Capital, ou Custo Médio Ponderado de Capital em português) é um dos conceitos mais importantes — e mais mal compreendidos — no valuation de empresas. Ele aparece em todo cálculo DCF e tem impacto enorme no valor final.</p>

    <p>Neste artigo você vai entender o que é o WACC, como calculá-lo para uma empresa brasileira e por que ele faz tanta diferença no resultado do valuation.</p>

    <h2>O que é o WACC?</h2>

    <p>De forma simples, o WACC é <strong>a taxa de retorno mínima que os investidores exigem para colocar dinheiro em uma empresa</strong>, considerando tanto o custo do capital próprio (o que os acionistas esperam ganhar) quanto o custo da dívida (juros pagos ao banco).</p>

    <p>No DCF (Fluxo de Caixa Descontado), o WACC é usado como a taxa de desconto: ele "traz" os fluxos de caixa futuros para o valor presente. Quanto maior o WACC, menor o valor presente desses fluxos — e menor o valuation da empresa.</p>

    <h2>Por que o WACC importa tanto?</h2>

    <p>A sensibilidade do valuation ao WACC é enorme. Veja este exemplo:</p>

    <p>Uma empresa com FCF de R$500k anuais, crescendo 10% ao ano:</p>

    <ul>
      <li><strong>Com WACC de 15%:</strong> valuation ≈ R$10 milhões</li>
      <li><strong>Com WACC de 20%:</strong> valuation ≈ R$6,7 milhões</li>
      <li><strong>Com WACC de 25%:</strong> valuation ≈ R$5 milhões</li>
    </ul>

    <p>Uma diferença de 10 pontos percentuais no WACC pode reduzir o valuation à metade. Por isso, calibrar corretamente o WACC com dados do setor é tão crítico.</p>

    <h2>A fórmula do WACC</h2>

    <p><strong>WACC = (E/V × Ke) + (D/V × Kd × (1 − T))</strong></p>

    <p>Onde:</p>
    <ul>
      <li><strong>E</strong> = valor do capital próprio (equity)</li>
      <li><strong>D</strong> = valor da dívida</li>
      <li><strong>V</strong> = E + D (valor total da empresa)</li>
      <li><strong>Ke</strong> = custo do capital próprio</li>
      <li><strong>Kd</strong> = custo da dívida (taxa de juros)</li>
      <li><strong>T</strong> = alíquota de imposto de renda</li>
    </ul>

    <h2>Como calcular o custo do capital próprio (Ke) no Brasil</h2>

    <p>O custo do capital próprio é calculado pelo modelo CAPM (Capital Asset Pricing Model):</p>

    <p><strong>Ke = Rf + β × (Rm − Rf) + Risco País</strong></p>

    <ul>
      <li><strong>Rf (taxa livre de risco):</strong> no Brasil, usa-se a taxa Selic ou o rendimento dos títulos do Tesouro de longo prazo. Em 2026, em torno de 13% ao ano.</li>
      <li><strong>β (beta):</strong> mede o risco do setor em relação ao mercado. Setores estáveis têm beta próximo de 0,7; setores voláteis têm beta acima de 1,2.</li>
      <li><strong>Rm − Rf (prêmio de risco de mercado):</strong> retorno extra exigido por investir em renda variável em vez de renda fixa. No Brasil, historicamente entre 5% e 8%.</li>
      <li><strong>Risco País (CDS Brasil):</strong> adicional de risco por investir no Brasil em vez de num mercado desenvolvido. Costuma ficar entre 1,5% e 3%.</li>
    </ul>

    <h2>WACC típico por porte e setor no Brasil</h2>

    <table>
      <thead>
        <tr>
          <th>Tipo de empresa</th>
          <th>WACC aproximado</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Grande empresa (capital aberto, setor estável)</td><td>12% – 16%</td></tr>
        <tr><td>PME madura (setor estável, histórico sólido)</td><td>16% – 22%</td></tr>
        <tr><td>PME em crescimento (setor dinâmico)</td><td>20% – 28%</td></tr>
        <tr><td>Startup seed/early stage</td><td>28% – 40%</td></tr>
        <tr><td>Startup pré-receita / alto risco</td><td>40% – 60%+</td></tr>
      </tbody>
    </table>

    <h2>O impacto da dívida no WACC</h2>

    <p>Um detalhe importante: a dívida tem custo menor do que o capital próprio porque os juros pagos ao banco são dedutíveis do imposto de renda — isso é o chamado <strong>"escudo fiscal"</strong> (tax shield).</p>

    <p>Por isso, empresas com estrutura de capital saudável (alguma dívida a custo razoável) tendem a ter WACC menor do que empresas 100% financiadas por capital próprio. É um dos motivos pelos quais alavancagem moderada pode aumentar o valor de uma empresa.</p>

    <h2>Por que não usar um WACC genérico?</h2>

    <p>Um erro comum é usar um WACC "de referência" (como 20% ou 25%) sem ajustá-lo ao setor e ao perfil específico da empresa. Isso gera valuations distorcidos.</p>

    <p>O correto é calibrar o beta do setor com dados reais, ajustar pelo risco específico da empresa (concentração de clientes, dependência do fundador, tamanho) e usar a taxa livre de risco do Brasil no momento da análise.</p>

    <p>É exatamente isso que Valuora faz: usa dados setoriais do IBGE SIDRA para calibrar o WACC com o beta correto do seu setor, gerando um valuation mais preciso e defensável do que qualquer calculadora genérica.</p>

    <h2>Resumo rápido</h2>

    <ul>
      <li>WACC = custo médio de capital da empresa (próprio + dívida)</li>
      <li>É a taxa de desconto usada no DCF</li>
      <li>Quanto maior o WACC, menor o valuation</li>
      <li>Deve ser calibrado ao setor, porte e risco específico da empresa</li>
      <li>No Brasil, varia de ~12% (grandes empresas estáveis) a 50%+ (startups de alto risco)</li>
    </ul>
  `,
};
