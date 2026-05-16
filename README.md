# GrabbleShop

**GrabbleShop** is a multi-seller Disney personal shopping live sale platform — purpose-built for Disney park shoppers who buy on behalf of fans worldwide and sell through live video auctions.

---

## What Is GrabbleShop?

Disney personal shoppers ("PSAs" — Personal Shopping Associates) attend Disney parks and resorts and live-stream sales events where customers can claim limited, hard-to-find, or park-exclusive merchandise in real time. GrabbleShop is the full operating system for that business:

- **Live sale management** — sellers run timed auctions and claim events while streaming
- **Multi-seller marketplace** — each seller has their own storefront, inventory, and payout account
- **Automated fulfillment** — shipping labels via EasyPost, sales tax via TaxJar, customer notifications via Resend and Twilio
- **Stripe Connect** — buyers pay the platform; sellers receive payouts automatically after each sale event
- **AI assistance** — Anthropic Claude powers product description generation, fraud detection flags, and seller analytics summaries

---

## Tech Stack

| Layer       | Technology                                      |
|-------------|--------------------------------------------------|
| Frontend    | React 18, Vite, Tailwind CSS, Zustand, React Router v6 |
| Backend     | Node.js, Express 5, better-sqlite3              |
| Database    | SQLite (via better-sqlite3)                     |
| Auth        | JWT (access + refresh tokens)                   |
| Payments    | Stripe + Stripe Connect                         |
| Shipping    | EasyPost                                        |
| Sales Tax   | TaxJar                                          |
| Email       | Resend                                          |
| SMS         | Twilio                                          |
| Media / CDN | Cloudflare Images / R2                          |
| AI          | Anthropic Claude (claude-sonnet-4-6)            |

---

## Project Structure

```
grabbleshop/
├── backend/
│   ├── src/
│   │   ├── controllers/    # Route handler logic
│   │   ├── middleware/     # Auth, validation, error handling
│   │   ├── models/         # SQLite schema & query helpers
│   │   ├── routes/         # Express router definitions
│   │   └── services/       # Third-party integrations (Stripe, EasyPost, etc.)
│   ├── data/               # SQLite database file (git-ignored)
│   ├── uploads/            # Temp media uploads (git-ignored)
│   ├── index.js            # Express entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Route-level page components
│   │   ├── services/       # API client functions
│   │   ├── store/          # Zustand global state stores
│   │   └── utils/          # Shared helpers
│   ├── index.html
│   └── package.json
├── .env.example            # All required environment variables
├── .gitignore
└── README.md
```

---

## Environment Variables

Copy `.env.example` to `.env` (never commit `.env`):

```bash
cp .env.example .env
```

| Variable                  | Purpose                                      |
|---------------------------|----------------------------------------------|
| `ANTHROPIC_API_KEY`       | Claude AI — descriptions, analytics, fraud   |
| `STRIPE_SECRET_KEY`       | Stripe server-side charges and Connect       |
| `STRIPE_PUBLISHABLE_KEY`  | Stripe frontend Elements                     |
| `TAXJAR_API_KEY`          | Real-time sales tax calculation              |
| `EASYPOST_API_KEY`        | Shipping label purchase and tracking         |
| `RESEND_API_KEY`          | Transactional email (receipts, tracking)     |
| `TWILIO_ACCOUNT_SID`      | SMS notifications to buyers                  |
| `TWILIO_AUTH_TOKEN`       | Twilio auth                                  |
| `CLOUDFLARE_API_KEY`      | Image uploads and CDN delivery               |
| `JWT_SECRET`              | Sign access and refresh tokens               |
| `DATABASE_URL`            | Path to SQLite file                          |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Install & Run

```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install

# Configure environment
cd .. && cp .env.example .env
# Edit .env with your real keys

# Start backend (port 3001)
cd backend && npm run dev

# Start frontend (port 5173) — in a separate terminal
cd frontend && npm run dev
```

### Backend API

The Express API runs on `http://localhost:3001`. Core route groups:

| Prefix          | Description                            |
|-----------------|----------------------------------------|
| `/api/auth`     | Register, login, refresh, logout       |
| `/api/users`    | Buyer and seller profile management    |
| `/api/sellers`  | Seller storefronts and onboarding      |
| `/api/events`   | Live sale event CRUD and scheduling    |
| `/api/listings` | Product listings within an event       |
| `/api/orders`   | Order placement, status, and history   |
| `/api/payments` | Stripe Checkout and Connect payouts    |
| `/api/shipping` | EasyPost label creation and tracking   |
| `/api/webhooks` | Stripe and EasyPost webhook handlers   |

---

## Key Concepts

### Live Sale Events

A **Sale Event** is a scheduled live stream session. Sellers create an event, add listings (products with photos, descriptions, and starting prices), then go live. Buyers watch the stream and claim items. The platform handles:

1. Real-time claim queue (WebSocket)
2. Automatic invoice generation
3. Stripe payment collection
4. TaxJar tax calculation per buyer address
5. EasyPost shipping label creation
6. Resend / Twilio buyer notifications

### Stripe Connect

Each seller completes Stripe Connect onboarding. When a buyer pays, the platform collects the full amount, deducts its commission, and automatically transfers the remainder to the seller's connected Stripe account.

### Multi-Seller Architecture

Every resource — events, listings, orders — is scoped to a `seller_id`. Platform admins can see all data; sellers see only their own.

---

## License

Private / proprietary. All rights reserved.
