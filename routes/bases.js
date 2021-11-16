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
const removeBaseInvestments = (baseId) => {
	Investment.deleteMany({ baseId: baseId });
};

/********************************
 * HTTP Methods
 ********************************/

/**
 *
 * @api {post} /api/bases Create new base
 * @apiName CreateBase
 * @apiGroup Bases
 * @apiVersion 1.0.0
 * @apiDescription Create a new base
 *
 * @apiUse BaseInRequestBody
 * @apiUse BaseInResponseBody
 *
 *
 * @apiExample {Object} Example
 * POST /api/bases HTTP/1.1
 * Content-Type: application/json
 *
 * {
 * 	"name": "Base de test",
 * 	"ownerId": "6193ebd40b4638972f476187",
 * 	"location": {
 * 		"type": "Point",
 * 		"coordinates": [
 * 			-1.5,
 * 			1.5
 * 		]
 * 	}
 * }
 *
 * @apiSuccessExample 201 Created
 * HTTP/1.1 201 Created
 * Content-Type: application/json
 * Location: http://basewar.herokuapp.com/api/users/6193ebd40b4638972f476187
 */
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

		existingBases.forEach((base) => {
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

/**
 *
 * @api {get} /api/bases Get all bases
 * @apiName GetBases
 * @apiGroup Bases
 * @apiVersion  1.0.0
 * @apiDescription Get all bases
 *
 * @apiUse BaseInResponseBody
 *
 * @apiParam (URL query parameters) {String} [ownerId] The user id of the owner of the base.
 *
 * @apiExample
 * GET /api/bases?ownerId=5a9f9d8e8f8b8a0e8c8b4567 HTTP/1.1
 *
 *
 * @apiSuccessExample 200 OK
 * HTTP/1.1 200 OK
 * Content-Type: application/json
 *
 * [
 *   {
 *       "location": {
 *           "type": "Point",
 *           "coordinates": [
 *               -23.856077,
 *               20.848447
 *           ]
 *       },
 *       "name": "Robin Base",
 *       "investments": "http://localhost:3000/api/bases/6193ebd40b4638972f476187/investments/",
 *       "id": "6193ebd40b4638972f476187",
 *       "owner": {
 *           "name": "robin",
 *           "money": 0,
 *           "link": "http://localhost:3000/api/users/6193e4912e17bb53efb4aeb2",
 *           "bases": "http://localhost:3000/api/bases?ownerId=6193e4912e17bb53efb4aeb2",
 *           "id": "6193e4912e17bb53efb4aeb2"
 *       }
 *   }
 * ]
 */
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

/**
 * @api {get} /api/bases/:id Get a base
 * @apiName GetBase
 * @apiGroup Bases
 * @apiVersion 1.0.0
 * @apiDescription Get a base
 *
 * @apiUse BaseIdInUrlPath
 * @apiUse BaseInResponseBody
 * @apiUse BaseNotFoundError
 *
 * @apiExample Example
 * GET /api/bases/6193f60b8bff41c7e8ee29f3 HTTP/1.1
 *
 * @apiSuccessExample 200 OK
 * HTTP/1.1 200 OK
 * Content-Type: application/json
 *
 *   {
 *     "location": {
 *       "type": "Point",
 *       "coordinates": [
 *           -23.856077,
 *          20.848447
 *       ]
 *    },
 *    "name": "Base de test",
 *    "investments": "http://basewar.herokuapp.com/api/bases/6193ebd40b4638972f476187/investments/",
 *    "id": "6193ebd40b4638972f476187",
 *    "owner": {
 * 	  "name": "Richman",
 * 	  "money": 0,
 * 	  "link": "http://basewar.herokuapp.com/api/users/6193e4912e17bb53efb4aeb2",
 * 	  "bases": "http://basewar.herokuapp.com/api/bases?ownerId=6193e4912e17bb53efb4aeb2",
 * 	  "id": "6193e4912e17bb53efb4aeb2"
 *   }
 * }
 */
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

/**
 * @api {delete} /api/bases/:id Delete a base
 * @apiName DeleteBase
 * @apiGroup Bases
 * @apiVersion 1.0.0
 * @apiDescription Delete a base
 *
 * @apiUse BaseIdInUrlPath
 * @apiUse BaseNotFoundError
 *
 * @apiExample Example
 *  DELETE /api/bases/6193f60b8bff41c7e8ee29f3 HTTP/1.1
 *
 * @apiSuccessExample 204 No Content
 *  HTTP/1.1 204 No Content
 */
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
 *
 * @api {patch} /api/base/:baseId/investment/:id Update an investment
 * @apiName UpdateInvestment
 * @apiGroup Investments
 * @apiVersion  1.0.0
 * @apiDescription Update an investment
 *
 * @apiUse InvestmentInResponseBody
 * @apiUse InvestmentInRequestBody
 *
 * @apiUse BaseIdInUrlPath
 * @apiUse BaseNotFoundError
 *
 * @apiExample Example
 * PATCH /api/base/6193f60b8bff41c7e8ee29f3/investment/6193f60b8bff41c7e8ee29f4 HTTP/1.1
 *
 * {
 * 	"baseId": "6193f60b8bff41c7e8ee29f3",
 * 	"investorId": "61940744cf6b06bd2b29ac77",
 * }
 *
 * @apiSuccessExample 200 OK
 * HTTP/1.1 200 OK
 * Content-Type: application/json
 *
 * {
 *   "createdAt": "2021-11-16T19:35:27.048Z",
 *   "link": "http://basewar.herokuapp.com/api/bases/6193ebd40b4638972f476187/investments/619407ff93c69ba4474ec2ee",
 *   "base": "http://basewar.herokuapp.com/api/bases/6193ebd40b4638972f476187",
 *   "id": "619407ff93c69ba4474ec2ee",
 *   "investor": "61940744cf6b06bd2b29ac77"
 * }
 *
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

/**
 * @api {post} /api/bases/:id/investments Create a new investment
 * @apiName CreateInvestment
 * @apiGroup Investments
 * @apiVersion  1.0.0
 * @apiDescription Create a new investment
 *
 * @apiUse InvestmentInResponseBody
 * @apiUse InvestmentInRequestBody
 *
 * @apiUse BaseIdInUrlPath
 * @apiUse BaseNotFoundError
 *
 *
 * @apiError 403/Forbidden The user id does not match with the investor id
 * @apiErrorExample 403 Forbidden
 * HTTP/1.1 403 Forbidden
 * Content-Type: application/json
 *
 * You can't invest for other users
 *
 * @apiError 404/NotFound The base id does not match with the base id in the url
 * @apiErrorExample 404 Not Found
 * HTTP/1.1 404 Not Found
 * Content-Type: application/json
 *
 * Base not found
 *
 * @apiError 400/BadRequest The owner of the base is the same as the investor
 * @apiErrorExample 400 Bad Request
 * HTTP/1.1 400 Bad Request
 * Content-Type: application/json
 *
 * The owner of the base can't invest in it
 *
 * @apiError 400/BadRequest The number of investments of the investor for the current base is greater than 0
 * @apiErrorExample 400 Bad Request
 * HTTP/1.1 400 Bad Request
 * Content-Type: application/json
 *
 * This user already invested in this base.
 *
 * @apiError 400/BadRequest The number of investments of the base is greater than 5
 * @apiErrorExample 400 Bad Request
 * HTTP/1.1 400 Bad Request
 * Content-Type: application/json
 *
 * This base has already too much investments (max. 5)
 *
 * @apiError 400/BadRequest The money of the investor is equal or less than 0
 * @apiErrorExample 400 Bad Request
 * HTTP/1.1 400 Bad Request
 * Content-Type: application/json
 *
 * Not enough money.
 *
 *
 * @apiExample Example
 * POST /api/bases/6193f60b8bff41c7e8ee29f3/investments HTTP/1.1
 * Content-Type: application/json
 *
 * {
 * 	"baseId": "6193f60b8bff41c7e8ee29f3",
 * 	"investorId": "6193e4912e17bb53efb4aeb2"
 * }
 *
 *
 * @apiSuccessExample 201 Created
 * HTTP/1.1 201 Created
 * Content-Type: application/json
 * Location: http://basewar.herokuapp.com/api/bases/6193f60b8bff41c7e8ee29f3/investments/6193f60b8bff41c7e8ee29f4
 *
 * {
 *   "createdAt": "2021-11-16T19:35:27.048Z",
 *   "link": "http://basewar.herokuapp.com/api/bases/6193f60b8bff41c7e8ee29f3/investments/6193f60b8bff41c7e8ee29f4",
 *   "base": "http://basewar.herokuapp.com/api/bases/6193f60b8bff41c7e8ee29f3",
 *   "id": "6193f60b8bff41c7e8ee29f4",
 *   "investor": "61940744cf6b06bd2b29ac77"
 * }
 *
 */
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
						if (investor.money <= settings.initialInvestmentPrice) {
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

/**
 *
 * @api {get} /api/bases/:id/investments Get all investments
 * @apiName GetInvestments
 * @apiGroup Investments
 * @apiVersion  1.0.0
 * @apiDescription Get all investments of a base
 * 
 * @apiUse InvestmentInResponseBody
 * @apiUse InvestmentInRequestBody
 *
 * @apiUse BaseIdInUrlPath
 *
 * @apiExample Example
 * GET /api/bases/6193f60b8bff41c7e8ee29f3/investments HTTP/1.1

 * {
 * 	"baseId": "6193f60b8bff41c7e8ee29f3",
 * 	"investorId": "6193e4912e17bb53efb4aeb2"
 * }
 *
 *
 * @apiSuccessExample 200 OK
 * HTTP/1.1 200 OK
 * Content-Type: application/json
 * 
 * {
 *   "createdAt": "2021-11-16T19:35:27.048Z",
 *   "link": "http://basewar.herokuapp.com/api/bases/6193f60b8bff41c7e8ee29f3/investments/6193f60b8bff41c7e8ee29f4",
 *   "base": "http://basewar.herokuapp.com/api/bases/6193f60b8bff41c7e8ee29f3",
 *   "id": "6193f60b8bff41c7e8ee29f4",
 *   "investor": "61940744cf6b06bd2b29ac77"
 * }
 *
 *
 */
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

/**
 *
 * @api {get} /api/base/:baseId/investments/:id Get an investment
 * @apiName GetInvestment
 * @apiGroup Investments
 * @apiVersion  1.0.0
 * @apiDescription Get an investment
 *
 * @apiUse InvestmentInResponseBody
 * @apiUse InvestmentInRequestBody
 *
 * @apiUse BaseIdInUrlPath
 *
 *
 * @apiExample Example
 * GET /api/bases/6193f60b8bff41c7e8ee29f3/investments/6193f60b8bff41c7e8ee29f4 HTTP/1.1
 *
 * @apiSuccessExample 200 OK
 * HTTP/1.1 200 OK
 * Content-Type: application/json
 *
 * {
 *   "createdAt": "2021-11-16T19:35:27.048Z",
 *   "link": "http://basewar.herokuapp.com/api/bases/6193f60b8bff41c7e8ee29f3/investments/6193f60b8bff41c7e8ee29f4",
 *   "base": "http://basewar.herokuapp.com/api/bases/6193f60b8bff41c7e8ee29f3",
 *   "id": "6193f60b8bff41c7e8ee29f4",
 *   "investor": "61940744cf6b06bd2b29ac77"
 * }
 */
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

/**
 *
 * @api {delete} /api/bases/:baseId/investments/:id Delete an investment
 * @apiName DeleteInvestment
 * @apiGroup Investments
 * @apiVersion  1.0.0
 * @apiDescription Get an investment
 *
 * @apiUse InvestmentInResponseBody
 * @apiUse InvestmentInRequestBody
 *
 * @apiUse BaseIdInUrlPath
 *
 * @apiExample Example
 * DELETE /api/bases/6193f60b8bff41c7e8ee29f3/investments/6193f60b8bff41c7e8ee29f4 HTTP/1.1
 *
 * @apiSuccessExample 204 No Content
 *  HTTP/1.1 204 No Content
 */
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
/**
 * @apiDefine BaseInResponseBody
 * @apiSuccess (Response body) {String} name The name of the base
 * @apiSuccess (Response body) {String} location.type The type of the location ("Point")
 * @apiSuccess (Response body) {Array} location.coordinates The latitude and longitude of the base
 * @apiSuccess (Response body) {String} ownerId The id of the owner of the base
 */

/**
 * @apiDefine BaseInRequestBody
 * @apiParam (Request body) {String{3..30}} name The name of the base
 * @apiParam (Request body) {String} location.type The type of the location: must be "Point"
 * @apiParam (Request body) {Array} location.coordinates The latitude and longitude of the base
 * @apiParam (Request body) {String} ownerId The id of the owner of the base
 */

/**
 * @apiDefine InvestmentInResponseBody
 * @apiSuccess (Response body) {String} createdAt The date of the creation
 * @apiSuccess (Response body) {String} link The link to the investment
 * @apiSuccess (Response body) {String} base The link to the base
 * @apiSuccess (Response body) {String} id The id of the investment
 * @apiSuccess (Response body) {String} investor The user id of the investment
 *
 */

/**
 * @apiDefine InvestmentInRequestBody
 * @apiParam (Request body) {String} baseId The id of the base
 * @apiParam (Request body) {String} investorId The id of the use for the investment
 */

/**
 * @apiDefine BaseIdInUrlPath
 * @apiParam (URL path parameters) {String} id The id of the base
 */

/**
 * @apiDefine BaseNotFoundError
 * @apiError (Object) 404/NotFound No base corresponding to the given id was found
 * @apiErrorExample {json} 404 Not Found
 *    HTTP/1.1 404 Not Found
 *    Content-Type: application/json
 *
 *    Error: Base not found
 */
