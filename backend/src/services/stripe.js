import Stripe from 'stripe';

let _client;

function getStripe() {
  if (!_client) _client = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
  return _client;
}

export default new Proxy({}, {
  get(_, prop) {
    return getStripe()[prop];
  },
});
