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

## Inventory and stock movements API

`products.quantity` remains the live stock total, but existing product quantities cannot be changed through `PATCH /api/products/{id}`. Every post-creation quantity change must use the inventory API so the quantity update and immutable movement record commit atomically. `minimumQuantity` remains editable through the product endpoint.

Create manual stock-in and stock-out movements:

```bash
curl -X POST http://localhost:8000/api/inventory/movements/in \
  -H 'Content-Type: application/json' \
  -d '{"productId":1,"quantity":"10.500000","note":"Supplier delivery"}'

curl -X POST http://localhost:8000/api/inventory/movements/out \
  -H 'Content-Type: application/json' \
  -d '{"productId":1,"quantity":"2.000000","note":"Damaged stock"}'
```

Set the final counted quantity with an adjustment. A nonblank note is required:

```bash
curl -X POST http://localhost:8000/api/inventory/movements/adjustment \
  -H 'Content-Type: application/json' \
  -d '{"productId":1,"finalQuantity":"7.750000","note":"Physical stock count"}'
```

List or search immutable movement history:

```bash
curl 'http://localhost:8000/api/inventory/movements?page=1&pageSize=20'
curl 'http://localhost:8000/api/inventory/movements?productId=1&movementType=out'
curl 'http://localhost:8000/api/inventory/movements?search=INV-100'
```

View live inventory totals and low-stock products:

```bash
curl http://localhost:8000/api/inventory/summary
curl 'http://localhost:8000/api/inventory/low-stock?includeOutOfStock=true&limit=50'
```

Quantities and inventory values are returned as exact decimal strings. Public movement endpoints always create `manual` sources. Future sales services can use the non-committing internal movement method for `sale_invoice` and `sale_invoice_cancellation` records within a larger transaction.

## Sales invoice drafts API

Draft invoice numbers are generated by the backend when a draft is saved. A concurrency-safe database counter is maintained separately for each year and formatted as `INV-YYYY-0001`; deleting a draft never releases or reuses its number. The backend loads customer and product snapshots and calculates every line total, subtotal, total, and remaining amount.

Create a cash-sale draft:

```bash
curl -X POST http://localhost:8000/api/sales/invoices \
  -H 'Content-Type: application/json' \
  -d '{
    "customerId":null,
    "currency":"IQD",
    "note":"Draft sale",
    "discount":"1000",
    "paidAmount":"5000",
    "items":[
      {"productId":1,"quantity":"2.000000","unitPrice":"20000"}
    ]
  }'
```

List, search, and retrieve invoices:

```bash
curl 'http://localhost:8000/api/sales/invoices?page=1&pageSize=20'
curl 'http://localhost:8000/api/sales/invoices?search=INV-2026'
curl http://localhost:8000/api/sales/invoices/1
```

Update draft `1`. Supplied items replace its current item set atomically while its ID and invoice number remain unchanged:

```bash
curl -X PATCH http://localhost:8000/api/sales/invoices/1 \
  -H 'Content-Type: application/json' \
  -d '{
    "discount":"2000",
    "items":[
      {"productId":1,"quantity":"3.000000","unitPrice":"20000"}
    ]
  }'
```

Delete a draft and its draft items:

```bash
curl -X DELETE http://localhost:8000/api/sales/invoices/1
```

Drafts are planning records only. Creating, updating, or deleting a draft does not change product quantities, create stock movements, or alter customer balances.

Complete draft `1` using its saved items and totals:

```bash
curl -X POST http://localhost:8000/api/sales/invoices/1/complete
```

Completion locks all referenced products in ascending ID order, revalidates current stock, and atomically creates stock-out movements. For a selected customer it creates at most one net `debt` or `credit` transaction from `remainingAmount`; fully paid invoices create none. Cash invoices require `paidAmount >= total` and never create customer transactions.

Cancel completed invoice `1` while preserving all original audit records:

```bash
curl -X POST http://localhost:8000/api/sales/invoices/1/cancel \
  -H 'Content-Type: application/json' \
  -d '{"reason":"Customer returned the order"}'
```

Cancellation atomically creates stock-in reversal movements and voids the exact invoice-linked customer transaction when one exists. Original movements, transaction records, invoice items, totals, and completion timestamp remain unchanged. Duplicate completion and cancellation attempts are rejected without applying effects again.

Inspect lifecycle audit details, source-linked records, and currency-specific sales totals:

```bash
curl http://localhost:8000/api/sales/invoices/1
curl 'http://localhost:8000/api/inventory/movements?sourceType=sale_invoice&search=INV-2026-0001'
curl 'http://localhost:8000/api/customers/1/transactions?includeVoided=true'
curl 'http://localhost:8000/api/sales/summary?currency=IQD'
```

Sales summary totals include only currently completed invoices. Drafts and cancelled invoices are excluded, positive remaining balances are summed without allowing overpayments to reduce them, and IQD/USD are never converted.

## Frontend data-source architecture

The repository retains localStorage adapters for reference and controlled development use, but the mounted application now uses the coordinated API providers described below.

Copy the example configuration only when local overrides are needed:

```bash
cd frontend
cp .env.example .env
```

Available settings:

```dotenv
VITE_API_BASE_URL=http://localhost:8000/api
VITE_DATA_SOURCE=localStorage
```

`VITE_DATA_SOURCE` accepts `localStorage` or `api`. Missing or unsupported values safely select `localStorage`; API mode must not be enabled for the live application until all interconnected contexts are migrated together. The base URL is normalized centrally, so components do not hard-code backend addresses.

