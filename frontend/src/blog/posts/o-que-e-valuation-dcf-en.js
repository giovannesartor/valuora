export default {
  slug: 'o-que-e-valuation-dcf-en',
  title: 'What is DCF Valuation (Discounted Cash Flow)?',
  description: 'Understand what the DCF valuation method is, how Discounted Cash Flow works, and why it is the most used method by investment banks to value companies.',
  date: '2026-05-27',
  readTime: '7 min',
  category: 'Valuation',
  ctaType: 'valuation',
  keywords: 'DCF valuation, discounted cash flow, what is DCF, DCF method valuation',
  content: `
    <p><strong>DCF (Discounted Cash Flow)</strong> is the most widely used valuation method by investment banks, private equity funds, and financial consulting firms worldwide. Understanding how it works is essential for any business owner who wants to know the real value of their business.</p>

    <h2>The logic behind DCF</h2>

    <p>The principle is simple: <strong>money in the future is worth less than money today</strong>.</p>

    <p>Why? Because $100 today can be invested and generate returns. So $100 you will receive a year from now is actually worth less than $100 in present purchasing power — depending on the rate of return you could earn with that money.</p>

    <p>DCF applies this logic to value an entire company: it projects all the cash flows the business will generate in the future and "discounts" those values to the present using a rate that reflects investment risk.</p>

    <h2>The three main components</h2>

    <h3>1. Free Cash Flow (FCF)</h3>

    <p>This is the money the company generates after paying all its operating expenses and investments. It is not accounting profit — it is the actual cash left over for owners or shareholders.</p>

    <p>Simplified formula:<br/>
    <strong>FCF = EBITDA − Taxes − CAPEX − Change in Working Capital</strong></p>

    <h3>2. WACC — The Discount Rate</h3>

    <p>WACC (Weighted Average Cost of Capital) is the rate used to "discount" future cash flows to present value.</p>

    <p>It represents the minimum return investors require to put money into that company — considering the risk of the business, sector, and market.</p>

    <p>In Brazil, WACC for SMEs typically ranges between:</p>
    <ul>
      <li><strong>15% to 20% per year</strong> for mature companies in stable sectors (food, essential services)</li>
      <li><strong>20% to 28% per year</strong> for companies in moderate-risk sectors (retail, technology)</li>
      <li><strong>28% to 40%+ per year</strong> for early-stage startups or high-risk sectors</li>
    </ul>

    <p>The higher the WACC, the lower the present value of future cash flows — and therefore, the lower the valuation.</p>

    <h3>3. Terminal Value</h3>

    <p>No company exists only for the next 5 or 10 years (the projected period). The <strong>Terminal Value</strong> captures the value of all cash flows that come after the projection period, assuming the company continues operating with stable growth.</p>

    <p>It typically represents 60% to 80% of the total company value in DCF — which shows that a business's value lies much more in its future than in its past.</p>

    <h2>How DCF is calculated in practice</h2>

    <ol>
      <li><strong>Project 5 to 10 years of free cash flow</strong>, with assumptions for revenue growth, operating margin, and investments.</li>
      <li><strong>Calculate WACC</strong> based on sector, capital structure, and company-specific risk.</li>
      <li><strong>Calculate Terminal Value</strong> using the Gordon Growth Model formula: Last year FCF × (1 + g) ÷ (WACC − g), where g is the perpetual growth rate.</li>
      <li><strong>Bring everything to present value</strong>: divide each annual cash flow by (1 + WACC)^n, where n is the year.</li>
      <li><strong>Sum it all</strong>: the sum of present values of FCFs + terminal value = Enterprise Value (EV).</li>
    </ol>

    <h2>Why is DCF the preferred method?</h2>

    <p>Unlike methods such as asset value (which only looks at the past) or market multiples (which depend on comparables), DCF captures what really matters: <strong>the company's future cash generation potential</strong>.</p>

    <p>A company with $2 million in revenue growing 50% per year is worth much more than a company with the same revenue growing 5% per year — and DCF can capture that difference.</p>

    <h2>DCF limitations</h2>

    <p>No method is perfect. The main criticisms of DCF are:</p>

    <ul>
      <li><strong>Sensitive to assumptions:</strong> small changes in growth rate or WACC can change the final value by 30% or more.</li>
      <li><strong>Requires reliable projections:</strong> "garbage in, garbage out" — if financial data is poor, the valuation will be poor.</li>
      <li><strong>Complex for young companies:</strong> startups without financial history make projections very uncertain.</li>
    </ul>

    <p>That is why a professional valuation always presents three scenarios (conservative, base, and optimistic) and uses market multiples as validation.</p>

    <h2>What do you need to run a DCF?</h2>

    <ul>
      <li>Gross revenue from the last 2-3 years</li>
      <li>Current and projected EBITDA margin</li>
      <li>Historical growth rate</li>
      <li>Industry sector (to calibrate WACC with IBGE data)</li>
      <li>Current net debt</li>
    </ul>

    <p>With this data, Valuora automates the entire DCF calculation in under 5 minutes, using IBGE SIDRA sector benchmarks to calibrate assumptions for your specific sector — the same process consulting firms charge $10,000 to $50,000 to deliver.</p>
  `,
};
