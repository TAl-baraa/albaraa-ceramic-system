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

## Products API

Product API requests and responses use camelCase JSON names matching the frontend domain, including `minimumQuantity`, `sellPriceIqd`, `purchasePriceUsd`, `createdAt`, and `updatedAt`. Exact quantities and monetary values are returned as JSON strings so clients do not lose decimal precision; IDs and pagination counts remain JSON numbers.

Create a product:

```bash
curl -X POST http://localhost:8000/api/products \
  -H 'Content-Type: application/json' \
  -d '{
    "code": "CER-001",
    "name": "Ceramic Floor",
    "size": "60x60",
    "company": "Example Company",
    "unit": "متر مربع",
    "quantity": "25.500000",
    "minimumQuantity": "5.000000",
    "sellPriceIqd": "25000",
    "purchasePriceUsd": "8.7500"
  }'
```

List, paginate, and search products:

```bash
curl 'http://localhost:8000/api/products?page=1&pageSize=20'
curl 'http://localhost:8000/api/products?search=CER-001'
```

Retrieve, partially update, and delete product `1`:

```bash
curl http://localhost:8000/api/products/1
curl -X PATCH http://localhost:8000/api/products/1 \
  -H 'Content-Type: application/json' \
  -d '{"minimumQuantity":"7.000000"}'
curl -X DELETE http://localhost:8000/api/products/1
```

Product deletion is currently physical because no backend inventory or invoice relations exist. The deletion operation is isolated in the product service so it can later be replaced with archival or restricted deletion.

## Customers and financial transactions API

Customer balances are replayed from active transaction history. Positive balances mean the customer owes the store, negative balances mean the store owes the customer, and zero means settled. IQD and USD are always calculated independently. Transaction history includes active and voided records by default; use `includeVoided=false` to request active records only.

Create and search customers:

```bash
curl -X POST http://localhost:8000/api/customers \
  -H 'Content-Type: application/json' \
  -d '{"name":"Example Customer","phone":"07700000000","address":"Baghdad","notes":""}'

curl 'http://localhost:8000/api/customers?search=Example&page=1&pageSize=20&includeBalances=true'
```

Retrieve customer `1` and its independent balances:

```bash
curl 'http://localhost:8000/api/customers/1?includeBalances=true'
curl http://localhost:8000/api/customers/1/balances
```

Add debt and a received payment:

```bash
curl -X POST http://localhost:8000/api/customers/1/transactions \
  -H 'Content-Type: application/json' \
  -d '{"transactionType":"debt","amount":"25000","currency":"IQD","note":"Opening debt"}'

curl -X POST http://localhost:8000/api/customers/1/transactions \
  -H 'Content-Type: application/json' \
  -d '{"transactionType":"payment_received","amount":"10000","currency":"IQD","note":"Cash payment"}'
```

Correct transaction `1`. Its currency and source linkage are retained, the original is voided, and a linked replacement is created atomically:

```bash
curl -X POST http://localhost:8000/api/customers/1/transactions/1/correct \
  -H 'Content-Type: application/json' \
  -d '{"transactionType":"debt","amount":"20000","note":"Correct amount","reason":"Amount entered incorrectly"}'
```

Void transaction `2` without deleting its audit history:

```bash
curl -X POST http://localhost:8000/api/customers/1/transactions/2/void \
  -H 'Content-Type: application/json' \
  -d '{"reason":"Duplicate entry"}'
```

List newest-first history with chronologically calculated running balances:

```bash
curl 'http://localhost:8000/api/customers/1/transactions?includeVoided=true&includeRunningBalance=true&page=1&pageSize=20'
```

Exact transaction amounts and balances are serialized as JSON strings. IDs and pagination metadata remain JSON numbers. Invoice-linked transactions are readable but can only be created or changed by a trusted internal sales workflow.
