const fs = require('fs');
const path = require('path');
const allItems = require('./allItems');

const DAILY_SHOP_PATH = path.join(__dirname, 'dailyShop.json');
const EVENT_FEATURED_PATH = path.join(__dirname, 'eventFeaturedItems.json');

/**
 * Get event featured items that are still active
 */
function getEventFeaturedItems() {
  if (!fs.existsSync(EVENT_FEATURED_PATH)) return [];
  try {
    const now = new Date();
    const items = JSON.parse(fs.readFileSync(EVENT_FEATURED_PATH, 'utf8'));
    return items.filter(item => new Date(item.expiresAt) > now);
  } catch (e) {
    return [];
  }
}

/**
 * Get regular featured items (not limited/event, featured: true, and not duplicated with event items)
 */
function getRegularFeaturedItems(eventItemNames = []) {
  return allItems.filter(
    item =>
      item.featured === true &&
      !eventItemNames.includes(item.name)
  );
}

/**
 * Get daily randomized shop items (excluding all featured/event items)
 * @param {number} count - number of daily items to select
 */
function pickDailyItems(count = 4, excludeNames = []) {
  const dailyPool = allItems.filter(
    item => !item.featured && !excludeNames.includes(item.name)
  );
  const shuffled = dailyPool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get the daily shop: rotates only once per UTC day, persists to a file.
 */
function getDailyShop(count = 4, excludeNames = []) {
  let shopData = null;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Try reading the saved daily shop
  if (fs.existsSync(DAILY_SHOP_PATH)) {
    try {
      const raw = fs.readFileSync(DAILY_SHOP_PATH, 'utf8');
      shopData = JSON.parse(raw);
      if (shopData && shopData.date === today) {
        return shopData.items;
      }
    } catch (e) {
      // Ignore file errors and recreate file
    }
  }

  // Otherwise, pick new items for today and save
  const items = pickDailyItems(count, excludeNames);
  shopData = { date: today, items };
  fs.writeFileSync(DAILY_SHOP_PATH, JSON.stringify(shopData, null, 2));
  return items;
}

/**
 * Create the shop object for display
 */
function createShop() {
  const eventFeatured = getEventFeaturedItems();
  const eventNames = eventFeatured.map(item => item.name);
  const regularFeatured = getRegularFeaturedItems(eventNames);

  // Decide how many featured slots you want; here we combine both lists
  const featured = [...eventFeatured, ...regularFeatured];

  // Prevent any daily item from duplicating a featured item
  const excludeFromDaily = featured.map(item => item.name);

  return {
    featured,
    daily: getDailyShop(4, excludeFromDaily)
  };
}

module.exports = {
  getEventFeaturedItems,
  getRegularFeaturedItems,
  getDailyShop,
  createShop
};
