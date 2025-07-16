const Garage = require('./models/garage'); // Update this path if your model is elsewhere

const BOOSTER_CAR = "Nitro Mustang";

/**
 * Grants booster car to a server booster.
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
    garage = new Garage({
      userId,
      cars: [],
    });
  }

  let changes = [];

  // Array safety
  garage.cars = Array.isArray(garage.cars) ? garage.cars : [];

  // Only give the car if not currently owned
  const ownsBoosterCar = garage.cars.some(car => car.name === BOOSTER_CAR);
  if (!ownsBoosterCar) {
    garage.cars.push({ name: BOOSTER_CAR, serial: 1 });
    changes.push("car");
  }

  // Save garage if any changes
  if (changes.length) await garage.save();

  return { granted: true, changes };
}

module.exports = { grantBoosterRewards };
