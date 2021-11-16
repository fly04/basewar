const debug = require("debug")("my-app:messaging");
const config = require("../config");
const express = require("express");
const mongoose = require("mongoose");
const Base = require("../models/base");
const User = require("../models/user");
const Investment = require("../models/investment");
const ObjectId = mongoose.Types.ObjectId;
const utils = require("./utils");
const settings = require("../gameSettings");
const { authenticate } = require("./auth");

const router = express.Router();

/********************************
 * Middlewares
 ********************************/
/**
 * Remove all investments from a base.
 * @param {Number} baseId
 */
const removeBaseInvestments = baseId => {
	Investment.deleteMany({ baseId: baseId });
};

/********************************
 * HTTP Methods
 ********************************/
/* POST new base */
router.post("/", utils.requireJson, authenticate, function (req, res, next) {
	//Verify if userId is set and correct
	if (!req.body.ownerId || !ObjectId.isValid(req.body.ownerId)) {
		let error = new Error("The user id is not valid or missing.");
		error.status = 400;
		return next(error);
	}

	// Authorizations
	if (req.currentUserId !== req.body.ownerId) {
		let error = new Error("You can't add bases for another user");
		error.status = 403;
		return next(error);
	}

	//Verify if the posted base is far enough from other bases
	let postedBase = {
		lat: req.body.location.coordinates[0],
		long: req.body.location.coordinates[1],
	};

	Base.find().exec((err, existingBases) => {
		if (err) {
			return next(err);
		}

		let isFarEnough = true;

		existingBases.forEach(base => {
			let existingBase = {
				lat: base.location.coordinates[0],
				long: base.location.coordinates[1],
			};

			if (
				utils.distanceBetweenTwoPoints(
					postedBase.lat,
					postedBase.long,
					existingBase.lat,
					existingBase.long
				) < settings.maxDistanceBetweenBases
			) {
				isFarEnough = false;
			}
		});

		if (!isFarEnough) {
			let error = new Error(
				"Your base must be created at least " +
					settings.maxDistanceBetweenBases +
					"m away from other bases."
			);
			error.status = 400;
			return next(error);
		}

		// Verify if the user has enough money to create a base
		User.findById(req.body.ownerId).exec((err, user) => {
			if (err) {
				return next(err);
			} else if (!user) {
				let error = new Error("User not found.");
				error.status = 404;
				return next(error);
			}

			Base.find({ ownerId: user.id }).exec((err, basesOwnedByUser) => {
				if (err) {
					return next(err);
				}

				const basePrice = basesOwnedByUser.length * settings.initialBasePrice;

				if (user.money < basePrice) {
					let error = new Error(
						"You don't have enough money to create a base."
					);
					error.status = 400;
					return next(error);
				}

				//Remove basePrice from user's money
				user.money -= basePrice;
				user.save();

				// Create the base and save it in the database
				const newBase = new Base(req.body);
				newBase.save(function (err, savedBase) {
					if (err) {
						return next(err);
					}

					res
						.status(201)
						.set("Location", `${config.baseUrl}/bases/${savedBase._id}`)
						.send(savedBase);
				});
			});
		});
	});
});

/* GET bases listing. */
router.get("/", function (req, res, next) {
	const countQuery = queryBases(req);
	countQuery.count(function (err, total) {
		if (err) {
			return next(err);
		} else if (total === 0) {
			let error = new Error("No base found");
			error.status = 404;
			return next(error);
		}

		let query = queryBases(req);

		// Parse pagination parameters from URL query parameters
		const { page, pageSize } = utils.getPaginationParameters(req);

		// Apply skip and limit to select the correct page of elements
		query = query.skip((page - 1) * pageSize).limit(pageSize);

		// Add the Link header to the response
		utils.addLinkHeader("/api/bases", page, pageSize, total, res);

		// Replace ownerId by the user document
		query = query.populate("ownerId");

		// ===Query execution===
		query.exec(function (err, bases) {
			if (err) {
				return next(err);
			}

			res.send(bases);
		});
	});
});

/* GET base by id
 ********************************/
router.get("/:id", function (req, res, next) {
	let query = Base.findById(req.params.id);

	query.populate("ownerId");
	query.exec(function (err, base) {
		if (err) {
			return next(err);
		} else if (!base) {
			let error = new Error("Base not found.");
			error.status = 404;
			return next(error);
		}
		res.send(base);
	});
});

/* DELETE base by id
 ********************************/
router.delete("/:id", authenticate, function (req, res, next) {
	// Authorizations
	if (req.currentUserId !== req.params.id) {
		let error = new Error("You can't delete other user bases");
		error.status = 403;
		return next(error);
	}

	Base.findById(req.params.id).exec(function (err, base) {
		if (err) {
			return next(err);
		} else if (!base) {
			let error = new Error("Base not found.");
			error.status = 404;
			return next(error);
		}

		removeBaseInvestments(base.id);
		base.remove();

		res.send(`${base.name} deleted`);
	});
});

/**
 * PATCH base
 */
