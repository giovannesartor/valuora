export default {
  slug: 'o-que-e-wacc-en',
  title: 'What is WACC and Why Does It Matter in Valuation',
  description: 'Understand what WACC (Weighted Average Cost of Capital) is, how to calculate it for Brazilian companies, and what impact this rate has on a company\'s final value.',
  date: '2026-05-21',
  readTime: '8 min',
  category: 'Valuation',
  ctaType: 'valuation',
  keywords: 'what is WACC, WACC calculation, weighted average cost of capital, WACC Brazil company',
  content: `
    <p><strong>WACC</strong> (Weighted Average Cost of Capital) is one of the most important — and most misunderstood — concepts in business valuation. It appears in every DCF calculation and has a huge impact on the final value.</p>

    <p>In this article, you will understand what WACC is, how to calculate it for a Brazilian company, and why it makes such a difference in the valuation result.</p>

    <h2>What is WACC?</h2>

    <p>Simply put, WACC is <strong>the minimum rate of return that investors require to put money into a company</strong>, considering both the cost of equity (what shareholders expect to earn) and the cost of debt (interest paid to the bank).</p>

    <p>In DCF, WACC is used as the discount rate: it "brings" future cash flows to present value. The higher the WACC, the lower the present value of those flows — and the lower the company's valuation.</p>

    <h2>Why does WACC matter so much?</h2>

    <p>The sensitivity of valuation to WACC is enormous. See this example:</p>

    <p>A company with annual FCF of $500k, growing 10% per year:</p>

    <ul>
      <li><strong>With WACC of 15%:</strong> valuation ≈ $10 million</li>
      <li><strong>With WACC of 20%:</strong> valuation ≈ $6.7 million</li>
      <li><strong>With WACC of 25%:</strong> valuation ≈ $5 million</li>
    </ul>

    <p>A 10 percentage point difference in WACC can cut the valuation in half. That is why properly calibrating WACC with sector data is so critical.</p>

    <h2>The WACC formula</h2>

    <p><strong>WACC = (E/V × Ke) + (D/V × Kd × (1 − T))</strong></p>

    <p>Where:</p>
    <ul>
      <li><strong>E</strong> = value of equity</li>
      <li><strong>D</strong> = value of debt</li>
      <li><strong>V</strong> = E + D (total company value)</li>
      <li><strong>Ke</strong> = cost of equity</li>
      <li><strong>Kd</strong> = cost of debt (interest rate)</li>
      <li><strong>T</strong> = corporate income tax rate</li>
    </ul>

    <h2>How to calculate cost of equity (Ke) in Brazil</h2>

    <p>The cost of equity is calculated using the CAPM (Capital Asset Pricing Model):</p>

    <p><strong>Ke = Rf + β × (Rm − Rf) + Country Risk</strong></p>

    <ul>
      <li><strong>Rf (risk-free rate):</strong> in Brazil, the Selic rate or long-term Treasury bond yield is used. In 2026, around 13% per year.</li>
      <li><strong>β (beta):</strong> measures sector risk relative to the market. Stable sectors have beta close to 0.7; volatile sectors have beta above 1.2.</li>
      <li><strong>Rm − Rf (market risk premium):</strong> extra return demanded for investing in variable income instead of fixed income. In Brazil, historically between 5% and 8%.</li>
      <li><strong>Country Risk (Brazil CDS):</strong> additional risk for investing in Brazil instead of a developed market. Typically between 1.5% and 3%.</li>
    </ul>

    <h2>Typical WACC by size and sector in Brazil</h2>

    <table>
      <thead>
        <tr>
          <th>Company type</th>
          <th>Approximate WACC</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Large company (public, stable sector)</td><td>12% – 16%</td></tr>
        <tr><td>Mature SME (stable sector, solid history)</td><td>16% – 22%</td></tr>
        <tr><td>Growing SME (dynamic sector)</td><td>20% – 28%</td></tr>
        <tr><td>Seed / Early-stage startup</td><td>28% – 40%</td></tr>
        <tr><td>Pre-revenue / High-risk startup</td><td>40% – 60%+</td></tr>
      </tbody>
    </table>

    <h2>The impact of debt on WACC</h2>

    <p>An important detail: debt has a lower cost than equity because interest paid to the bank is tax-deductible — this is called the <strong>"tax shield"</strong>.</p>

    <p>Therefore, companies with a healthy capital structure (some debt at a reasonable cost) tend to have a lower WACC than companies 100% financed by equity. This is one reason moderate leverage can increase a company's value.</p>

    <h2>Why not use a generic WACC?</h2>

    <p>A common mistake is using a "reference" WACC (like 20% or 25%) without adjusting it to the sector and specific company profile. This generates distorted valuations.</p>

    <p>The correct approach is to calibrate the sector beta with real data, adjust for company-specific risk (customer concentration, founder dependency, size), and use Brazil's risk-free rate at the time of analysis.</p>

    <p>This is exactly what Valuora does: it uses IBGE SIDRA sector data to calibrate WACC with the correct beta for your sector, generating a more accurate and defensible valuation than any generic calculator.</p>

    <h2>Quick summary</h2>

    <ul>
      <li>WACC = average cost of company capital (equity + debt)</li>
      <li>It is the discount rate used in DCF</li>
      <li>The higher the WACC, the lower the valuation</li>
      <li>It must be calibrated to the sector, size, and specific risk of the company</li>
      <li>In Brazil, it ranges from ~12% (large stable companies) to 50%+ (high-risk startups)</li>
    </ul>
  `,
};
