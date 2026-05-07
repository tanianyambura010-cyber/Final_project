# Cafe Direct Backend API

Base URL: `/api/v1`

Authentication uses a bearer token:

```http
Authorization: Bearer <token>
```

## Health

`GET /health`

Checks that the API and database are reachable.

## Auth

`POST /auth/register`

Public customer registration. During development, the first admin can be created by sending `"role": "admin"` while `ALLOW_ADMIN_BOOTSTRAP=true`.

```json
{
  "name": "Cafe Admin",
  "email": "admin@cafedirect.test",
  "phone": "+254700000000",
  "password": "Admin123!",
  "role": "admin"
}
```

`POST /auth/login`

```json
{
  "email": "admin@cafedirect.test",
  "password": "Admin123!"
}
```

`GET /auth/me`

Returns the authenticated user.

## Menu

`GET /menu`

Public menu listing. Supports `category`, `available`, and `search` query parameters.

`POST /menu`

Admin/staff only.

```json
{
  "name": "Chicken Burger",
  "description": "Grilled chicken burger with fries.",
  "category": "Meals",
  "price": 650,
  "isAvailable": true
}
```

`PATCH /menu/:id`

Admin/staff only. Updates menu item details.

`PATCH /menu/:id/availability`

Admin/staff only.

```json
{
  "isAvailable": false
}
```

## Orders

`POST /orders`

Customer only. The frontend should capture the GPS location using React Native/Expo location APIs and send coordinates here.

```json
{
  "items": [
    { "menuItemId": 1, "quantity": 2 }
  ],
  "deliveryAddress": "JKUAT Main Gate, Juja",
  "deliveryLatitude": -1.101,
  "deliveryLongitude": 37.014,
  "deliveryNotes": "Call on arrival",
  "paymentMethod": "stripe"
}
```

`GET /orders`

Customers see their own orders. Riders see assigned orders. Staff/admin see all orders.

`GET /orders/:id`

Returns one order with its items.

`PATCH /orders/:id/assign-rider`

Admin/staff only.

```json
{
  "riderId": 1
}
```

`PATCH /orders/:id/status`

Admin/staff can update operational states. Riders can update assigned orders.

```json
{
  "status": "out_for_delivery"
}
```

## Users

`GET /users`

Admin only. Supports `role`, `active`, and `search` query parameters.

`PATCH /users/:id/role`

Admin only. Used to promote a registered customer account to staff.

```json
{
  "role": "staff"
}
```

`PATCH /users/:id/active`

Admin only.

```json
{
  "isActive": true
}
```

## Riders

`GET /riders`

Admin/staff only.

`POST /riders`

Admin/staff only. Converts an existing user account into a rider profile.

```json
{
  "userId": 3,
  "vehicleType": "Motorbike",
  "plateNumber": "KMDA 123B"
}
```

`GET /riders/me`

Rider only.

`PATCH /riders/me/status`

```json
{
  "currentStatus": "available"
}
```

## Payments

`GET /payments/orders/:orderId`

Returns the latest payment record for the order.

`POST /payments/orders/:orderId/stripe-intent`

Creates or reuses a Stripe PaymentIntent for the order. The frontend uses the returned `clientSecret` with Stripe's React Native SDK or Stripe.js on web.

```json
{
  "paymentIntent": {
    "id": "pi_...",
    "clientSecret": "pi_..._secret_...",
    "amount": 80000,
    "currency": "kes",
    "status": "requires_payment_method"
  }
}
```

`POST /payments/orders/:orderId/sync-stripe`

Retrieves the Stripe PaymentIntent and updates the local payment/order status if Stripe has completed or cancelled it.

`POST /payments/stripe/webhook`

Stripe webhook endpoint. Configure this URL in Stripe and set `STRIPE_WEBHOOK_SECRET` in `.env`. The backend listens for `payment_intent.succeeded`, `payment_intent.payment_failed`, and `payment_intent.canceled`.

## Tracking

`GET /tracking/orders/:orderId/latest`

Returns the latest rider location for an order if the current user can view that order. The latest location is stored in Redis and the historical audit trail is stored in MySQL.

Socket.IO events:

`order:track`

Customers, riders, and staff join the room for an order they can access.

```json
{
  "orderId": 1
}
```

`rider:location:update`

Riders broadcast GPS coordinates for an assigned order.

```json
{
  "orderId": 1,
  "latitude": -1.101,
  "longitude": 37.014,
  "heading": 90,
  "speed": 22
}
```

The server emits `rider:location` to everyone tracking that order.

## Analytics

`GET /analytics/daily`

Admin/staff only. Returns daily order count, revenue, average order value, and top-selling items.
