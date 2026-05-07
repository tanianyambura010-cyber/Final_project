# Backend Architecture

The backend is organized as a modular Express API:

```text
src/
  app.js                 Express app composition
  server.js              HTTP and Socket.IO startup
  config/                Environment and MySQL pool
  constants/             Roles and order statuses
  middleware/            Auth, validation, errors
  modules/
    auth/                Registration, login, current user
    menu/                Menu catalogue and availability
    users/               Admin user and staff role management
    orders/              Order placement, assignment, lifecycle
    riders/              Rider profiles and status
    payments/            Stripe PaymentIntent and webhook handling
    tracking/            Live GPS tracking
    analytics/           Daily cafe performance
```

## Data Flow

1. Customer browses menu and creates an order with GPS coordinates.
2. Backend recalculates prices from the database and stores the order in a transaction.
3. Payment record is created as pending with `stripe` as the only payment method.
4. Customer pays through Stripe, then Stripe webhook/sync updates the local payment state.
5. Staff prepares food and assigns a rider after payment confirmation.
6. Rider updates delivery state and streams GPS coordinates over Socket.IO.
7. Customer tracks the rider in real time from the React Native mobile/web app.

## Main Tables

- `users`: customers, staff, riders, and admins using one role field.
- `menu_items`: available food and drink catalogue.
- `rider_profiles`: delivery-specific information for rider users.
- `orders`: delivery address, coordinates, totals, status, and payment state.
- `order_items`: item snapshots preserving historical prices.
- `payments`: payment method, status, and provider reference.
- `rider_locations`: audit trail of GPS updates.

## Redis Usage

Redis is required for fast access to the latest rider GPS location per active order. MySQL still stores the rider location audit trail, while Redis stores the current location with a TTL configured by `TRACKING_LOCATION_TTL_SECONDS`.

## Stripe Usage

Stripe is the only payment provider. Orders create pending `stripe` payment records, `/payments/orders/:orderId/stripe-intent` creates the PaymentIntent, and the Stripe webhook marks orders as paid or failed.

## Security

- Passwords are hashed with bcrypt.
- API authentication uses JWT bearer tokens.
- Role-based access control protects staff, rider, and customer endpoints.
- Order prices are recalculated server-side to prevent client-side tampering.
- User-submitted payloads are validated with Zod.

## Local Runtime Requirements

- Node.js LTS and npm.
- MySQL Server.
- Redis Server.
- Stripe secret key and webhook secret.
- A `.env` file copied from `.env.example`.
