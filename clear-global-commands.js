require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('Deleting all global application commands...');
    await rest.put(
      Routes.applicationCommands("1372635185731997767"),
      { body: [] }
    );
    console.log('✅ All global commands deleted!');
  } catch (error) {
    console.error(error);
  }
})();
