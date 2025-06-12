const cars = [
  // Standard Mustangs & Modern Models
  { name: '2015 Mustang EcoBoost', rarity: 'Common', rarityLevel: 1, droppable: true },
  { name: '2018 Mustang GT', rarity: 'Uncommon', rarityLevel: 3, droppable: true },
  { name: '2019 Mustang GT', rarity: 'Uncommon', rarityLevel: 3, droppable: true },
  { name: '2020 Shelby GT500', rarity: 'Rare', rarityLevel: 6, droppable: true },
  { name: '2021 Mustang Mach 1', rarity: 'Rare', rarityLevel: 5, droppable: true },
  { name: '2024 Mustang GT', rarity: 'Uncommon', rarityLevel: 3, droppable: true },
  { name: '2024 Mustang Dark Horse', rarity: 'Epic', rarityLevel: 8, droppable: true },
  { name: '2024 Supercharged Mustang GT', rarity: 'Epic', rarityLevel: 7, droppable: true },
  { name: '2025 Mustang EcoBoost', rarity: 'Common', rarityLevel: 1, droppable: true },
  { name: '2025 Mustang GT 60th Anniversary', rarity: 'Rare', rarityLevel: 5, droppable: true },
  { name: '2025 GT350', rarity: 'Epic', rarityLevel: 8, droppable: true },
  { name: '2014 Mustang V6 Coupe', rarity: 'Common', rarityLevel: 1, droppable: true },
  { name: '2014 Mustang GT', rarity: 'Common', rarityLevel: 1, droppable: true },
  { name: '2019 Mustang EcoBoost Convertible', rarity: 'Common', rarityLevel: 1, droppable: true },
  { name: '2023 Mustang EcoBoost', rarity: 'Common', rarityLevel: 1, droppable: true },
  { name: '2023 Mustang Mach-E', rarity: 'Uncommon', rarityLevel: 4, droppable: true },
  { name: '2022 Mustang Mach-E GT', rarity: 'Rare', rarityLevel: 5, droppable: true },

  // Rarity Upgrades & Race Cars
  { name: '2024 Mustang GT3', rarity: 'Mythic', rarityLevel: 13, droppable: true },
  { name: '2024 Mustang GT4', rarity: 'Legendary', rarityLevel: 11, droppable: true },
  { name: '2025 Mustang GTD', rarity: 'Mythic', rarityLevel: 13, droppable: true },

  // Special/Limited/Event Cars
  { name: '2022 Mustang NASCAR Cup Car', rarity: 'LIMITED EVENT', rarityLevel: 0, droppable: false },

  // SVT & Cobras
  { name: '2000 SVT Cobra', rarity: 'Rare', rarityLevel: 5, droppable: true },
  { name: '2004 SVT Cobra', rarity: 'Epic', rarityLevel: 7, droppable: true },
  { name: '2000 SVT Cobra R', rarity: 'Ultra Mythic', rarityLevel: 14, droppable: true },
  { name: 'Cobra Jet Mustang', rarity: 'Godly', rarityLevel: 15, droppable: true },

  // Classic Mustangs
  { name: '1964 Mustang Coupe', rarity: 'Common', rarityLevel: 1, droppable: true },

  // Shelby Takeover Update (all new and updated models)
  { name: '1965 Shelby GT350R', rarity: 'Mythic', rarityLevel: 13, droppable: true },
  { name: '1966 Mustang GT350', rarity: 'Rare', rarityLevel: 6, droppable: true },
  { name: '1967 Shelby GT500', rarity: 'Godly', rarityLevel: 15, droppable: true },
  { name: '1968 Shelby GT500KR', rarity: 'Epic', rarityLevel: 9, droppable: true },
  { name: '1969 Mustang Mach 1', rarity: 'Rare', rarityLevel: 6, droppable: true },
  { name: '1969 Boss 429', rarity: 'Ultra Mythic', rarityLevel: 14, droppable: true },
  { name: '1969 Shelby GT500', rarity: 'Mythic', rarityLevel: 13, droppable: true },
  { name: '1970 Boss 302', rarity: 'Rare', rarityLevel: 6, droppable: true },
  { name: '1971 Mustang Mach 1', rarity: 'Uncommon', rarityLevel: 4, droppable: true },
  { name: '1973 Mustang Convertible', rarity: 'Common', rarityLevel: 1, droppable: true },

  // Shelby Icons & Modern Legends
  { name: "1965 Shelby GT350", rarity: "Legendary", rarityLevel: 10, droppable: true },
  { name: "1966 Shelby GT350H", rarity: "Rare", rarityLevel: 6, droppable: true },
  { name: "1967 Shelby Super Snake", rarity: "Ultra Mythic", rarityLevel: 14, droppable: true },
  { name: "1968 Shelby Green Hornet Prototype", rarity: "Legendary", rarityLevel: 12, droppable: true },
  { name: "2007 Shelby GT500", rarity: "Rare", rarityLevel: 6, droppable: true },
  { name: "2008 Shelby GT500 Super Snake", rarity: "Epic", rarityLevel: 9, droppable: true },
  { name: "2011 Shelby GT350 45th Anniversary", rarity: "Epic", rarityLevel: 9, droppable: true },
  { name: "2013 Shelby GT500", rarity: "Epic", rarityLevel: 8, droppable: true },
  { name: "2013 Shelby 1000 S/C", rarity: "Ultra Mythic", rarityLevel: 14, droppable: true },
  { name: "2022 Shelby GT500 Code Red", rarity: "Godly", rarityLevel: 15, droppable: true },

  // Shelby Electric and Concepts
  { name: "Shelby Mustang Mach-E GT", rarity: "Epic", rarityLevel: 8, droppable: true },
  { name: "2020 Shelby GT500 Dragon Snake", rarity: "Ultra Mythic", rarityLevel: 14, droppable: true },

  // Shelby Cobras
  { name: "CSX6000 - 427 S/C Cobra", rarity: "Godly", rarityLevel: 15, droppable: true },
  { name: "Diamond Edition 1965 Shelby Cobra", rarity: "???", rarityLevel: 16, droppable: true }
];

module.exports = cars;
