const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const Stripe = require('stripe');

dotenv.config();

const app = express();
const port = Number.parseInt(process.env.STRIPE_PORT || '4242', 10);
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  console.error('Missing STRIPE_SECRET_KEY in .env');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const isConfiguredOrigin = origin === frontendUrl;
    const isLocalhost = /^http:\/\/localhost:\d+$/.test(origin);

    if (isConfiguredOrigin || isLocalhost) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: false
}));

app.get('/api/payments/health', (_req, res) => {
  res.json({ ok: true, service: 'stripe-server' });
});

app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  if (!stripeWebhookSecret) {
    return res.status(500).json({ message: 'Missing STRIPE_WEBHOOK_SECRET in .env' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).json({ message: 'Missing Stripe signature header.' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
  } catch (error) {
    const message = error && error.message ? error.message : 'Invalid Stripe webhook signature.';
    return res.status(400).json({ message });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    // TODO: persist payment state in your real backend / DB.
    console.log('checkout.session.completed', {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      reservationId: session.metadata && session.metadata.reservationId ? session.metadata.reservationId : null
    });
  }

  return res.json({ received: true });
});

app.use(express.json());

app.post('/api/payments/create-checkout-session', async (req, res) => {
  try {
    const { reservationId, logementId, amountInCents, currency } = req.body || {};

    if (!reservationId || !logementId || !amountInCents || amountInCents <= 0) {
      return res.status(400).json({ message: 'Invalid payment payload.' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: typeof currency === 'string' ? currency : 'eur',
            product_data: {
              name: `Reservation ${reservationId}`,
              description: `Paiement logement ${logementId}`
            },
            unit_amount: Number(amountInCents)
          },
          quantity: 1
        }
      ],
      metadata: {
        reservationId: String(reservationId),
        logementId: String(logementId)
      },
      success_url: `${frontendUrl}/mes-reservations?payment=success&reservationId=${reservationId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/mes-reservations?payment=cancel&reservationId=${reservationId}`
    });

    return res.json({ sessionId: session.id, sessionUrl: session.url });
  } catch (error) {
    const message = error && error.message ? error.message : 'Stripe session creation failed.';
    return res.status(500).json({ message });
  }
});

app.post('/api/payments/create-payment-intent', async (req, res) => {
  try {
    const { reservationId, logementId, amountInCents, currency } = req.body || {};

    if (!reservationId || !logementId || !amountInCents || amountInCents <= 0) {
      return res.status(400).json({ message: 'Invalid payment payload.' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Number(amountInCents),
      currency: typeof currency === 'string' ? currency : 'eur',
      description: `Reservation ${reservationId} - Logement ${logementId}`,
      metadata: {
        reservationId: String(reservationId),
        logementId: String(logementId)
      }
    });

    return res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    const message = error && error.message ? error.message : 'Payment intent creation failed.';
    return res.status(500).json({ message });
  }
});

// ── REFUND ENDPOINT ─────────────────────────────────────────────────────────
// Politique de remboursement :
//   > 5 jours avant check-in : 100%
//   2–5 jours                 : 50%
//   < 48h                     : 0%  (refusé côté Angular avant d'arriver ici)
app.post('/api/payments/refund', async (req, res) => {
  try {
    const { paymentIntentId, amountInCents, reservationId } = req.body || {};

    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return res.status(400).json({ message: 'paymentIntentId manquant ou invalide.' });
    }
    if (!amountInCents || Number(amountInCents) <= 0) {
      return res.status(400).json({ message: 'Montant de remboursement invalide.' });
    }

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: Number(amountInCents),
      reason: 'requested_by_customer',
      metadata: {
        reservationId: reservationId ? String(reservationId) : 'unknown'
      }
    });

    return res.json({
      refundId: refund.id,
      status: refund.status,
      amountRefunded: refund.amount,
      currency: refund.currency
    });
  } catch (error) {
    const message = error && error.message ? error.message : 'Stripe refund failed.';
    return res.status(500).json({ message });
  }
});

app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ message: 'Invalid JSON payload.' });
  }
  return next(error);
});

app.listen(port, () => {
  console.log(`Stripe server is running on http://localhost:${port}`);
});
