import Stripe from 'stripe';
import { env } from './env.js';

let stripe;

export function getStripe() {
  if (!env.stripe.secretKey) {
    throw new Error('STRIPE_SECRET_KEY is required for Stripe payments.');
  }

  if (!stripe) {
    stripe = new Stripe(env.stripe.secretKey);
  }

  return stripe;
}