Run the opt-in products API validation script against a running backend:

```bash
cd frontend
npm run validate:products-api
```

The script checks health, lists products, creates a uniquely named temporary product, retrieves it, updates metadata, and deletes it in a `finally` cleanup block. It never reads or changes browser localStorage and is not part of normal tests.

### Customer and financial transaction repositories

Customer and financial transaction API repositories are also prepared but remain unmounted. Their DTO layer follows the backend’s camelCase JSON exactly, including decimal strings, correction and void audit fields, invoice source linkage, and independent IQD/USD balances. Mappers convert those DTOs to the existing frontend domain types while retaining API-only timestamps, effects, running balances, and balance statuses as separate metadata.

The customer repository supports search, pagination, optional balances, CRUD operations, safe all-page loading, and cancellation signals. The transaction repository supports filtered history, manual transaction creation, correction, voiding, and live balances. Public request DTOs deliberately provide no way to set `sourceType`, source IDs, void state, or correction audit fields.

Local repository adapters reuse the current `albaraa-ceramic-customers` and `albaraa-ceramic-customer-transactions` keys, the existing transaction migration parser, and the existing balance replay helpers. Active debt and `payment_paid` increase balances; active credit and `payment_received` decrease them; voided records have zero effect; IQD and USD are never mixed.

The active `CustomersProvider` is unchanged and continues using localStorage synchronously. API mode is not mounted because customer statements, sales invoice links, inventory, and dashboard behavior must move together to avoid mixed local/API accounting state.

No mutating customer validation script is included yet: the public API correctly prevents deleting customers with transaction history, and the project has no safe development-only rollback endpoint. Unit tests use mocked requests and in-memory storage, while live validation remains read-only:

```bash
curl http://localhost:8000/api/health
curl 'http://localhost:8000/api/customers?page=1&pageSize=20'
```

### Inventory and stock movement repositories

The inventory repository layer follows the same staged migration approach. Backend DTOs retain exact decimal strings, movement audit sources, product snapshots, timestamps, summary totals, and low-stock statuses. Strict mappers reject malformed or unsafe quantities, preserve the Arabic units `متر مربع` and `قطعة`, and enforce whole-number piece quantities when unit information is available.

`ApiInventoryRepository` supports live summaries, low-stock reporting, paginated and filtered movement history, movement details, stock-in, stock-out, and adjustments. Public request mapping includes only `productId`, quantity/final quantity, and note; source linkage and previous/new quantities remain backend-controlled. All-page loading uses the backend’s 100-row limit and rejects inconsistent pagination rather than looping indefinitely.

`LocalStorageInventoryRepository` reuses the existing `albaraa-ceramic-products` and `albaraa-ceramic-stock-movements` keys and the existing movement migration parser. Its summaries and mutations preserve the calculations currently used by `InventoryPage`. Movement results are enriched with current product data and safely fall back to the existing source reference and deleted-product labels when a product is unavailable.

The experimental `useApiInventory` hook remains unmounted. After a successful API mutation it refreshes summary, history, and low-stock data, and can invoke an `onInventoryChanged` callback so a future coordinated API provider can refresh products. It never patches product quantity directly.

The mounted `ProductsProvider`, Inventory page, sales finalization/cancellation, and dashboard remain on localStorage. Enabling inventory API mode independently would mix backend quantities with local sales and dashboard state, so the runtime switch remains disabled until those connected domains migrate together.

Read-only inventory validation:

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/inventory/summary
curl 'http://localhost:8000/api/inventory/movements?page=1&pageSize=20'
curl 'http://localhost:8000/api/inventory/low-stock?includeOutOfStock=true'
```
# Frontend sales repository architecture

The sales repository preserves the existing domain shapes used by printing and statements. The mounted application now selects the API data source as part of the coordinated cutover below.

The frontend now has exact sales API DTOs and strict decimal/timestamp mappers, a shared `SalesRepository` contract, API and local-storage implementations, and an unmounted `useApiSales` hook. In API mode invoice numbers are generated by the server, and completion/cancellation are single backend calls: the frontend does not duplicate stock or customer-account effects. The hook exposes an explicit lifecycle callback so products, inventory, customers, and dashboard can be refreshed together in a future coordinated cutover.

All interconnected contexts are now migrated together; the following read-only checks remain useful:

```bash
curl http://localhost:8000/api/health
curl 'http://localhost:8000/api/sales/invoices?page=1&pageSize=20'
curl 'http://localhost:8000/api/sales/summary?currency=IQD'
```

## API frontend and clean start

The mounted frontend now uses PostgreSQL-backed API providers. Configure `VITE_API_BASE_URL` and `VITE_DATA_SOURCE=api`; startup verifies `/api/health` before loading business data and never falls back to browser business data. Empty collections render as the normal clean-start state.

Old test data is not migrated or deleted automatically. In development, visit `/maintenance/clear-local-data`, type `DELETE LOCAL TEST DATA`, and remove only the listed application keys. PostgreSQL is unaffected.

To explicitly reset the development database (never production):

```bash
docker compose exec backend python scripts/reset_business_data.py --confirm-reset
```

The script displays row counts, requires the exact flag, refuses production, resets business-table identities, and preserves Alembic history. After starting services, smoke-test product creation, stock-in, customer creation, draft creation, completion, cancellation, invoice print, and customer statement print.
