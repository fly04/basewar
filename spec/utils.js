const User = require("../models/user");
const jwt = require("jsonwebtoken");
const config = require("../config");

exports.cleanUpDatabase = async function () {
	await Promise.all([User.deleteMany()]);
};

exports.generateValidJwt = function (user) {
	// Generate a valid JWT which expires in 7 days.
	const exp = (new Date().getTime() + 7 * 24 * 3600 * 1000) / 1000;
	const claims = { sub: user._id.toString(), exp: exp };
	return new Promise((resolve, reject) => {
		jwt.sign(claims, config.secretKey, function (err, token) {
			if (err) {
				return reject(err);
			}

			resolve(token);
		});
	});
};
