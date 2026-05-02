# Doctor Consulting Backend

Node.js + Express backend for single-doctor online consultation platform.

---

## Required Environment Variables

### Core
```
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://...
JWT_SECRET=...
JWT_EXPIRES_IN=7d
```

### Admin
```
ADMIN_NAME=Doctor Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=...
```

### Razorpay
```
RAZORPAY_KEY_ID=rzp_...
RAZORPAY_KEY_SECRET=...
```

### Interakt WhatsApp
```
INTERAKT_API_KEY=
INTERAKT_API_BASE_URL=https://api.interakt.ai/v1/public
INTERAKT_WEBHOOK_SECRET=
INTERAKT_DEFAULT_COUNTRY_CODE=91
```

### Cashfree Payment Links
```
PAYMENT_PROVIDER=cashfree
CASHFREE_ENV=sandbox
CASHFREE_APP_ID=
CASHFREE_SECRET_KEY=
CASHFREE_API_VERSION=2025-01-01
CASHFREE_WEBHOOK_SECRET=
CONSULTATION_FEE=500
MAX_DAILY_TOKENS=20
APP_BASE_URL=https://your-domain.com
```

### Agora RTC
```
AGORA_APP_ID=...
AGORA_APP_CERTIFICATE=...
```

### Agora Cloud Recording (RESTful API)
Get from: Agora Console → RESTful API → Add a secret
```
AGORA_CUSTOMER_ID=...
AGORA_CUSTOMER_SECRET=...
```

### Agora Cloud Recording Storage (AWS S3)
```
AGORA_RECORDING_VENDOR=aws
AGORA_RECORDING_REGION=10        # 10 = ap-south-1 (Mumbai). See region codes below.
AGORA_RECORDING_BUCKET=your-bucket-name
AGORA_RECORDING_ACCESS_KEY=AKIA...
AGORA_RECORDING_SECRET_KEY=...
```

**Agora S3 Region Codes:**
| Code | AWS Region |
|------|-----------|
| 0    | us-east-1 |
| 1    | us-east-2 |
| 2    | us-west-1 |
| 3    | us-west-2 |
| 4    | eu-west-1 |
| 5    | ap-southeast-1 |
| 6    | ap-northeast-1 |
| 7    | ap-southeast-2 |
| 8    | eu-central-1 |
| 9    | ap-northeast-2 |
| 10   | ap-south-1 (Mumbai) |

### AWS S3 (for prescription PDFs)
```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
AWS_BUCKET=your-bucket-name
```

### Firebase (FCM push notifications)
```
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

---

## AWS S3 Setup for Agora Cloud Recording

### 1. Create S3 Bucket
- Region: ap-south-1 (Mumbai)
- Block all public access: ON
- Versioning: optional

### 2. IAM User Permissions
Create IAM user `agora-recording` with this policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    }
  ]
}
```

### 3. Enable Agora Cloud Recording
1. Agora Console → Project Management
2. Find your project → Edit (pencil icon)
3. Cloud Recording → **Enable**
4. Enable Cloud Recording → Apply

---

## Recording Flow

```
start-call
  → acquire resource (Agora)
  → start recording (mode: mix)
  → save resourceId + sid + recordingStatus='starting'
  → schedule query after 20s
    → if query OK: recordingStatus='recording'
    → if query fails: recordingStatus='failed'

end-call
  → mark call ended immediately (non-blocking)
  → background: stop recording
    → retry up to 5x with 6s delay on 404
    → on success: save recordingUrl + recordingFiles + recordingStatus='completed'
    → on failure: save recordingStatus='failed' + recordingError

fetch-recording-url (admin poll)
  → if recordingUrl exists: return it
  → else: query Agora → return URL or 'uploading'
```

**Recording files appear in S3 at:**
```
s3://your-bucket/recordings/<appointmentId>/<files>
```

---

## Testing Steps

1. Create and confirm an appointment
2. Start call from admin panel
3. Patient joins from Flutter app
4. **Keep call active for at least 60 seconds** (Agora worker needs time)
5. End call from admin panel
6. Wait 1-3 minutes for S3 upload
7. Click "Fetch recording URL" in admin panel
8. Check S3 bucket under `recordings/<appointmentId>/`

## WhatsApp Offline Booking Setup

### 1. Interakt setup
- Go to Developer Settings.
- Copy Secret Key into `INTERAKT_API_KEY`.
- Configure webhook URL: `https://your-domain.com/api/interakt/webhook`.
- Add webhook secret: same as `INTERAKT_WEBHOOK_SECRET`.
- Select: Others -> Message received from customers. Template message statuses are optional.

### 2. Cashfree setup
- Add Client ID to `CASHFREE_APP_ID`.
- Add Client Secret to `CASHFREE_SECRET_KEY`.
- Configure webhook: `https://your-domain.com/api/cashfree/webhook`.
- Enable payment link paid/payment success events.

### 3. Test flow
- Send `Hi` to the WhatsApp number.
- Enter name, age, and city.
- Receive the Cashfree payment link.
- Pay the link.
- Receive token confirmation on WhatsApp.
- Check `/admin/whatsapp-bookings` in the admin panel.

---

## Debug Endpoint

```
GET /api/agora/admin/recording-status/:appointmentId
Authorization: Bearer <admin-token>
```

Returns full recording state including resourceId, sid, recordingStatus, error, last query response, expected S3 prefix.

---

## Recording UID

Fixed at `999999` — must not match doctor UID (1) or patient UID (2).
Used consistently across: acquire → start → query → stop.
