# Cafe Direct

Cafe Direct is a cross-platform food delivery system for small cafes. The backend starts as a Node.js + Express API with MySQL persistence and real-time rider tracking support for a future React Native + Expo mobile/web frontend.

## Project Layout

```text
backend/   Express API, database schema, API docs
frontend/  Expo React Native app for mobile and web
```

## Backend Quick Start

Prerequisites:

- Node.js LTS with npm available in the terminal.
- MySQL Server running locally or remotely.
- Redis running locally or remotely.

```bash
cd backend
npm install
npm run dev
```

Create the MySQL database, then run:

```bash
mysql -u root -p cafe_direct < database/schema.sql
mysql -u root -p cafe_direct < database/seed.sql
```

The API will run at `http://localhost:4000/api/v1`.

## Frontend Quick Start

```bash
cd frontend
npm install
npm run web
```

The frontend reads the backend URL from:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

For a physical phone, replace `localhost` with your computer's local network IP address.

Current frontend flow:

- Login or register.
- Customer home screen with cafe branding, category shortcuts, featured meals, and cart preview.
- Browse, search, and filter available menu items.
- Mobile-app style header, bottom navigation, food imagery, and profile screen inspired by the provided CafeFresh references.
- Add items to cart.
- Update quantities, remove items, add delivery notes, and view totals.
- Submit checkout details to create backend orders.
- Prepare Stripe payment intents and sync Stripe payment status.
- View order history with delivery and payment status.
- Open a full order detail view with items, totals, delivery details, and map preview.
- Staff/admin users can view incoming orders, inspect order details, progress order status, track active deliveries, assign riders, manage menu items, and review analytics.
- Rider users can view assigned deliveries, inspect delivery details, share live GPS, and update delivery progress.
- Checkout and order tracking include Google Maps previews when a Maps API key is configured.
- Riders can share live GPS from their delivery cards, and customers/staff can watch updates on the order tracking screen.
- Staff/admin analytics include orders today, revenue, active riders, pending orders, popular foods, delivery performance, and recent orders.
