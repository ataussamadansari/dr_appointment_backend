import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Patient } from '../models/Patient.js';
import { DoctorSetting } from '../models/DoctorSetting.js';
import { Appointment } from '../models/Appointment.js';

/**
 * Migration script to add verification fields to existing data
 * 
 * This script:
 * 1. Updates all existing Patient records with isVerified=false and empty verificationHistory
 * 2. Updates all existing DoctorSetting records with allowNewPatients=false
 * 3. Updates all existing Appointment records with isReturningPatient=true
 * 
 * Uses MongoDB transactions for atomicity to ensure all updates succeed or none do.
 */

async function migrateVerificationFields() {
  let connection = null;
  
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    mongoose.set('strictQuery', true);
    connection = await mongoose.connect(env.mongoUri);
    console.log('MongoDB connected successfully');
    
    // Start a session for transaction
    const session = await mongoose.startSession();
    console.log('Starting transaction...');
    
    try {
      await session.withTransaction(async () => {
        // Update all existing Patient records
        console.log('Updating Patient records...');
        const patientResult = await Patient.updateMany(
          { isVerified: { $exists: false } },
          { 
            $set: { 
              isVerified: false,
              verificationHistory: []
            } 
          },
          { session }
        );
        console.log(`Updated ${patientResult.modifiedCount} Patient records`);
        
        // Update all existing DoctorSetting records
        console.log('Updating DoctorSetting records...');
        const settingResult = await DoctorSetting.updateMany(
          { allowNewPatients: { $exists: false } },
          { $set: { allowNewPatients: false } },
          { session }
        );
        console.log(`Updated ${settingResult.modifiedCount} DoctorSetting records`);
        
        // Update all existing Appointment records
        // Assume all existing appointments were from returning patients
        console.log('Updating Appointment records...');
        const appointmentResult = await Appointment.updateMany(
          { isReturningPatient: { $exists: false } },
          { $set: { isReturningPatient: true } },
          { session }
        );
        console.log(`Updated ${appointmentResult.modifiedCount} Appointment records`);
        
        console.log('\nMigration Summary:');
        console.log(`- Patients updated: ${patientResult.modifiedCount}`);
        console.log(`- DoctorSettings updated: ${settingResult.modifiedCount}`);
        console.log(`- Appointments updated: ${appointmentResult.modifiedCount}`);
        console.log('\nTransaction committed successfully');
      });
      
      console.log('Migration completed successfully!');
      
    } catch (transactionError) {
      console.error('Transaction failed and was rolled back:', transactionError);
      throw transactionError;
    } finally {
      await session.endSession();
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    if (connection) {
      await mongoose.connection.close();
      console.log('Database connection closed');
    }
  }
}

/**
 * Verify migration results
 * This function can be called after migration to verify the changes
 */
async function verifyMigration() {
  try {
    console.log('\nVerifying migration results...');
    
    // Connect to MongoDB
    mongoose.set('strictQuery', true);
    await mongoose.connect(env.mongoUri);
    
    // Check Patient records
    const patientsWithoutVerification = await Patient.countDocuments({
      $or: [
        { isVerified: { $exists: false } },
        { verificationHistory: { $exists: false } }
      ]
    });
    console.log(`Patients without verification fields: ${patientsWithoutVerification}`);
    
    // Check DoctorSetting records
    const settingsWithoutAllowNewPatients = await DoctorSetting.countDocuments({
      allowNewPatients: { $exists: false }
    });
    console.log(`DoctorSettings without allowNewPatients field: ${settingsWithoutAllowNewPatients}`);
    
    // Check Appointment records
    const appointmentsWithoutReturningPatient = await Appointment.countDocuments({
      isReturningPatient: { $exists: false }
    });
    console.log(`Appointments without isReturningPatient field: ${appointmentsWithoutReturningPatient}`);
    
    if (patientsWithoutVerification === 0 && 
        settingsWithoutAllowNewPatients === 0 && 
        appointmentsWithoutReturningPatient === 0) {
      console.log('\n✅ Migration verification passed! All records have been updated.');
    } else {
      console.log('\n⚠️  Migration verification found issues. Some records may need manual update.');
    }
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.includes('--verify')) {
    verifyMigration();
  } else {
    migrateVerificationFields();
  }
}

export { migrateVerificationFields, verifyMigration };
