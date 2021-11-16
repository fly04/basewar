const debug = require("debug")("my-app:messaging");
const config = require("../config");
const express = require("express");
const mongoose = require("mongoose");
const Base = require("../models/base");
const User = require("../models/user");
const Investment = require("../models/investment");
const ObjectId = mongoose.Types.ObjectId;
const utils = require("./utils");
const users = require("./users");

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
router.post("/", utils.requireJson, function (req, res, next) {
	if (req.body.userId && !ObjectId.isValid(req.body.userId)) {
		return res.status(422).send({
			message: "Base validation failed: userId: person not found",
			errors: {
				userId: {
					message: "user not found",
					path: "userId",
					value: req.body.userId,
				},
			},
		});
	}

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

/* GET bases listing. */
router.get("/", function (req, res, next) {
	const countQuery = queryBases(req);
	countQuery.count(function (err, total) {
		if (err) {
			return next(err);
		}

		let query = queryBases(req);

		// ===Pagination===
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
		}
		res.send(base);
	});
});

/* DELETE base by id
 ********************************/
router.delete("/:id", function (req, res, next) {
	Base.findById(req.params.id).exec(function (err, base) {
		if (err) {
			return next(err);
		}

		removeBaseInvestments(base.id);
		base.remove();

		res.send(`${base.name} deleted`);
	});
});

/**
 * PATCH base
 */
router.patch("/:id", utils.requireJson, (req, res, next) => {
	Base.findOne({ _id: req.params.id }).exec((err, base) => {
		if (err) return next(err);

		if (req.body.name !== undefined) {
			base.name = req.body.name;
		}

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
router.post("/:id/investments", utils.requireJson, function (req, res, next) {
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
		}

		// Find base
		Base.findById(req.params.id).exec((err, currentBase) => {
			if (err) {
				return next(err);
			} else if (!currentBase) {
				let error = new Error("Investor not found");
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
});

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
router.delete("/:baseId/investments/:id", function (req, res, next) {
	Investment.findById(req.params.id).exec(function (err, investment) {
		if (err) {
			return next(err);
		}

		investment.remove();
		res.send("Investment has been deleted");
	});
});

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
