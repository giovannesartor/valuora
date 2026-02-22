# Quanto Vale

**Descubra quanto sua empresa vale hoje.**

Plataforma brasileira de valuation empresarial baseada em DCF (Fluxo de Caixa Descontado).

🌐 [quantovale.online](https://quantovale.online)
📧 quantovalehoje@gmail.com

## Stack

### Backend
- Python 3.12 + FastAPI
- PostgreSQL + Redis
- Alembic (migrations)
- ReportLab (PDF)
- JWT Authentication
- SMTP Email

### Frontend
- React + Vite
- TailwindCSS
- Recharts
- Inter Font

## Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Deploy
Configurado para Railway com `railway.toml` e `Procfile`.
