# Backend

Node.js, Express, MongoDB, Mongoose backend for the single-doctor consultation system.

## Setup

```bash
cp .env.example .env
npm install
npm run seed:admin
npm run dev
```

## Main API Groups

- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp`
- `POST /api/auth/admin/login`
- `GET /api/appointments/next-day-slots`
- `POST /api/appointments`
- `POST /api/payments/order`
- `POST /api/payments/verify`
- `GET /api/admin/dashboard`
- `GET/PUT /api/admin/settings`
- `GET /api/admin/appointments`
- `GET /api/admin/appointments/:id`
- `POST /api/agora/admin/start-call`
- `POST /api/agora/admin/end-call`
- `POST /api/prescriptions`
- `POST /api/prescriptions/:id/send-whatsapp`

## Security

Patient APIs are scoped to the logged-in patient. Admin APIs require an admin JWT. Razorpay signatures are verified on the backend. Agora certificates, Razorpay secrets, WhatsApp tokens, and recording URLs are never exposed to patient clients.
