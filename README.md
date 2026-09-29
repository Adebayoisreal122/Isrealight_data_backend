# VTU Backend (Node.js + Express + MongoDB)

Airtime, data, cable TV and electricity via VTpass, with a wallet funded through Paystack.

## Run it
1. `npm install`
2. Copy `.env.example` to `.env` and fill it in. Use **MongoDB Atlas** (free tier works) or a local replica set, because the wallet relies on MongoDB transactions.
3. `npm run seed:admin` to create your admin user.
4. `npm run dev`

## How money moves
- Balances are integer **kobo**. Only `services/wallet.js` changes a balance, always inside a MongoDB transaction with a ledger entry (`LedgerEntry.key` is unique, so every credit/debit is idempotent).
- **Funding:** `POST /api/wallet/fund` -> Paystack checkout -> webhook or `GET /api/wallet/fund/verify`. The server always re-verifies with Paystack before crediting.
- **Purchase:** wallet debit + transaction record are created atomically -> VTpass `pay` with our reference as `request_id` -> result stored.
  - success -> done
  - explicit failure -> automatic refund (idempotent)
  - timeout / processing -> stays `pending`. Resolved by the VTpass webhook (we requery to confirm), the 30s background worker, or the customer pressing "requery". We never refund on an unknown result.
- Prices for data and cable come from the `plans` collection, never from the client, and a plan is blocked if it would sell below cost.

## Endpoints
| Method | Path | Notes |
|---|---|---|
| POST | /api/auth/register, /login | GET /api/auth/me |
| GET | /api/wallet | balance + last 50 ledger entries |
| POST | /api/wallet/fund | `{ amount }` naira -> checkout URL |
| GET | /api/wallet/fund/verify?reference= | idempotent |
| GET | /api/plans?serviceID=mtn-data | public; agents see agent prices |
| POST | /api/purchase/verify | smartcard / meter name lookup |
| POST | /api/purchase | see below; send an `Idempotency-Key` header |
| GET | /api/transactions, /:reference | own transactions |
| POST | /api/transactions/:reference/requery | rate limited |
| POST | /api/webhooks/paystack, /vtpass | set these URLs in each dashboard |
| POST | /api/admin/plans/sync | `{ "serviceID": "mtn-data" }` pulls VTpass plans and applies markup |
| PATCH | /api/admin/plans/:id | prices in naira |
| POST | /api/admin/wallet/adjust | manual credit/debit |
| GET | /api/admin/transactions, /provider-balance | |

`POST /api/purchase` bodies:
```json
{ "type": "airtime", "serviceID": "mtn", "recipient": "08011111111", "amount": 100 }
{ "type": "data", "serviceID": "mtn-data", "recipient": "08011111111", "variationCode": "mtn-1gb-..." }
{ "type": "cable", "serviceID": "dstv", "recipient": "1212121212", "variationCode": "dstv-padi", "subscriptionType": "change" }
{ "type": "electricity", "serviceID": "ibadan-electric", "recipient": "1111111111111", "variationCode": "prepaid", "amount": 2000 }
```

## Check before going live
- Response-code mapping in `services/vtpass.js -> interpret()` against the VTpass **Response Codes** page.
- `request_id` format (`newRequestId`), the VTpass webhook payload/reply (`routes/webhooks.js`) and the `/balance` + `/merchant-verify` endpoints against the current VTpass docs.
- Test every path in the sandbox: success, failure, pending, duplicate submit, webhook retry.

## Not built yet
Transaction PIN, email/phone verification and password reset, agent upgrade flow, per-user rate limits on purchases, admin UI, automated tests, and logging/monitoring.
