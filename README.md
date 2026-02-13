# Job Hunt App

Run the backend (Node/Express) and MySQL locally.

Prerequisites
- Node.js (v18+ recommended)
- MySQL server running (default: 127.0.0.1:3306)

Environment variables (.env)
- DB_HOST (default: 127.0.0.1)
- DB_USER (default: root)
- DB_PASSWORD (default: Natili!254)
- DB_NAME (default: job_hunt)
- PORT (default: 5000)

Start backend

```bash
npm install
npm start
```

Useful endpoints
- GET / -> root test
- GET /health -> returns { server: 'ok', db: 'connected' } or db error

If DB is unreachable the server will continue running but DB queries will fail. Ensure MySQL is running or set correct DB env vars before starting.
