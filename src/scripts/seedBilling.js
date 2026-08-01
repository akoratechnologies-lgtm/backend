// Run once, from the backend folder:
//   node src/scripts/seedBilling.js
//
// Populates CoinPack/SubscriptionPlan with the same values that used to be
// hardcoded in src/constants/billing.js, so nothing breaks on day one. Safe
// to re-run — it skips any slug that already exists rather than duplicating.

require('dotenv').config();
const mongoose = require('mongoose');
const CoinPack = require('../models/CoinPack');
const SubscriptionPlan = require('../models/SubscriptionPlan');

const COIN_PACKS = [
  { slug: 'pack_100', coins: 100, bonusLabel: null, priceInPaise: 9900, sortOrder: 1 },
  { slug: 'pack_550', coins: 550, bonusLabel: '+10% bonus', priceInPaise: 49900, sortOrder: 2 },
  { slug: 'pack_1200', coins: 1200, bonusLabel: '+20% bonus', priceInPaise: 99900, sortOrder: 3 },
  { slug: 'pack_6500', coins: 6500, bonusLabel: '+30% bonus', priceInPaise: 499900, sortOrder: 4 },
];

const SUBSCRIPTION_PLANS = [
  { slug: 'monthly', label: 'Monthly', period: '/mo', durationDays: 30, priceInPaise: 49900, tag: null, sortOrder: 1 },
  { slug: 'quarterly', label: 'Quarterly', period: '/3mo', durationDays: 90, priceInPaise: 129900, tag: 'Popular', sortOrder: 2 },
  { slug: 'yearly', label: 'Yearly', period: '/yr', durationDays: 365, priceInPaise: 399900, tag: 'Best Value', sortOrder: 3 },
  { slug: 'lifetime', label: 'Lifetime', period: 'one-time', durationDays: null, priceInPaise: 999900, tag: null, sortOrder: 4 },
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  for (const pack of COIN_PACKS) {
    const existing = await CoinPack.findOne({ slug: pack.slug });
    if (existing) {
      console.log(`Skipping existing coin pack: ${pack.slug}`);
      continue;
    }
    await CoinPack.create(pack);
    console.log(`Created coin pack: ${pack.slug}`);
  }

  for (const plan of SUBSCRIPTION_PLANS) {
    const existing = await SubscriptionPlan.findOne({ slug: plan.slug });
    if (existing) {
      console.log(`Skipping existing plan: ${plan.slug}`);
      continue;
    }
    await SubscriptionPlan.create(plan);
    console.log(`Created plan: ${plan.slug}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});