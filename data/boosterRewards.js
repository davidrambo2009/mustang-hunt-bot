const Garage = require('./models/garage'); // Update this path if your model is elsewhere

const BOOSTER_THEME = "Garage Theme: Nitro Booster";
const BOOSTER_TITLE = "Title: Discord Booster";
const BOOSTER_CAR = "Nitro Mustang";

/**
 * Grants booster rewards to a user.
 * - Always restores theme and title if missing.
 * - Only gives car if not currently owned.
 * @param {string} userId - Discord user ID
 * @param {object} guild - Discord Guild object (to fetch member & check booster status)
 * @param {string} boosterRoleId - (optional) Role ID for boosters if you use a role
 * @returns {Promise<{granted: boolean, changes: string[], reason?: string}>}
 */
async function grantBoosterRewards(userId, guild, boosterRoleId) {
  // Fetch member object
  const member = await guild.members.fetch(userId);

  // Check booster status
  const isBooster =
    member.premiumSince ||
    (boosterRoleId && member.roles.cache.has(boosterRoleId));
  if (!isBooster) return { granted: false, changes: [], reason: "Not a booster" };

  // Fetch garage
  let garage = await Garage.findOne({ userId });
  if (!garage) {
    // If garage doesn't exist, create a new one (customize default values if needed)
    garage = new Garage({
      userId,
      ownedThemes: [],
      ownedTitles: [],
      cars: [],
      // ...other fields
    });
  }

  let changes = [];

  // Always restore theme if missing
  if (!garage.ownedThemes.includes(BOOSTER_THEME)) {
    garage.ownedThemes.push(BOOSTER_THEME);
    changes.push("theme");
  }

  // Always restore title if missing
  if (!garage.ownedTitles.includes(BOOSTER_TITLE)) {
    garage.ownedTitles.push(BOOSTER_TITLE);
    changes.push("title");
  }

  // Only give the car if not currently owned
  const ownsBoosterCar = garage.cars.some(car => car.name === BOOSTER_CAR);
  if (!ownsBoosterCar) {
    garage.cars.push({ name: BOOSTER_CAR, serial: 1 }); // Add serial logic if needed
    changes.push("car");
  }

  // Save garage if any changes
  if (changes.length) await garage.save();

  return { granted: true, changes };
}

module.exports = { grantBoosterRewards };
