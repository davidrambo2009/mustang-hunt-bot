const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot is running!');
});

const port = process.env.PORT || 3000; // Let Replit assign the port
app.listen(port, () => {
  console.log(`✅ keepAlive web server is running on port ${port}`);
});