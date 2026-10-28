# SPORTIQ payments: status, rules and activation checklist

**Honest status:** the PayHere card flow is built, but it has **not** been verified against a real PayHere sandbox transaction, and you told me your merchant account is with a *different* provider that I have no documentation for. Nothing provider-specific has been invented. Card payments must be treated as **not integrated** until the steps in section 5 are done.

## 1. What is implemented (and tested locally)
| Area | Behaviour |
|---|---|
| Card notification | Merchant ID, signature, order, amount and currency are all checked before anything is credited. Bad ones are refused and logged without the signature. Repeats are ignored. Oversized (>4 KB) or flooded requests are refused. |
| Never trusts the browser | The return page only shows "we update when the gateway confirms". Orders become paid only from a verified server notification or staff verification. |
| Bank transfer | Customer sends reference and optional receipt photo. Stays pending until named staff confirm. Receipt photos are stored privately (not in public uploads) and open only for logged-in staff. Duplicate references are refused. |
| Staff identity | Staff type their name at login (signed into the session cookie). Payment confirmations, rejections, refunds and the activity log record that name. The password is still shared, so this is accountability, not strong authentication. |
| Half / full payment | Deposit % is set in Admin > Settings (default 50) and applies to pre-order items only; ready-stock items and postage are always paid in full. Half payment is Sri Lanka only; abroad is full payment. Mixed carts follow that same rule. |
| Balance collection | Staff choose which methods are allowed in Admin > Settings: cash at pickup, cash on delivery, bank transfer, online card. If none is ticked, the deposit option disappears. The customer picks one at checkout; bank/online balance payments are refused server-side if disabled. |
| Records | Every payment stores order, provider, purpose (full / deposit / balance), expected amount and currency, received amount, status, provider reference, verified by, verified at, verification source, timestamps. Gateway events are logged against the payment. |
| Integrity | Transactions and row locks; idempotent order submission (double click or retry gives one order); one credit per payment; unique provider references; order paid amount can never exceed the total. |
| Overpayment / late / chargeback / mismatch | Opens an item in Admin > Payments for staff. The site does **not** send refunds: refund through your bank or provider, then record the reference. Original payments are never edited. |
| Admin | Admin > Payments shows online waiting / verified, bank to verify, part-paid orders and amounts owed, failed or cancelled, items needing review, and the full ledger. |

## 2. Not done, and why
- **Provider-specific card integration** for your actual provider: needs its official docs (see section 5).
- **Server-to-server status check** for PayHere: IMPLEMENTED from PayHere's published Retrieval API docs (OAuth `client_credentials`, then `payment/search?order_id=`), tested only against a local mock of that API, NOT against PayHere's real sandbox. See section 7.
- **Automatic refunds**: not built. Refunds are manual with a recorded reference.
- **Strong per-staff accounts and roles**: not built (shared password plus recorded name).
- **Replay protection by timestamp**: PayHere's notification has none. Duplicates are handled by idempotency instead.

## 3. Database changes
Migration 3 (applied automatically at start, once): adds columns to `payments`, `payment_events`, `orders`; adds table `reconciliation_items`; adds three settings. It never deletes or changes amounts. It only fills the new "how verified" columns for payments already marked successful. I tested it on a populated database: 5 orders, 4 successful payments and all totals were identical before and after. **Take a backup (`backup.sh`) before the first start of this version on your live database.**

## 4. Tests (e2e5-e2e8 need a local MariaDB socket at /tmp/mysql.sock and are run by hand; actual results, MariaDB 10.6, local, PayHere signature simulated)
All of these passed on the last run: checkout and inventory regression (e2e2, e2e3, e2e4), PayHere flow incl. duplicate/late/cancelled/wrong signature/half payment (e2e5, e2e6), two buyers racing for the last unit and admin content (e2e7), and the payment suite (e2e8): double submit makes one order; receipt stored privately and refused to the public; staff name recorded; bank confirmation required; overpayment capped and flagged then resolved with a refund reference; repeated notification harmless; wrong amount rejected and flagged once; oversized request refused; no signature in the event log; another customer's order not reachable; deposit then balance by bank transfer; no deposit option when no balance method is allowed.
**Not tested (unverified):** any real provider sandbox; real card or bank flows; PayHere's own browser redirects; real phones.

## 5. What you must do
1. Send me your provider's **name** and its **official integration docs** (create payment, signature/webhook, status lookup, refunds, sandbox URL and test keys, LKR support). I will then add the adapter and test it against the sandbox.
2. If the provider is PayHere after all: create a **sandbox** merchant, set `PAYHERE_MODE=sandbox`, `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, give PayHere the notify URL `https://YOURDOMAIN/api/payhere/notify`, and do one test payment end to end. Check that the order only turns paid after the notification and that Admin > Payments shows it.
3. In Admin > Settings choose the deposit % and which balance methods you really offer.
4. Back up, deploy, and test one bank transfer and one cancelled payment yourself.

## 6. Production activation checklist (needs your approval)
- [ ] Provider sandbox transaction verified end to end (success, failure, cancel)
- [ ] `PAYHERE_MODE=live` (or the new provider's live mode) set by you, not automatically
- [ ] Live keys only in the server `.env`, never in the code or zip
- [ ] HTTPS working; notify URL reachable from the internet
- [ ] Bank details correct in `.env`; backup tested and a restore rehearsed
- [ ] Admin password hash and `SESSION_SECRET` set; `SEED_DEMO_DATA=false`
- [ ] One real low-value live payment made by you and refunded through the provider

## 7. Independent status verification (PayHere Retrieval API)
Before a signed "paid" notification (status 2) credits an order, the server asks PayHere itself (`/merchant/v1/oauth/token`, then `/merchant/v1/payment/search?order_id=...`) and requires a record whose `payment_id` equals the notified one, `status` = `RECEIVED`, and the same currency and amount as the server-calculated charge. Outcomes: confirmed -> credited once; PayHere says otherwise -> refused (HTTP 400) and an `unverified_payment` item opens in Admin > Payments; PayHere unreachable -> not credited, HTTP 503 (so PayHere can resend) and a background job re-checks every few minutes for 24 h. Failed/cancelled/chargeback notices need no lookup and never credit.
Needs `PAYHERE_APP_ID` / `PAYHERE_APP_SECRET`; **required in live mode** (card payments stay off without them). Optional in sandbox. Duplicate, late (cancelled-order), mismatch and bad-signature handling is unchanged (suites e2e5-e2e8 still pass).
**Still to do by you before going live:** run one sandbox payment with real Business App credentials and confirm the field names in PayHere's real response match (the code follows PayHere's documentation: `data[].payment_id`, `status` = `RECEIVED`, `currency`, `amount`). If PayHere's real response differs, payments will be refused (fail-safe, never over-credited) and the error shows in Admin > Payments.
