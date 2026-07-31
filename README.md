# Al-Baraa Ceramic Management System

The existing React frontend remains a standalone, localStorage-based application. The backend currently provides infrastructure only; no product, customer, inventory, or sales APIs have been added.

## Backend development

The backend uses FastAPI, SQLAlchemy 2, PostgreSQL, Alembic, and Docker Compose.

Create the local backend environment file from the safe template:

```bash
cp backend/.env.example backend/.env
```

Change `POSTGRES_PASSWORD` in `backend/.env` for your local environment. Do not commit that file.

Start and inspect the services from the project root:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

Run database migrations and tests inside the backend container:

```bash
docker compose exec backend alembic upgrade head
docker compose exec backend pytest
```

The test suite replaces the database dependency with a small test double, so it can run without making database changes. The live health check verifies the real Docker PostgreSQL connection.

Once the services are running, use:

- API root: http://localhost:8000/
- Health check: http://localhost:8000/api/health
- Interactive API docs: http://localhost:8000/docs

Stop the services while preserving PostgreSQL data:

```bash
docker compose down
```

To deliberately remove the named database volume as well, run `docker compose down --volumes`. This permanently removes local PostgreSQL data.
