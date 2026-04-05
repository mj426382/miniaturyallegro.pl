# AllGrafika.pl

SaaS application for generating professional Allegro product thumbnails using AI (Google Gemini).

## Project Structure

```
├── backend/          # NestJS API (TypeScript)
├── frontend/         # React app (Vite + TailwindCSS)
├── landing-page/     # Marketing landing page (React + Vite)
├── infra/            # Docker & docker-compose configs
└── README.md
```

## Tech Stack

- **Backend**: NestJS + Prisma + PostgreSQL + JWT auth
- **Storage**: Backblaze B2 (S3-compatible)
- **AI**: Google Gemini API
- **Frontend**: React + Vite + TailwindCSS + React Router
- **Landing Page**: React + Vite + TailwindCSS (SEO optimized)
- **Infrastructure**: Docker + docker-compose

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (or Docker)
- Backblaze B2 account
- Google Gemini API key

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials

npm install
npx prisma migrate dev --name init
npm run start:dev
```

The API runs on http://localhost:3000  
Swagger docs: http://localhost:3000/api/docs

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on http://localhost:5173

### 3. Landing Page Setup

```bash
cd landing-page
npm install
npm run dev
```

The landing page runs on http://localhost:5174

### Docker Development

```bash
cp infra/.env.example infra/.env
# Edit infra/.env

cd infra
docker-compose -f docker-compose.dev.yml up
```

### Docker Production

```bash
cp infra/.env.example infra/.env
# Edit infra/.env with production values

cd infra
docker-compose up -d
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRES_IN` | JWT expiry (e.g. `7d`) |
| `B2_ENDPOINT` | Backblaze B2 S3 endpoint |
| `B2_BUCKET_NAME` | B2 bucket name |
| `B2_KEY_ID` | B2 application key ID |
| `B2_APPLICATION_KEY` | B2 application key |
| `B2_PUBLIC_URL` | Public URL for B2 files |
| `GEMINI_API_KEY` | Google Gemini API key |
| `FRONTEND_URL` | Frontend URL for CORS |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/forgot-password` | Password reset |
| GET | `/api/users/me` | Get current user |
| POST | `/api/images/upload` | Upload product image |
| GET | `/api/images` | List user images |
| POST | `/api/generation/:imageId/start` | Generate 12 variants |
| GET | `/api/generation/:imageId/results` | Get generation results |

## Features

- 🔐 JWT Authentication (register, login, password reset)
- 📸 Image upload to Backblaze B2
- 🤖 AI-powered thumbnail generation (12 styles via Gemini)
- 📊 Dashboard with statistics
- 🖼️ Image gallery with pagination
- 📝 SEO-optimized landing page with blog
- 🐳 Docker support for easy deployment
