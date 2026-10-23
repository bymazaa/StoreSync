// MongoDB initialization script for StockPilot.
// Runs once, when the data directory is first created. Every other index is declared on the
// Mongoose schemas and built automatically on connect, so only what the schemas cannot express
// lives here: the application user, nullable-unique lookups, and the login throttle TTL.

db = db.getSiblingDB('stockpilot');

db.createUser({
  user: 'stockpilot_app',
  pwd: 'StockPilot@2026',
  roles: [{ role: 'readWrite', db: 'stockpilot' }],
});

// A sparse index still stores explicit nulls, which would make the second "no value" row a
// duplicate key error — a partial filter leaves those rows out of the index entirely.
const uniqueWhenSet = (field) => ({
  unique: true,
  partialFilterExpression: { [field]: { $type: 'string' } },
});

db.customers.createIndex({ phoneE164: 1 }, uniqueWhenSet('phoneE164'));
db.customers.createIndex({ email: 1 }, uniqueWhenSet('email'));
db.suppliers.createIndex({ phoneE164: 1 }, uniqueWhenSet('phoneE164'));
db.suppliers.createIndex({ email: 1 }, uniqueWhenSet('email'));
db.products.createIndex({ barcode: 1 }, { partialFilterExpression: { barcode: { $type: 'string' } } });
db.loginThrottles.createIndex({ lastAttemptAt: 1 }, { expireAfterSeconds: 3600 });

print('StockPilot database initialized: stockpilot_app user, contact lookups, throttle TTL.');
