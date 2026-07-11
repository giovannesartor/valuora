# Valuora Setup Guide — Análise e Mapeamento do Quanto Vale

> **Objetivo:** Mapear tudo que existe no Quanto Vale (`/Users/giovannesartor/Downloads/quantovale-site`) para copiar/reaproveitar no Valuora (`/Users/giovannesartor/Downloads/valuora-site`), adaptando para internacional (inglês), Stripe, e preços em USD.

---

## Sumário

1. [Status Atual do Valuora](#1-status-atual-do-valuora)
2. [Diferenças Entre Quanto Vale e Valuora](#2-diferenças-entre-quanto-vale-e-valuora)
3. [Precificação (USD)](#3-precificação-usd)
4. [O Que Copiar do Quanto Vale para o Valuora](#4-o-que-copiar-do-quanto-vale-para-o-valuora)
5. [O Que Já Existe no Valuora (não copiar)](#5-o-que-já-existe-no-valuora-não-copiar)
6. [O Que Adaptar](#6-o-que-adaptar)
7. [Roadmap de Implementação](#7-roadmap-de-implementação)
8. [Arquivos e Caminhos Completos do Quanto Vale](#8-arquivos-e-caminhos-completos-do-quanto-vale)

---

## 1. Status Atual do Valuora

O Valuora **já possui** uma base sólida copiada do Quanto Vale, incluindo:

### Backend (Python/FastAPI) — `/backend/`
- ✅ Estrutura completa de diretórios (core, models, routes, schemas, services, tasks, utils)
- ✅ Config (`config.py`) já adaptada para Valuora com Stripe
- ✅ `main.py` com todos os routers importados
- ✅ Database async (PostgreSQL + SQLAlchemy + Alembic)
- ✅ Redis (cache, rate limiting, JWT blacklist)
- ✅ Segurança (JWT, bcrypt)
- ✅ Modelos SQLAlchemy completos (`models.py`)
- ✅ CNAE models (`cnae.py`)
- ✅ Valuation engine (DCF + Scorecard + VC Method + Checklist + Multiples)
- ✅ Rotas: auth, analysis, payments, reports, admin, webhooks, cnae, benchmarks, diagnostico, partner, partner_crm, simulation, notifications, cnpj, pitch_deck, pitch_deck_invite, roi_calculator, oauth, public_api, integration_management, sidebar, partner_webhooks, api_webhooks, partner_guided_analysis
- ✅ Schemas Pydantic completos
- ✅ Services: auth, email, whatsapp, pdf, deepseek, oauth, webhook, storage, receitaws, ibge, drip_campaign, sector_analysis, pitch_deck_* (ai, consolidation, invite, pdf, pptx, tracking), portfolio_xlsx, api_webhook
- ✅ Tasks (worker, benchmark_updater, job_queue)
- ✅ Utils (stripe_fees, asaas_fees, normalizers)
- ✅ Testes
- ✅ Config Railway
- ✅ Requirements.txt

### Frontend (React/Vite) — `/frontend/`
- ✅ `App.jsx` com todas as rotas (incluindo partner/admin/legacy redirects)
- ✅ `main.jsx` com Sentry
- ✅ `index.css` com Tailwind + custom CSS
- ✅ Todos os componentes shadcn/ui
- ✅ Store (Zustand - authStore)
- ✅ Context (ThemeContext)
- ✅ Lib: api.js, utils.js, dashboardUtils.js, formatCurrency.js, formatBRL.js, inputMasks.js, useNotificationSSE.jsx, usePageTitle.js
- ✅ i18n: `lib/i18n/index.jsx`, `en.js`, `es.js`
- ✅ Componentes: AdminLayout, AdminRoute, AdminSidebar, BeforeAfterSlider, BlurredResult, CompletenessCard, ConfirmDialog, CookieBanner, CountUp, Counter, DashboardCharts, DashboardLayout, DiagnosticoModal, EmeraldParticles, EmptyState, ErrorBoundary, ExitIntentPopup, GlobalSearchModal, GlowDivider, KpiCards, LanguageSwitcher, LazySection, OnboardingSteps, OnboardingTour, OnboardingWizard, OutlierAlert, PageTransition, PendingAssetsEditor, PrivateRoute, RouteErrorBoundary, SensitivitySliders, Sidebar, Skeletons, ThemeToggle, UIComponents, WhatsAppButton
- ✅ Componentes partner: ClientHealthPanel, ClientNotesTasks, FollowUpTimeline, GuidedConsultation, ReportCoView
- ✅ Componentes pitch_deck: BulkInviteModal, ConsolidationModal, ConsolidationsHistory, InviteFunnelPanel, InvitePitchDeckModal, InviteReviewDrawer, InvitesTable, PitchDeckTrackingDashboard
- ✅ Páginas: Todas as principais (LandingPage, LoginPage, RegisterPage, DashboardPage, AnalysisPage, NewAnalysisPage, Partner*, Admin*, PitchDeck*, Blog*, etc.)
- ✅ i18n EN/ES implementada
- ✅ Blog posts (já em português)
- ✅ Tailwind config, Vite config, PostCSS

### O Que FALTA no Valuora vs Quanto Vale

#### Backend — Funcionalidades Ausentes

| Funcionalidade | Arquivos no Quanto Vale | Status |
|---|---|---|
| **Templates de email** (23 Jinja2) | `backend/app/templates/email/` | ❌ Não existe no Valuora |
| **Email templates de drip campaign** | `drip_*.html` | ❌ Faltam |
| **Seed de admin + partner** | `auth_service.py:seed_admin_user(), seed_test_partner()` | ❌ Não verifiquei se existe |
| **Pitch deck PPTX service** | `pitch_deck_pptx_service.py` | ❌ Faltam |
| **Portfolio XLSX service** | `portfolio_xlsx_service.py` | ❌ Faltam |
| **Benchmark updater** | `tasks/benchmark_updater.py` | ❌ Faltam |
| **Damodaran data** | `valuation_engine/damodaran_data.json` | ❌ Faltam |
| **Observability helper** | `core/observability.py` | ❌ Faltam |
| **Asaas fees** | `utils/asaas_fees.py` | ❌ Faltam (mas não precisa — usa Stripe) |
| **IBGE aggregates service** | `services/ibge_aggregates_service.py` | ❌ Faltam |
| **Sector analysis service** | `services/sector_analysis_service.py` | ❌ Faltam |
| **Ebook/payment flow** | `routes/payments.py` (Asaas), `routes/payments.py` (ebook) | ⚠️ Precisa adaptar para Stripe |
| **Admin WhatsApp page** | `routes/admin.py` (whatsapp status) | ❌ Faltam |
| **Admin health page** | `routes/admin.py` (system health) | ❌ Faltam |
| **Admin partners page** | `routes/admin.py` (partner management) | ❌ Faltam |
| **Admin webhooks page** | `routes/admin.py` (webhook management) | ❌ Faltam |
| **Audit trails** | `core/audit.py` | ❌ Faltam |

#### Frontend — Páginas/Funcionalidades Ausentes

| Página/Funcionalidade | Status |
|---|---|
| `AdminHealthPage` | ❌ Falta |
| `AdminPartnersPage` | ❌ Falta |
| `AdminWhatsAppPage` | ❌ Falta (não precisa — mesmo número) |
| `PitchDeckInvestorViewPage` | ❌ Falta |
| `ActivateAccountPage` | ❌ Falta |
| `ActivateAccountPage` | ❌ Falta |
| `SubProcessorsPage` | ❌ Falta |
| `Blog posts em inglês` | ⚠️ Tem posts em português |
| `Ebook landing page flow` | ❌ Falta (se for vender eBook) |
| `ExitIntentPopup` — pode existir mas não aparece no App.jsx | ⚠️ Verificar |

---

## 2. Diferenças Entre Quanto Vale e Valuora

| Aspecto | Quanto Vale 🇧🇷 | Valuora 🌎 |
|---|---|---|
| **Idioma** | Português (pt-BR) | Inglês (EN) + Espanhol (ES) |
| **Moeda** | BRL (R$) | USD ($) |
| **Gateway de pagamento** | Asaas (PIX/Boleto/Cartão BR) | Stripe (Cartão internacional) |
| **Planos** | Profissional (R$7.997), Estrategico (R$12.997), Bundle (R$15.994), Pitch Deck (R$3.997), Ebook (R$97) | Essential ($7.997), Advanced ($12.997), Bundle ($15.994), Pitch Deck ($3.997) |
| **WhatsApp** | Whatsmiau (Evolution API v2) | **Mesmo** Whatsmiau, mesmo número |
| **Público** | Brasileiro (CNPJ/CPF, IBGE) | Global (SIC/NAICS, benchmarks globais) |
| **Valuation Engine** | DCF + Damodaran + IBGE SIDRA | DCF + Scorecard + VC Method + Checklist + Multiples |
| **Validação** | CPF/CNPJ (Brasil) | Genérica (internacional) |
| **LGPD** | LGPD compliance | GDPR? Precisa verificar |
| **OAuth** | Sim | ✅ Já tem |
| **i18n** | Não tem | ✅ EN + ES |
| **Domínio** | quantovale.online | valuora.online |
| **Imagens/branding** | Emerald/navy PT-BR | Precisa adaptar para EN |
| **CNAE/SIC** | CNAE Brasil (IBGE) | Precisa ver se usa SIC/NAICS |

---

## 3. Precificação (USD)

| Plano | Preço (USD) | Produto Stripe ID (config.py) |
|---|---|---|
| **Professional / Essential** | $7,997 | `STRIPE_PRODUCT_PROFESSIONAL` |
| **Advanced / Strategic** | $12,997 | `STRIPE_PRODUCT_ADVANCED` |
| **Complete Bundle** | $15,994 | `STRIPE_PRODUCT_COMPLETE` |
| **Pitch Deck** | $3,997 | `STRIPE_PRODUCT_PITCH_DECK` |

---

## 4. O Que Copiar do Quanto Vale para o Valuora

### 4.1 Backend — Arquivos Para Copiar

> **Origem:** `/Users/giovannesartor/Downloads/quantovale-site/backend/app/`
> **Destino:** `/Users/giovannesartor/Downloads/valuora-site/backend/app/`

| # | Arquivo | Caminho Relativo | Observação |
|---|---|---|---|
| 1 | `templates/email/*` | `templates/email/` | 23 templates Jinja2 — precisa traduzir para EN |
| 2 | `core/audit.py` | `core/audit.py` | Redis-backed audit trail |
| 3 | `core/observability.py` | `core/observability.py` | Sentry helper |
| 4 | `core/valuation_engine/damodaran_data.json` | `core/valuation_engine/damodaran_data.json` | Damodaran reference |
| 5 | `utils/asaas_fees.py` | `utils/asaas_fees.py` | Só se for manter Asaas como fallback |

### 4.2 Frontend — Arquivos Para Copiar

> **Origem:** `/Users/giovannesartor/Downloads/quantovale-site/frontend/src/`
> **Destino:** `/Users/giovannesartor/Downloads/valuora-site/frontend/src/`

**Páginas que não existem no Valuora:**

| # | Página | Observação |
|---|---|---|
| 1 | `pages/ActivateAccountPage.jsx` | Ativação de conta via token |
| 2 | `pages/SubProcessorsPage.jsx` | Sub-processadores |
| 3 | `pages/PitchDeckInvestorViewPage.jsx` | Visualização investidor |
| 4 | `pages/EbookLandingPage.jsx` | Landing page do ebook |
| 5 | `pages/AdminWhatsAppPage.jsx` | Config WhatsApp admin |
| 6 | `pages/AdminPartnersPage.jsx` | Gestão de parceiros admin |
| 7 | `pages/AdminHealthPage.jsx` | Saúde do sistema admin |
| 8 | `pages/PartnerLandingPage.jsx` | Landing page de parceiro |
| 9 | `pages/AdminAdminAnalysisEditPage.jsx` | (já existe no Valuora como AdminAnalysisEditPage) |

**Blog posts (traduzir para EN):**

| # | Post |
|---|---|
| 1 | `blog/posts/como-calcular-valor-empresa.js` |
| 2 | `blog/posts/como-montar-pitch-deck.js` |
| 3 | `blog/posts/index.js` |
| 4 | `blog/posts/multiplos-valuation-por-setor.js` |
| 5 | `blog/posts/o-que-e-valuation-dcf.js` |
| 6 | `blog/posts/o-que-e-wacc.js` |
| 7 | `blog/posts/quanto-vale-empresa-faturamento.js` |
| 8 | `blog/posts/valuation-captacao-investimento.js` |
| 9 | `blog/posts/valuation-para-vender-empresa.js` |
| 10 | `blog/posts/valuation-startup.js` |

---

## 5. O Que Já Existe no Valuora (não copiar)

### Backend — Já existe
- `core/config.py` ✅ (já adaptado para Valuora com Stripe)
- `core/database.py` ✅
- `core/security.py` ✅
- `core/redis.py` ✅
- `core/cache.py` ✅
- `core/validators.py` ✅ (precisa verificar se ainda valida CPF/CNPJ)
- `core/valuation_engine/*` ✅ (engine.py, sectors.py, checklist_method.py, multiples_method.py, scorecard_method.py, venture_capital_method.py)
- `models/models.py` ✅ (modelos completos)
- `models/cnae.py` ✅
- `routes/*` ✅ (todos os routers)
- `schemas/*` ✅ (todos os schemas)
- `services/*` ✅ (quase todos)
- `tasks/*` ✅ (worker, benchmark_updater, job_queue)
- `utils/stripe_fees.py` ✅, `utils/normalizers.py` ✅
- `main.py` ✅
- `requirements.txt` ✅
- `railway.toml` ✅
- `alembic/` ✅

### Frontend — Já existe
- `App.jsx` ✅ (rotas completas)
- `main.jsx` ✅
- `index.css` ✅
- `components/ui/*` ✅ (todos shadcn/ui)
- `components/AdminLayout.jsx` ✅
- `components/AdminRoute.jsx` ✅
- `components/AdminSidebar.jsx` ✅
- `components/*` ✅ (quase todos os componentes)
- `components/partner/*` ✅
- `components/pitch_deck/*` ✅
- `pages/*` ✅ (quase todas)
- `store/authStore.js` ✅
- `context/ThemeContext.jsx` ✅
- `lib/*` ✅ (api.js, utils.js, etc.)
- `lib/i18n/*` ✅ (en.js, es.js, index.jsx)
- `blog/posts/*` ✅ (em português)
- `package.json` ✅
- `vite.config.js` ✅
- `tailwind.config.js` ✅

---

## 6. O Que Adaptar

### 6.1 Pricing (Stripe)
O Valuora **já usa Stripe** (config.py tem `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`).
Precisa verificar:
- [ ] Se `routes/payments.py` já está adaptado para Stripe (vs Asaas no Quanto Vale)
- [ ] Se `services/webhook_service.py` lida com webhooks do Stripe
- [ ] Se os preços nos produtos Stripe correspondem aos definidos
- [ ] Atualizar `PLAN_PRICES` no backend para USD

### 6.2 Email Templates
- [ ] Traduzir 23 templates Jinja2 de PT-BR para EN
- [ ] Atualizar links de `quantovale.online` para `valuora.online`
- [ ] Atualizar branding (cores, logo, nome)
- [ ] Templates de drip campaign (5 arquivos) também precisam tradução

### 6.3 WhatsApp (Whatsmiau)
- **Mesmo número, mesma config.** Só copiar as variáveis de ambiente.
- [ ] Verificar se os templates de mensagem estão em PT-BR (precisa manter ou traduzir?)
- Obs: Se o número é o mesmo, as mensagens vão continuar em português. Se Valuora é internacional, talvez queira mensagens em EN. Decisão: usar o mesmo número com mensagens em EN ou manter PT? O usuário disse "mesmo numero inclusive para tudo".

### 6.4 Validação
- [ ] `validators.py` ainda valida CPF/CNPJ — precisa adaptar para validação genérica internacional ou remover
- [ ] `cnpj_routes.py` — depende se Valuora vai suportar CNPJ (provavelmente não)
- [ ] Máscaras de input (`inputMasks.js`) — CPF/CNPJ/telefone BR → formatos internacionais

### 6.5 IBGE/SIDRA (Benchmarks Brasileiros)
- O Quanto Vale usa IBGE CNAE + SIDRA para benchmarks setoriais
- O Valuora precisa de benchmarks internacionais (SIC/NAICS ou similar)
- [ ] Decidir: usar dados Damodaran globais? ou manter IBGE para empresas brasileiras?

### 6.6 Blog
- [ ] Traduzir 10 posts de PT para EN
- [ ] Atualizar URLs/links internos
- [ ] Adicionar meta tags OG em EN

### 6.7 Landing Page
- [ ] Traduzir `LandingPage.jsx` para EN
- [ ] Atualizar CTAs, pricing display, depoimentos
- [ ] Adicionar `LanguageSwitcher` (EN/ES) — já existe o componente

### 6.8 PDF Reports
- [ ] Verificar se `pdf_service.py` gera relatórios em EN (ou PT)
- [ ] Template do relatório em PT-BR — precisa versão EN
- [ ] Atualizar branding no PDF (logo, cores, nome Valuora)

### 6.9 SEO / OG Tags
- [ ] Atualizar `index.html` com tags OG em EN
- [ ] Gerar novo `sitemap.xml` para valuora.online
- [ ] Atualizar `robots.txt`
- [ ] Schema.org structured data para Valuora

### 6.10 Admin Pages
- [ ] Traduzir labels/textos das páginas admin
- [ ] Admin WhatsApp page: configurar Whatsmiau com mesmo número
- [ ] Admin webhooks: configurar Stripe webhooks

### 6.11 Plans/Pricing no Frontend
- [ ] Atualizar display de preços de BRL para USD
- [ ] Atualizar nomes dos planos (Profissional → Professional, Estrategico → Advanced)
- [ ] Atualizar formatação de moeda (R$ → $)

### 6.12 Variáveis de Ambiente
Verificar se o `.env` do Valuora tem todas as variáveis necessárias:

```env
# App
APP_NAME=Valuora
APP_ENV=production
APP_URL=https://api.valuora.online
FRONTEND_URL=https://valuora.online

# Database
DATABASE_URL=postgresql+asyncpg://...
DATABASE_URL_SYNC=postgresql://...

# Redis
REDIS_URL=redis://...

# JWT
JWT_SECRET_KEY=...
JWT_EMAIL_SECRET_KEY=...
JWT_REFRESH_SECRET_KEY=...

# Resend (Email)
RESEND_API_KEY=...
RESEND_FROM_EMAIL=no-reply@valuora.online

# SMTP fallback
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...

# DeepSeek
DEEPSEEK_API_KEY=...
DEEPSEEK_API_URL=https://api.deepseek.com/v1

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRODUCT_PROFESSIONAL=prod_...
STRIPE_PRODUCT_ADVANCED=prod_...
STRIPE_PRODUCT_COMPLETE=prod_...
STRIPE_PRODUCT_PITCH_DECK=prod_...

# WhatsApp (Whatsmiau — mesmo número do Quanto Vale)
WHATSMIAU_SECRET_KEY=...
WHATSMIAU_INSTANCE=...
WHATSMIAU_WEBHOOK_TOKEN=...
WHATSAPP_PAUSED_UNTIL=
ADMIN_WHATSAPP=...

# Admin
ADMIN_EMAIL=admin@valuora.online
ADMIN_PASSWORD=...
ADMIN_NAME=Admin

# Cloudflare R2 (opcional)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=...

# Sentry
SENTRY_DSN=...
ENVIRONMENT=production

# ReceitaWS (opcional — só se for suportar CNPJ)
RECEITAWS_TOKEN=...
```

---

## 7. Roadmap de Implementação

### Fase 1 — Configuração Base (cópia direta) ✅ (commit a63144b)
- [x] Copiar templates de email do Quanto Vale (4 faltantes: account_activation, charge_reminder, partner_announcement, payment_link — adaptados para EN/i18n)
- [x] Copiar damodaran_data.json (já existia adaptado para EN)
- [x] Copiar audit.py (já existia, namespace corrigido: `qv:` → `valuora:`)
- [x] Copiar observability.py (criado a partir do Quanto Vale)
- [x] Verificar rotas/serviços — todos presentes (26 routes, 23 services, 23 email templates)

### Fase 2 — Stripe (pagamentos) ✅
- [x] Adaptar `routes/payments.py` para Stripe (vs Asaas) — já implementado com Checkout Session
- [x] Configurar Stripe webhooks no backend (`/webhooks/stripe` com verificação de assinatura)
- [x] Variáveis Stripe configuradas no Railway (SECRET_KEY, WEBHOOK_SECRET, PUBLISHABLE_KEY, 4 product IDs)
- [x] PLAN_PRICES em USD, PLAN_CURRENCY = "USD"
- [x] Fluxo completo: Create Checkout → Webhook → Confirm → Run Valuation → Generate PDF → Send Email

### Fase 3 — Internacionalização (i18n)
- [ ] Traduzir Landing Page para EN
- [ ] Traduzir todos os textos hardcoded nas páginas
- [ ] Atualizar i18n/en.js com todas as strings (verificar se está completo)
- [ ] i18n/es.js (espanhol)
- [ ] Adicionar LanguageSwitcher nas páginas principais

### Fase 4 — Email Templates
- [ ] Traduzir 23 templates Jinja2 de PT para EN
- [ ] Atualizar links e branding
- [ ] Testar envio via Resend

### Fase 5 — Blog
- [ ] Traduzir 10 posts para EN
- [ ] Atualizar index.js do blog
- [ ] Adicionar blog posts em ES (opcional)

### Fase 6 — Relatórios PDF
- [ ] Verificar geração de relatórios em EN
- [ ] Adaptar template PDF (branding Valuora)
- [ ] Traduzir labels nos gráficos (Matplotlib)

### Fase 7 — SEO & Deploy
- [ ] Atualizar index.html (OG tags, Schema.org)
- [ ] Gerar sitemap.xml
- [ ] Configurar Railway
- [ ] Fazer deploy

### Fase 8 — Partner Program
- [ ] Verificar partner routes no Valuora (já existem)
- [ ] Testar fluxo de parceiro completo
- [ ] Adaptar comissões para USD
- [ ] Mesma config WhatsApp

---

## 8. Arquivos e Caminhos Completos do Quanto Vale

> Para referência da IA que for executar: todos os caminhos abaixo são relativos a `/Users/giovannesartor/Downloads/quantovale-site/`

### 8.1 Backend Python

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                          # FastAPI entry point (581 linhas)
│   ├── core/
│   │   ├── __init__.py
│   │   ├── audit.py                     # Redis-backed audit trail
│   │   ├── cache.py                     # Redis cache (IBGE, JWT blacklist)
│   │   ├── config.py                    # Pydantic Settings (env vars)
│   │   ├── database.py                  # SQLAlchemy async engine
│   │   ├── observability.py             # Sentry helper
│   │   ├── redis.py                     # Redis async client
│   │   ├── security.py                  # JWT + bcrypt
│   │   ├── validators.py                # CPF/CNPJ validation
│   │   └── valuation_engine/
│   │       ├── __init__.py
│   │       ├── engine.py                # Core DCF valuation
│   │       ├── sectors.py               # Sector data
│   │       └── damodaran_data.json      # Damodaran reference
│   ├── models/
│   │   ├── __init__.py
│   │   ├── models.py                    # ALL SQLAlchemy models (1316 linhas)
│   │   └── cnae.py                      # CNAE + SectorBenchmark
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── analysis.py
│   │   ├── api_webhooks.py
│   │   ├── auth.py
│   │   ├── benchmark_routes.py
│   │   ├── cnae_routes.py
│   │   ├── cnpj_routes.py
│   │   ├── diagnostico.py
│   │   ├── integration_management.py
│   │   ├── notifications_routes.py
│   │   ├── oauth.py
│   │   ├── partner.py
│   │   ├── partner_crm.py
│   │   ├── partner_guided_analysis.py
│   │   ├── partner_webhooks.py
│   │   ├── payments.py
│   │   ├── pitch_deck.py
│   │   ├── pitch_deck_invite.py
│   │   ├── public_api.py
│   │   ├── reports.py
│   │   ├── roi_calculator.py
│   │   ├── sidebar.py
│   │   ├── simulation.py
│   │   └── webhooks.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── analysis.py
│   │   ├── auth.py
│   │   ├── cnae_schema.py
│   │   ├── oauth.py
│   │   ├── partner.py
│   │   ├── partner_crm.py
│   │   ├── pitch_deck.py
│   │   ├── pitch_deck_consolidation.py
│   │   └── pitch_deck_invite.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── api_webhook_service.py
│   │   ├── auth_service.py
│   │   ├── deepseek_service.py
│   │   ├── drip_campaign_service.py
│   │   ├── email_service.py
│   │   ├── ibge_aggregates_service.py
│   │   ├── ibge_cnae_service.py
│   │   ├── oauth_service.py
│   │   ├── pdf_service.py
│   │   ├── pitch_deck_ai_service.py
│   │   ├── pitch_deck_consolidation_service.py
│   │   ├── pitch_deck_invite_service.py
│   │   ├── pitch_deck_pdf_service.py
│   │   ├── pitch_deck_pptx_service.py
│   │   ├── pitch_deck_tracking_service.py
│   │   ├── portfolio_xlsx_service.py
│   │   ├── receitaws_service.py
│   │   ├── sector_analysis_service.py
│   │   ├── storage_service.py
│   │   ├── webhook_service.py
│   │   └── whatsapp_service.py
│   ├── tasks/
│   │   ├── __init__.py
│   │   ├── benchmark_updater.py
│   │   ├── job_queue.py
│   │   └── worker.py
│   ├── templates/
│   │   └── email/
│   │       ├── verification.html
│   │       ├── password_reset.html
│   │       ├── password_reset_done.html
│   │       ├── welcome.html
│   │       ├── partner_welcome.html
│   │       ├── payment_confirmation.html
│   │       ├── report_ready.html
│   │       ├── report_updated.html
│   │       ├── analysis_abandoned.html
│   │       ├── coupon_gift.html
│   │       ├── diagnostico_result.html
│   │       ├── account_activation.html
│   │       ├── payment_link.html
│   │       ├── charge_reminder.html
│   │       ├── pitch_deck_invite.html
│   │       ├── pitch_deck_invite_changes.html
│   │       ├── partner_announcement.html
│   │       ├── drip_abandoned_48h.html
│   │       ├── drip_day_1.html
│   │       ├── drip_day_3.html
│   │       ├── drip_day_7.html
│   │       ├── drip_post_purchase.html
│   │       └── drip_upsell.html
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── asaas_fees.py
│   │   └── normalizers.py
│   └── seeds/
│       ├── __init__.py
│       └── seed_sectors.py
├── storage/
│   ├── ebooks/
│   ├── samples/
│   ├── reports/
│   └── uploads/
├── tests/
├── requirements.txt
├── alembic.ini
├── alembic/
├── railway.toml
├── nixpacks.toml
└── pytest.ini
```

### 8.2 Frontend React

```
frontend/
├── src/
│   ├── App.jsx                          # Root com todas as rotas (226 linhas)
│   ├── main.jsx                         # Entry point (Sentry)
│   ├── index.css                        # Tailwind + custom
│   ├── components/
│   │   ├── AdminLayout.jsx
│   │   ├── AdminRoute.jsx
│   │   ├── AdminSidebar.jsx
│   │   ├── BeforeAfterSlider.jsx
│   │   ├── BlurredResult.jsx
│   │   ├── CompletenessCard.jsx
│   │   ├── ConfirmDialog.jsx
│   │   ├── CookieBanner.jsx
│   │   ├── Counter.jsx
│   │   ├── DashboardCharts.jsx
│   │   ├── DashboardLayout.jsx
│   │   ├── DiagnosticoModal.jsx
│   │   ├── EmeraldParticles.jsx
│   │   ├── EmptyState.jsx
│   │   ├── ErrorBoundary.jsx
│   │   ├── ExitIntentPopup.jsx
│   │   ├── GlobalSearchModal.jsx
│   │   ├── GlowDivider.jsx
│   │   ├── KpiCards.jsx
│   │   ├── LazySection.jsx
│   │   ├── OnboardingSteps.jsx
│   │   ├── OnboardingTour.jsx
│   │   ├── OutlierAlert.jsx
│   │   ├── PageTransition.jsx
│   │   ├── PendingAssetsEditor.jsx
│   │   ├── PrivateRoute.jsx
│   │   ├── RouteErrorBoundary.jsx
│   │   ├── SensitivitySliders.jsx
│   │   ├── Sidebar.jsx
│   │   ├── Skeletons.jsx
│   │   ├── ThemeToggle.jsx
│   │   ├── UIComponents.jsx
│   │   ├── WhatsAppButton.jsx
│   │   ├── ui/                          # 20 shadcn/ui components
│   │   │   ├── accordion.jsx
│   │   │   ├── badge.jsx
│   │   │   ├── button.jsx
│   │   │   ├── card.jsx
│   │   │   ├── command.jsx
│   │   │   ├── dialog.jsx
│   │   │   ├── dropdown-menu.jsx
│   │   │   ├── input.jsx
│   │   │   ├── label.jsx
│   │   │   ├── popover.jsx
│   │   │   ├── scroll-area.jsx
│   │   │   ├── select.jsx
│   │   │   ├── separator.jsx
│   │   │   ├── sheet.jsx
│   │   │   ├── skeleton.jsx
│   │   │   ├── sonner.jsx
│   │   │   ├── switch.jsx
│   │   │   ├── table.jsx
│   │   │   ├── tabs.jsx
│   │   │   ├── textarea.jsx
│   │   │   └── tooltip.jsx
│   │   └── pitch_deck/
│   │       ├── BulkInviteModal.jsx
│   │       ├── ConsolidationModal.jsx
│   │       ├── ConsolidationsHistory.jsx
│   │       ├── InviteFunnelPanel.jsx
│   │       ├── InvitePitchDeckModal.jsx
│   │       ├── InviteReviewDrawer.jsx
│   │       ├── InvitesTable.jsx
│   │       └── PitchDeckTrackingDashboard.jsx
│   ├── pages/
│   │   ├── LandingPage.jsx
│   │   ├── EbookLandingPage.jsx
│   │   ├── LoginPage.jsx
│   │   ├── RegisterPage.jsx
│   │   ├── VerifyEmailPage.jsx
│   │   ├── ForgotPasswordPage.jsx
│   │   ├── ResetPasswordPage.jsx
│   │   ├── PrivacyPolicyPage.jsx
│   │   ├── SubProcessorsPage.jsx
│   │   ├── TermsOfUsePage.jsx
│   │   ├── PublicAnalysisPage.jsx
│   │   ├── VerifyReportPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── NewAnalysisPage.jsx
│   │   ├── AnalysisPage.jsx
│   │   ├── EditAnalysisPage.jsx
│   │   ├── SimulatorPage.jsx
│   │   ├── TrashPage.jsx
│   │   ├── ProfilePage.jsx
│   │   ├── ComparePage.jsx
│   │   ├── WACCCalculatorPage.jsx
│   │   ├── InverseProjectionPage.jsx
│   │   ├── PitchDeckListPage.jsx
│   │   ├── NewPitchDeckPage.jsx
│   │   ├── PitchDeckPage.jsx
│   │   ├── PitchDeckInvitePage.jsx
│   │   ├── PitchDeckInvestorViewPage.jsx
│   │   ├── NotificationsPage.jsx
│   │   ├── NotificationPreferencesPage.jsx
│   │   ├── DeveloperPortalPage.jsx
│   │   ├── OAuthAuthorizePage.jsx
│   │   ├── EmbedValuationPage.jsx
│   │   ├── EmbedReportPage.jsx
│   │   ├── IntegrarPage.jsx
│   │   ├── BlogListPage.jsx
│   │   ├── BlogPostPage.jsx
│   │   ├── AnalysisInviteAcceptPage.jsx
│   │   ├── ActivateAccountPage.jsx
│   │   ├── PartnerLandingPage.jsx
│   │   ├── PartnerRegisterPage.jsx
│   │   ├── PartnerLoginPage.jsx
│   │   ├── PartnerDashboardPage.jsx
│   │   ├── PartnerClientsPage.jsx
│   │   ├── PartnerCommissionsPage.jsx
│   │   ├── PartnerFinanceiroPage.jsx
│   │   ├── PartnerClientDetailPage.jsx
│   │   ├── PartnerGuidedAnalysisPage.jsx
│   │   ├── PartnerMarketingPage.jsx
│   │   ├── PartnerConsultoriaPage.jsx
│   │   ├── PartnerSaudePage.jsx
│   │   ├── PartnerTarefasPage.jsx
│   │   ├── PartnerReportPage.jsx
│   │   ├── PartnerTemplatesPage.jsx
│   │   ├── PartnerFollowUpPage.jsx
│   │   ├── PartnerIntegrationPage.jsx
│   │   ├── AdminDashboardPage.jsx
│   │   ├── AdminUsersPage.jsx
│   │   ├── AdminAnalysesPage.jsx
│   │   ├── AdminAnalysisEditPage.jsx
│   │   ├── AdminPaymentsPage.jsx
│   │   ├── AdminCouponsPage.jsx
│   │   ├── AdminPartnersPage.jsx
│   │   ├── AdminWebhooksPage.jsx
│   │   ├── AdminAuditLogPage.jsx
│   │   ├── AdminErrorLogsPage.jsx
│   │   ├── AdminIntegrationPage.jsx
│   │   ├── AdminPitchDeckInvitesPage.jsx
│   │   ├── AdminWhatsAppPage.jsx
│   │   └── AdminHealthPage.jsx
│   ├── store/
│   │   └── authStore.js
│   ├── context/
│   │   └── ThemeContext.jsx
│   ├── lib/
│   │   ├── api.js
│   │   ├── utils.js
│   │   ├── dashboardUtils.js
│   │   ├── formatBRL.js
│   │   ├── formatCurrency.js
│   │   ├── inputMasks.js
│   │   ├── useNotificationSSE.jsx
│   │   └── usePageTitle.js
│   └── blog/
│       └── posts/
│           ├── index.js
│           ├── como-calcular-valor-empresa.js
│           ├── como-montar-pitch-deck.js
│           ├── multiplos-valuation-por-setor.js
│           ├── o-que-e-valuation-dcf.js
│           ├── o-que-e-wacc.js
│           ├── quanto-vale-empresa-faturamento.js
│           ├── valuation-captacao-investimento.js
│           ├── valuation-para-vender-empresa.js
│           └── valuation-startup.js
├── public/
│   ├── sdk/
│   ├── ebook/
│   ├── serve.json
│   └── sitemap.xml
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── eslint.config.js
├── railway.toml
└── nixpacks.toml
```

---

## Instruções para Uso

1. **Leia este documento** para entender o escopo total
2. **Analise o valuora-site** para ver o que já existe
3. **Copie os arquivos do quantovale-site** listados na seção 4
4. **Adapte conforme a seção 6**
5. **Siga o roadmap da seção 7**
6. **Atualize este .md** marcando o que já foi feito: `[x]` concluído, `[ ]` pendente
7. **Repita** até tudo estar completo

> **Próximo passo sugerido:** Pedir para a IA ler este arquivo e iniciar pela **Fase 1** (copiar templates de email do Quanto Vale para o Valuora).
