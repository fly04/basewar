//To get access to environment variables stored in .env
require('dotenv').config();

//Environment variables (add validation?)
exports.dbUrl = process.env.DATABASE_URL || 3000;