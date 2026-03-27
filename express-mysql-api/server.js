require('dotenv').config();

const app = require('./src/app');

// db.js is required inside app.js indirectly via controllers,
// but we need the pool to initialise before listening.
// Requiring it here ensures the startup connectivity check runs first.
require('./src/config/db');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
