# Cafe Direct

Cafe Direct is a cross-platform food delivery system for small cafes. The backend starts as a Node.js + Express API with MySQL persistence and real-time rider tracking support for a future React Native + Expo mobile/web frontend.

## Project Layout

```text
backend/   Express API, database schema, API docs
```

## Backend Quick Start

Prerequisites:

- Node.js LTS with npm available in the terminal.
- MySQL Server running locally or remotely.
- Redis running locally or remotely.
- Stripe test keys from your Stripe dashboard.

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Create the MySQL database, then run:

```bash
mysql -u root -p cafe_direct < database/schema.sql
mysql -u root -p cafe_direct < database/seed.sql
```

The API will run at `http://localhost:4000/api/v1`.
