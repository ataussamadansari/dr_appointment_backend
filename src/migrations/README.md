# Database Migrations

This directory contains database migration scripts for the Patient Verification System.

## Available Migrations

### add-verification-fields.js

Adds verification-related fields to existing database records:
- Adds `isVerified` and `verificationHistory` fields to Patient records
- Adds `allowNewPatients` field to DoctorSetting records
- Adds `isReturningPatient` field to Appointment records

## Running Migrations

### Run the migration

```bash
cd backend
node src/migrations/add-verification-fields.js
```

### Verify migration results

```bash
cd backend
node src/migrations/add-verification-fields.js --verify
```

## Migration Details

### What the migration does:

1. **Patient Records**: Sets `isVerified = false` and `verificationHistory = []` for all existing patients
2. **DoctorSetting Records**: Sets `allowNewPatients = false` for all existing settings
3. **Appointment Records**: Sets `isReturningPatient = true` for all existing appointments (assumes they were from returning patients)

### Transaction Safety

The migration uses MongoDB transactions to ensure atomicity:
- All updates succeed together, or none are applied
- If any update fails, all changes are rolled back
- Safe to run multiple times (idempotent)

### Idempotency

The migration is idempotent and safe to run multiple times:
- Only updates records where the field doesn't exist (`{ field: { $exists: false } }`)
- Running it again will not modify already-migrated records

## Prerequisites

- MongoDB connection must be configured in `.env` file
- Database must be accessible
- Models must be updated with new fields before running migration

## Troubleshooting

### Connection Issues

If you see connection errors, verify:
- MongoDB is running
- `MONGO_URI` in `.env` is correct
- Network connectivity to database

### Transaction Errors

If transaction fails:
- Check MongoDB version (transactions require MongoDB 4.0+)
- Verify replica set is configured (required for transactions)
- Check database permissions

### Verification Failures

If verification shows missing fields:
- Re-run the migration
- Check database logs for errors
- Manually inspect records in MongoDB shell

## Rollback

To rollback the migration (remove added fields):

```javascript
// Run in MongoDB shell or create a rollback script
db.patients.updateMany({}, { $unset: { isVerified: "", verificationHistory: "" } });
db.doctorsettings.updateMany({}, { $unset: { allowNewPatients: "" } });
db.appointments.updateMany({}, { $unset: { isReturningPatient: "" } });
```

**Note**: Rollback is not recommended after the system goes live with the new fields.