router.patch("/:id", utils.requireJson, authenticate, (req, res, next) => {
	// Authorizations
	if (req.currentUserId !== req.params.id) {
		let error = new Error("You can't edit other user bases");
		error.status = 403;
		return next(error);
	}

	Base.findOne({ _id: req.params.id }).exec((err, base) => {
		if (err) {
			return next(err);
		} else if (!base) {
			let error = new Error("Base not found.");
			error.status = 404;
			return next(error);
		}

		if (req.body.name !== undefined) {
			base.name = req.body.name;
		}

		// Store base
		base.save(function (err, savedBase) {
			if (err) {
				return next(err);
			}

			res
				.status(201)
				.set("Location", `${config.baseUrl}/bases/${savedBase._id}`)
				.send(savedBase);
		});
	});
});

/* POST new investement
 ********************************/
router.post(
	"/:id/investments",
	authenticate,
	utils.requireJson,
	function (req, res, next) {
		req.body.baseId = mongoose.Types.ObjectId(req.body.baseId);
		req.body.investorId = mongoose.Types.ObjectId(req.body.investorId);

		const newInvestment = new Investment(req.body);

		// Find investor
		User.findById(newInvestment.investorId).exec((err, investor) => {
			if (err) {
				return next(err);
			} else if (!investor) {
				let error = new Error("Investor not found");
				error.status = 404;
				return next(error);
			} else if (req.currentUserId !== investor.id) {
				let error = new Error("You can't invest for other users");
				error.status = 403;
				return next(error);
			}

			// Find base
			Base.findById(req.params.id).exec((err, currentBase) => {
				if (err) {
					return next(err);
				} else if (!currentBase) {
					let error = new Error("Base not found");
					error.status = 404;
					return next(error);
				}

				// How many investments are in the current base
				Investment.find({
					baseId: currentBase.id,
				}).exec((err, investmentsInCurrentBase) => {
					if (err) return next(err);

					// How many investments the investor has in the current investor
					Investment.find({
						baseId: currentBase.id,
						investorId: req.body.investorId,
					}).exec((err, investorInvestmentsInCurrentBase) => {
						if (err) return next(err);

						// Check if the investor is not the owner of the base
						if (currentBase.ownerId.equals(newInvestment.investorId)) {
							let error = new Error("The owner of the base can't invest in it");
							error.status = 400;
							return next(error);
						}

						// Check if user already invested in base
						if (investorInvestmentsInCurrentBase.length > 0) {
							let error = new Error("This user already invested in this base.");
							error.status = 400;
							return next(error);
						}

						// Check if there is not too much investments already
						if (investmentsInCurrentBase.length >= 5) {
							let error = new Error(
								"This base has already too much investments (max. 5)"
							);
							error.status = 400;
							return next(error);
						}

						// Checks if investor has enough money
						if (investor.money <= 0) {
							let error = new Error("Not enough money.");
							error.status = 400;
							return next(error);
						}

						//Remove investment price from investor's money
						investor.money -= settings.initialInvestmentPrice;
						investor.save();

						// Store investment
						newInvestment.save(function (err, savedInvestment) {
							if (err) {
								return next(err);
							}

							return res
								.status(201)
								.set(
									"Location",
									`${config.baseUrl}/bases/${req.params.id}/investment/${savedInvestment._id}`
								)
								.send(savedInvestment);
						});
					});
				});
			});
		});
	}
);

/* GET all investment from a base */
router.get("/:id/investments", function (req, res, next) {
	let query = Investment.find({ baseId: req.params.id });
	query.count(function (err, total) {
		if (err) {
			return next(err);
		}

		let query = Investment.find({ baseId: req.params.id });

		// Replace ownerId by the user document
		query = query.populate("investorId");

		// ===Query execution===
		query.exec(function (err, investments) {
			if (err) {
				return next(err);
			}

			res.send(investments);
		});
	});
});

/* GET investment by id
 ********************************/
router.get("/:baseId/investments/:id", function (req, res, next) {
	let query = Investment.findById(req.params.id);

	query.populate("investorId");
	query.exec(function (err, investment) {
		if (err) {
			return next(err);
		}
		res.send(investment);
	});
});

/* DELETE investment by id
 ********************************/
router.delete(
	"/:baseId/investments/:id",
	authenticate,
	function (req, res, next) {
		Investment.findById(req.params.id).exec(function (err, investment) {
			if (err) {
				return next(err);
			} else if (!investment) {
				let error = new Error("Investment not found");
				error.status = 404;
				return next(error);
			} else if (req.currentUserId !== investment.investorId) {
				let error = new Error("You can't delete investments from other users");
				error.status = 403;
				return next(error);
			}

			investment.remove();
			res.send("Investment has been deleted");
		});
	}
);

/**
 * Returns a Mongoose query that will retrieve bases filtered with the URL query parameters.
 */
function queryBases(req) {
	let query = Base.find();

	// Filter users by userId
	if (req.query.ownerId != null) {
		query = query.where("ownerId").equals(req.query.ownerId);
	}

	return query;
}

module.exports = router;
