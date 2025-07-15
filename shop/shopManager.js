const fs = require('fs');
const path = require('path');
const allItems = require('./allItems');

const DAILY_SHOP_PATH = path.join(__dirname, 'dailyShop.json');

/**
 * Get the featured items (always shown)
 */
function getFeaturedItems() {
  return allItems.filter(item => item.featured === true);
}

/**
 * Get daily randomized shop items (excluding featured/limited)
 * @param {number} count - number of daily items to select
 */
function pickDailyItems(count = 4) {
  const dailyPool = allItems.filter(item => !item.featured);
  const shuffled = dailyPool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get the daily shop: rotates only once per UTC day, persists to a file.
 */
function getDailyShop(count = 4) {
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
  const items = pickDailyItems(count);
  shopData = { date: today, items };
  fs.writeFileSync(DAILY_SHOP_PATH, JSON.stringify(shopData, null, 2));
  return items;
}

/**
 * Create the shop object for display
 */
function createShop() {
  return {
    featured: getFeaturedItems(),
    daily: getDailyShop(4)
  };
}

module.exports = {
  getFeaturedItems,
  getDailyShop,
  createShop
};
