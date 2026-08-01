// Amounts are in paise (INR smallest unit) since that's what Razorpay's API
// expects. The client only ever sends an `id`; the actual price/coins/duration
// always comes from here, server-side — never trust amounts from the client.

const COIN_PACKS = [
  { id: 'pack_100', coins: 100, bonusLabel: null, priceInPaise: 9900, priceLabel: '₹99' },
  { id: 'pack_550', coins: 550, bonusLabel: '+10% bonus', priceInPaise: 49900, priceLabel: '₹499' },
  { id: 'pack_1200', coins: 1200, bonusLabel: '+20% bonus', priceInPaise: 99900, priceLabel: '₹999' },
  { id: 'pack_6500', coins: 6500, bonusLabel: '+30% bonus', priceInPaise: 499900, priceLabel: '₹4999' },
];

const SUBSCRIPTION_PLANS = [
  { id: 'monthly', label: 'Monthly', period: '/mo', durationDays: 30, priceInPaise: 49900, priceLabel: '₹499', tag: null },
  { id: 'quarterly', label: 'Quarterly', period: '/3mo', durationDays: 90, priceInPaise: 129900, priceLabel: '₹1299', tag: 'Popular' },
  { id: 'yearly', label: 'Yearly', period: '/yr', durationDays: 365, priceInPaise: 399900, priceLabel: '₹3999', tag: 'Best Value' },
  { id: 'lifetime', label: 'Lifetime', period: 'one-time', durationDays: null, priceInPaise: 999900, priceLabel: '₹9999', tag: null },
];

function findCoinPack(id) {
  return COIN_PACKS.find((p) => p.id === id);
}

function findPlan(id) {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id);
}

module.exports = { COIN_PACKS, SUBSCRIPTION_PLANS, findCoinPack, findPlan };