import { connectDb } from '../config/db.js';
import { env } from '../config/env.js';
import { Admin } from '../models/Admin.js';
import { DoctorSetting } from '../models/DoctorSetting.js';

await connectDb();

const admin = await Admin.findOne({ email: env.admin.email });
if (!admin) {
  await Admin.create({ name: env.admin.name, email: env.admin.email, password: env.admin.password });
  console.log(`Admin created: ${env.admin.email}`);
} else {
  console.log(`Admin already exists: ${env.admin.email}`);
}

await DoctorSetting.findOneAndUpdate({}, {}, { upsert: true, new: true, setDefaultsOnInsert: true });
console.log('Doctor settings ensured');
process.exit(0);
