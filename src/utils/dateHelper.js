import moment from 'moment-timezone';

const TZ = 'Asia/Kolkata';

// Start of day (IST)
export const startOfDay = (date) => {
  return moment.tz(date, TZ).startOf('day').toDate();
};

// End of day (IST)
export const endOfDay = (date) => {
  return moment.tz(date, TZ).endOf('day').toDate();
};

// Next day (IST)
export const nextDayDate = () => {
  return moment().tz(TZ).add(1, 'day').startOf('day').toDate();
};

// Format a date as IST date string (YYYY-MM-DD) for display
export const toISTDateString = (date) => {
  return moment(date).tz(TZ).format('YYYY-MM-DD');
};

// Check next day (IST safe)
export const isNextDay = (date) => {
  return moment.tz(date, TZ).isSame(nextDayDate(), 'day');
};

// export const startOfDay = (date) => {
//   const d = new Date(date);
//   d.setHours(0, 0, 0, 0);
//   return d;
// };

// export const endOfDay = (date) => {
//   const d = new Date(date);
//   d.setHours(23, 59, 59, 999);
//   return d;
// };

// export const nextDayDate = () => {
//   const d = new Date();
//   d.setDate(d.getDate() + 1);
//   return startOfDay(d);
// };

// export const isNextDay = (date) => startOfDay(date).getTime() === nextDayDate().getTime();
