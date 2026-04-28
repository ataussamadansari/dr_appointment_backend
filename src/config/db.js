import mongoose from 'mongoose';
import { env } from './env.js';

export const connectDb = async () => {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri);
  console.log('MongoDB connected');

  // Drop old unique index on CallLog.appointment if it exists
  // (was unique: true, now non-unique so doctor can restart calls)
  try {
    const db = mongoose.connection.db;
    const indexes = await db.collection('calllogs').indexes();
    const uniqueIdx = indexes.find(
      (i) => i.key?.appointment === 1 && i.unique === true
    );
    if (uniqueIdx) {
      await db.collection('calllogs').dropIndex(uniqueIdx.name);
      console.log('Dropped old unique index on CallLog.appointment');
    }
  } catch (_) {
    // Collection may not exist yet — ignore
  }
};
