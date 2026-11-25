# JacqueNgel POS

Point-of-sale, inventory and utang (credit) tracker for a sari-sari store.
Built with React + Vite + Tailwind, backed by Firebase (Auth + Firestore), hosted on Firebase Hosting.

**Live app:** https://jacquengel-pos.web.app

## Features

- **Sell** – tap products to add to cart, cash checkout with automatic sukli (change), quick cash buttons, receipt view.
- **Utang** – sell on credit to a customer (with optional partial payment), record payments, full per-customer history, total outstanding.
- **Inventory** – products with price, cost (puhunan), stock and low-stock alerts; restock, physical stock count / spoilage, stock history.
- **Reports** (owner) – sales, gross profit and margin, cash vs utang, sales per day, best sellers, sales per cashier, restock list, void a sale (returns stock and reverses utang).
- **Roles** – *Owner* has full access. *Cashier* can sell, add customers, record utang payments and view stock, but cannot change prices or inventory, or see reports. Enforced by `firestore.rules`.
- **Works offline** – sales, payments and restocks made without signal are saved on the phone and synced automatically when the connection returns.
- **Installable** – open the site on a phone and choose *Add to Home Screen*.

## First-time setup

1. Open the live app. The first screen is **Set up your store**: this creates the owner account (only works once).
2. Go to **Inventory → Add product** to add your products.
3. Go to **Settings → Staff → + Cashier** to create cashier logins.

## Development

```bash
npm install
npm run dev        # local dev server
npm run build      # production build into dist/
```

## Deploying

### Automatic (GitHub Actions)

Every push to `main` builds the app and deploys it to Firebase Hosting
(`.github/workflows/firebase-hosting-merge.yml`). Pull requests get a temporary preview URL.

The workflows need one repository secret, `FIREBASE_SERVICE_ACCOUNT_JACQUENGEL_POS`.
The easiest way to create it is to run this once from the project folder:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting:github
```

Answer: repository `traci12/jacquengel-pos`; *build script before deploy* → **Yes**, `npm ci && npm run build`;
*overwrite the workflow files* → **No** (the ones in this repo are already set up).
The command creates a Google service account and stores its key as the GitHub secret for you.

### Manual

```bash
npm run build
firebase deploy                     # hosting + Firestore rules + indexes
firebase deploy --only firestore    # rules / indexes only
```

> GitHub Actions only deploys **hosting**. If you change `firestore.rules` or
> `firestore.indexes.json`, run `firebase deploy --only firestore`.

## Data model (Firestore)

| Collection | Purpose |
|---|---|
| `meta/setup` | marks that the store has been set up (owner uid) |
| `settings/store` | store name, default low-stock level |
| `users/{uid}` | name, email, `role` (`owner` / `cashier`), `active` |
| `products` | name, category, price, cost, stock, lowStock, unit, barcode |
| `sales` | items, total, cost, profit, payment (`cash` / `utang`), cashier, voided |
| `customers` | name, phone, balance |
| `customers/{id}/ledger` | utang credits, payments and voids |
| `stockMoves` | restocks and stock counts (audit trail) |
