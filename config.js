// To get access to environment variables stored in .env
require("dotenv").config();

// Environment variables (add validation?)
exports.port = process.env.PORT || "3000";
exports.dbUrl = process.env.DATABASE_URL || "mongodb://localhost/basewar";
exports.URL_PREFIX = "/api";
exports.baseUrl =
	process.env.BASE_URL ||
	`http://localhost:${exports.port}${exports.URL_PREFIX}`;

// JWT signing key
exports.secretKey = process.env.SECRET_KEY || "changeme";
exports.bcryptCostFactor = 10;
exports.updateBaseInterval = process.env.UPDATE_BASE_INTERVAL || 5000;
