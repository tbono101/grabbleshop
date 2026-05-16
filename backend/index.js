import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { runMigrations } from './src/models/schema.js';

import authRoutes     from './src/routes/auth.js';
import userRoutes     from './src/routes/users.js';
import sellerRoutes   from './src/routes/sellers.js';
import eventRoutes    from './src/routes/events.js';
import listingRoutes  from './src/routes/listings.js';
import claimRoutes    from './src/routes/claims.js';
import orderRoutes    from './src/routes/orders.js';
import paymentRoutes  from './src/routes/payments.js';
import shippingRoutes from './src/routes/shipping.js';
import webhookRoutes  from './src/routes/webhooks.js';

runMigrations();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));

// Stripe webhooks need raw body — mount before express.json()
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', service: 'grabbleshop-api', ts: new Date().toISOString() })
);

app.use('/api/auth',     authRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/sellers',  sellerRoutes);
app.use('/api/events',   eventRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/claims',   claimRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/shipping', shippingRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`GrabbleShop API → http://localhost:${PORT}`);
});
