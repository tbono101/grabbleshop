import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'grabbleshop-api', ts: new Date().toISOString() });
});

// TODO: mount route modules here
// app.use('/api/auth',     authRoutes);
// app.use('/api/users',    userRoutes);
// app.use('/api/sellers',  sellerRoutes);
// app.use('/api/events',   eventRoutes);
// app.use('/api/listings', listingRoutes);
// app.use('/api/orders',   orderRoutes);
// app.use('/api/payments', paymentRoutes);
// app.use('/api/shipping', shippingRoutes);
// app.use('/api/webhooks', webhookRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`GrabbleShop API running on http://localhost:${PORT}`);
});
