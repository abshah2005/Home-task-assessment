 # HomeTask at One More Game

 A simple blockchain learning project with an Express backend and a React frontend. This README reflects recent changes made to the repo (startup fee computation, added helper, and security notes).

 See also: [INSTRUCTIONS.md](./INSTRUCTIONS.md) and [SETUP.md](./SETUP.md).

 ## Project overview

 - Backend: Node.js + Express — API lives in the repository root and serves the built React app in production.
 - Frontend: React (create-react-app / `react-scripts`) — source under `src/`.

 Core folders:
 - `config/` — runtime configuration (ports, blockchain defaults, fee defaults)
 - `models/` — domain classes (Block, Transaction, Blockchain)
 - `controllers/`, `routes/`, `middleware/` — normal Express layering
 - `utils/` — helpers including `logger.js`, `response.js`, and `fee.js`
 - `src/` — React app

 ---

 ## Getting started

 ### Prerequisites

 - Node.js v16+ (v18 or v22 recommended)
 - npm

 ### Install

 ```powershell
npm install
 ```

 Note: `npm install` may report vulnerabilities from transitive dependencies — review `npm audit` as appropriate.

 ### Run the app in development

 Open two terminals:

 Terminal 1 — React dev server (http://localhost:3000):
 ```powershell
 npm start
 ```

 Terminal 2 — API server with auto-reload (http://localhost:3002):
 ```powershell
 npm run dev
 ```

 The API server logs startup information and computes a startup fee (logged as `Startup Fee : <value>`). The React dev server proxies `/api/*` requests to the API in development via `src/setupProxy.js`.

 ### Production

 Build the frontend and serve from the API server on a single port:
 ```powershell
 npm run serve
 ```

 ---

 ## Configuration

 Main runtime config is in `config/index.js`. Relevant env vars:
 - `PORT` — API server port (default 3002)
 - `CORS_ORIGIN` — allowed origin for the frontend (default http://localhost:3000)
 - `BLOCKCHAIN_DIFFICULTY`, `BLOCKCHAIN_MINING_REWARD` — blockchain tuning
 - `FEE_AMOUNT`, `FEE_PERCENTAGE` — controls startup fee computation

 ---

 ## API (short)

 The API follows the structure in the original task. Responses use a common envelope `{ success: true, ... }`.

 Important endpoints (examples):
 - GET `/api/chain`
 - POST `/api/wallets` — generates `{ publicKey, privateKey }` key pair
 - POST `/api/transactions` — body `{ fromAddress, toAddress, amount, timestamp, signature }`
 - POST `/api/mine` — body `{ miningRewardAddress }`
 - GET `/api/balance/:address`
 - GET `/health`

 See the `routes/` and `controllers/` folders for full details.

 ---

 ## Troubleshooting

 **Server crashes on boot**
 - Ensure dependencies are installed (`npm install`).

 **Port already in use**
 ```powershell
 $env:PORT='3003'; npm run dev
 ```

 **Frontend can't reach the API**
 - Confirm the API server is running and the port matches `src/setupProxy.js` (or your `PORT`).

 **Chain resets on restart**
 - The chain is persisted to `blockchain.json` in the project root. If the file is missing or
   corrupt the server starts fresh automatically. To force a reset, delete `blockchain.json`.

 ---

 ## Changes

 ### Task 1 — Cryptographic Wallet System

 **What was built:**

 - `POST /api/wallets` — generates a new EC P-256 key pair using Node.js built-in `crypto.generateKeyPairSync`.
   Returns `{ publicKey: "<hex DER SPKI>", privateKey: "<PEM PKCS8>" }`.
   The public key hex string doubles as the wallet address / `fromAddress`.
 - `Transaction.signTransaction(privateKeyPem)` — rewrote to use `crypto.sign('SHA256', data, key)`.
   Signs the raw concatenation `fromAddress + toAddress + amount + timestamp`.
 - `Transaction.isValid()` — removed the `return true` bypass for unsigned transactions.
   Now uses `crypto.verify('SHA256', data, publicKey, signature)` with the public key
   reconstructed from the DER SPKI hex stored in `fromAddress`.
 - `Blockchain.addTransaction()` — explicitly rejects unsigned transactions before
   calling `isValid()`.
 - `POST /api/transactions` — now requires `{ fromAddress, toAddress, amount, timestamp, signature }`.
   `timestamp` must match what was signed on the frontend; `signature` is the DER-encoded hex
   produced by the client.
 - **Frontend Wallet component** (`src/components/Wallet.js`) — calls `POST /api/wallets`,
   displays a truncated public key and a refreshable balance. The private key is held only in
   React state and never sent back to the server after the initial generation response.
 - **TransactionForm updated** — accepts a `wallet` prop. Signs the transaction client-side
   using the Web Crypto API (`ECDSA / P-256 / SHA-256`) before submission, converting the
   Web Crypto P1363 signature to the DER format expected by Node.js `crypto.verify`.

 **New env vars:** none — wallet generation uses only built-in crypto.

 **Demo seeding** is now disabled by default (`SEED_DEMO_DATA=true` re-enables it).
 Unsigned demo transactions would fail the new signature check.

 ---

 ### Task 2 — Blockchain Persistence

 **What was built:**

 - `services/persistence.service.js` — three exported functions:
   - `save(blockchain)` — async; serialises chain + pending transactions to `blockchain.json`
     via `fs/promises`. Errors are caught and logged; the server never crashes on a save failure.
   - `load()` — sync; reads and deserialises `blockchain.json` at startup, reconstructing proper
     `Block` and `Transaction` class instances so methods like `isValid()` and `calculateHash()`
     work correctly. Returns `null` on missing file, corrupt JSON, or a chain that fails
     `isChainValid()`.
   - `clear()` — async; deletes `blockchain.json`. Intended for tests / manual resets.
 - `models/index.js` — calls `load()` first; falls back to a fresh `Blockchain` if no valid
   state is found. Wraps `addTransaction` and `minePendingTransactions` on the singleton with a
   `withPersist` helper that fires `save()` after every successful mutation — controllers stay
   clean.
 - `blockchain.json` added to `.gitignore`.

 **New env vars:** none — the file path is fixed at `<project-root>/blockchain.json`.

 ---

 ### Known limitations and trade-offs

 - **Signature format compatibility** — the backend uses Node.js built-in `crypto` (ECDSA P-256),
   and the frontend uses the Web Crypto API. Web Crypto emits P1363 signatures (raw r‖s); Node.js
   expects DER. A `p1363ToDerHex` conversion function handles this in `TransactionForm.js`. If
   deployed to an environment where the DER encoding edge-cases (leading-zero padding) differ,
   signature verification could silently fail.
 - **Private key in React state** — the private key PEM string lives in component state for the
   lifetime of the browser session. It is never persisted (no `localStorage`) and never sent to
   the server after generation, but it is accessible to any JS running in the same page origin.
 - **Synchronous load at startup** — `persistence.service.load()` uses `fs.readFileSync` because
   it is called during CommonJS module initialisation. For a large chain this adds startup latency.
   An async init pattern (e.g. top-level `await` with ESM) would be cleaner but would require
   migrating the whole backend to ESM.
 - **Single-file persistence** — `blockchain.json` is overwritten on every save. There is no
   write-ahead log or atomic rename, so a crash mid-write could corrupt the file (handled
   gracefully by falling back to a fresh chain on next startup).
 - **No wallet persistence** — wallets exist only for the browser session. Refreshing the page
   loses the private key; any pending (unsigned) funds sent to that address become unreachable.

 ---

 ## License

 OMG — for learning and assessment purposes.
