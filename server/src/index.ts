import { createApp } from './app';
import { env } from './lib/env';
import { checkOverdueAllocations } from './services/overdue';
import { checkUpcomingBookingReminders } from './services/bookingReminder';

const OVERDUE_CHECK_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes
// Poll more often than the overdue check: the reminder window is only 30 min,
// so a 5-min cadence guarantees every upcoming slot is caught in time (dedup
// makes the extra runs harmless) while staying cheap.
const REMINDER_CHECK_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

async function main() {
  const app = createApp();

  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`\n  ⚡ AssetFlow API running on http://localhost:${env.port}`);
    console.log(`     Health check: http://localhost:${env.port}/api/health\n`);
  });

  // Overdue-return notifications: run once at startup, then periodically.
  // (checkOverdueAllocations never throws and dedupes per allocation.)
  checkOverdueAllocations().then((r) => {
    // eslint-disable-next-line no-console
    if (r.notified > 0) console.log(`  ⏰ Overdue check: ${r.notified} notification(s) sent`);
  });
  const overdueTimer = setInterval(() => checkOverdueAllocations(), OVERDUE_CHECK_INTERVAL_MS);

  // Booking reminders: same pattern — run once at startup, then periodically.
  // (checkUpcomingBookingReminders never throws and dedupes per booking.)
  checkUpcomingBookingReminders().then((r) => {
    // eslint-disable-next-line no-console
    if (r.notified > 0) console.log(`  🔔 Booking reminders: ${r.notified} reminder(s) sent`);
  });
  const reminderTimer = setInterval(() => checkUpcomingBookingReminders(), REMINDER_CHECK_INTERVAL_MS);

  const shutdown = () => {
    // eslint-disable-next-line no-console
    console.log('\nShutting down...');
    clearInterval(overdueTimer);
    clearInterval(reminderTimer);
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server', err);
  process.exit(1);
});
