const bcrypt = require("bcrypt");
const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const User = require("../models/user");
const Base = require("../models/base");
const Investment = require("../models/investment");
const utils = require("./utils");
const { authenticate } = require("./auth");
const config = require("../config");

/********************************
 * Middlewares
 ********************************/

/**
 * Get a user
 */
const findUser = (req, res, next) => {
	User.findById(req.params.id).exec((err, user) => {
		if (err) {
			return next(err);
		} else if (!user) {
			let error = new Error("User not found");
			error.status = 404;
			return next(error);
		}
		req.user = user;
		next();
	});
};

/**
 * Save user in database
 */
const saveUser = (req, res, next) => {
	req.user.save((err) => {
		if (err) return next(err);
		next();
	});
};

/**
 * Add user
 */
const addUser = (req, res, next) => {
	req.user = new User(req.body);
	req.user.money = 0;
	next();
};

/**
 * Remove user's bases
 */
const removeUserBases = (req, res, next) => {
	Base.find({ ownerId: req.user.id }).exec((err, bases) => {
		if (err) {
			return next(err);
		}

		if (bases.length > 0) {
			bases.forEach((base) => {
				Investment.find({ baseId: base.id }).exec((err, investments) => {
					if (err) {
						return next(err);
					}

					if (investments.length > 0) {
						investments.forEach((investment) => {
							investment.remove();
						});
					}

					base.remove();
					next();
				});
			});
		} else {
			next();
		}
	});
};

/**
 * Remove user's investments
 */
const removeUserInvestments = (req, res, next) => {
	Investment.find({ investorId: req.user.id }).exec((err, investment) => {
		if (err) {
			return next(err);
		}

		if (investment.length > 0) {
			investment.forEach((investment) => {
				investment.remove();
			});
		}

		next();
	});
};

/**
 * Remove user
 */
const removeUser = (req, res, next) => {
	if (req.currentUserId !== req.user.id) {
		let error = new Error("You can't delete this user");
		error.status = 403;
		return next(error);
	} else {
		req.user.remove((err) => {
			if (err) return next(new Error(err));
			next();
		});
	}
};

/**
 * Update user
 */
const updateUser = (req, res, next) => {
	if (req.currentUserId !== req.user.id) {
		let error = new Error("You can't edit this user");
		error.status = 403;
		return next(error);
	} else {
		// Update properties in body
		if (req.body.name !== undefined) {
			req.user.name = req.body.name;
		}
		next();
	}
};

/**
 * Hash user password
 */
const hashPassword = (req, res, next) => {
	const plainPassword = req.body.password;
	bcrypt.hash(
		plainPassword,
		config.bcryptCostFactor,
		function (err, hashedPassword) {
			if (err) {
				return next(err);
			}

			req.body.password = hashedPassword;
			next();
		}
	);
};

/**
 * Returns a Mongoose query that will retrieve users filtered with the URL query parameters.
 */
function queryUsers(req) {
	let query = User.find();

	// Filter users by name
	if (req.query.name != null) {
		query = query.where("name").equals(req.query.name);
	}

	return query;
}

/********************************
 * HTTP Methods
 ********************************/

/**
 * @api {get} /api/users/:id Get a user
 * @apiName GetUser
 * @apiGroup User
 * @apiVersion 1.0.0
 * @apiDescription Get a user
 *
 * @apiUse UserIdInUrlPath
 * @apiUse UserInResponseBody
 * @apiUse UserNotFoundError
 *
 * @apiExample Example
 * GET /api/users/6193f60b8bff41c7e8ee29f3 HTTP/1.1
 *
 * @apiSuccessExample 200 OK
 * HTTP/1.1 200 OK
 * Content-Type: application/json
 *
 *   {
 *        "name": "Bobby",
 *        "money": 0,
 *        "link": "http://basewar.herokuapp.com/api/users/6193f60b8bff41c7e8ee29f3",
 *        "bases": "http://basewar.herokuapp.com/api/bases?ownerId=6193f60b8bff41c7e8ee29f3",
 *        "id": "6193f60b8bff41c7e8ee29f3"
 *    }
 */
router.get("/:id", findUser, (req, res) => {
	res.send(req.user);
});

/**
 * @api {get} /api/users Get all users
 * @apiName GetUsers
 * @apiGroup Users
 * @apiVersion 1.0.0
 * @apiDescription Get a pagniated list of all users
 *
 * @apiUse UserInResponseBody
 *
 * @apiParam (URL query parameters) {Number{1..}} [page] The page to retrieve (defaults to 1)
 * @apiParam (URL query parameters) {Number{1..100}} [pageSize] The number of elements to retrieve in one page (defaults to 100)
 * @apiSuccess (Response headers) {String} Link Links to the first, previous, next and last pages of the collection (if applicable)
 *
 * @apiExample Example:
 *      GET /api/users?page=1&pageSize=2 HTTP/1.1
 *
 * @apiSuccesExample 200 OK
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 *     Link &lt;http://basewar.herokuapp.com/api/users?page=2&pageSize=2&gt;; rel="next", &lt;http://basewar.herokuapp.com/api/users?page=3&pageSize=2>&gt;; rel="last"
 *
 *      [
 *          {
 *              "name": "Bobby",
 *              "money": 420,
 *              "link": "http://basewar.herokuapp.com/api/users/6193e2a4e4e1e5ad13d568bb",
 *              "bases": "http://basewar.herokuapp.com/api/bases?ownerId=6193e2a4e4e1e5ad13d568bb",
 *              "id": "6193e2a4e4e1e5ad13d568bb"
 *          },
 *          {
 *              "name": "Kévin",
 *              "money": 1337,
 *              "link": "http://basewar.herokuapp.com/api/users/6193ee5da4560940f6904b57",
 *              "bases": "http://basewar.herokuapp.com/api/bases?ownerId=6193ee5da4560940f6904b57",
 *              "id": "6193ee5da4560940f6904b57"
 *          }
 *      ]
 */
router.get("/", function (req, res, next) {
	const countQuery = queryUsers(req);

	countQuery.count(function (err, total) {
		if (err) {
			return next(err);
		} else if (total === 0) {
			let error = new Error("No user found");
			error.status = 404;
			return next(error);
		}

		let query = queryUsers(req);

		// ===Pagination===
		// Parse pagination parameters from URL query parameters
		const { page, pageSize } = utils.getPaginationParameters(req);

		// Apply skip and limit to select the correct page of elements
		query = query.skip((page - 1) * pageSize).limit(pageSize);

		// Add the Link header to the response
		utils.addLinkHeader("/users", page, pageSize, total, res);

		// ===Query execution===
		query.exec(function (err, users) {
			if (err) {
				return next(err);
			}
			res.send(users);
		});
	});
});

/**
 * @api {post} /api/users Create a new user
 * @apiName CreateUser
 * @apiGroup Users
 * @apiVersion 1.0.0
 * @apiDescription Create a new user
 *
 * @apiUse UserInRequestBody
 * @apiUse UserInResponseBody
 *
 * @apiExample Example
 *    POST /api/users HTTP/1.1
 *    Content-Type: application/json
 *
 *    {
 *       "name": "Bobby",
 *       "password": "mYpAsSwOrD"
 *    }
 *
 * @apiSuccessExample 201 Created
 *    HTTP/1.1 201 Created
 *    Content-Type: application/json
 *    Location: http://basewar.herokuapp.com/api/users/6193f60b8bff41c7e8ee29f3
 *
 *    {
 *        "name": "Bobby",
 *        "money": 0,
 *        "link": "http://basewar.herokuapp.com/api/users/6193f60b8bff41c7e8ee29f3",
 *        "bases": "http://basewar.herokuapp.com/api/bases?ownerId=6193f60b8bff41c7e8ee29f3",
 *        "id": "6193f60b8bff41c7e8ee29f3"
 *    }
 */
router.post(
	"/",
	utils.requireJson,
	hashPassword,
	addUser,
	saveUser,
	(req, res) => {
		res
			.status(201)
			.set("Location", `${config.baseUrl}/users/${req.user._id}`)
			.send(req.user);
	}
);

/**
 * @api {delete} /api/users/:id Delete a user
 * @apiName DeleteUser
 * @apiGroup Users
 * @apiVersion 1.0.0
 * @apiDescription Delete a user
 *
 * @apiUse PersonIdInUrlPath
 * @apiUse PersonNotFoundError
 *
 * @apiExample Example
 *  DELETE /api/users/6193f60b8bff41c7e8ee29f3 HTTP/1.1
 *
 * @apiSuccessExample 204 No Content
 *  HTTP/1.1 204 No Content
 */
router.delete(
	"/:id",
	authenticate,
	findUser,
	removeUserBases,
	removeUserInvestments,
	removeUser,
	(req, res) => {
		console.log("coucou");
		res.status(204).send();
	}
);

/**
 * @api {patch} /api/users/:id Update a user
 */
router.patch(
	"/:id",
	utils.requireJson,
	authenticate,
	findUser,
	updateUser,
	saveUser,
	(req, res) => {
		res
			.status(201)
			.set("Location", `${config.baseUrl}/users/${req.user.id}`)
			.send(req.user);
	}
);

/* Login route
 ********************************/
router.post("/login", function (req, res, next) {
	const secretKey = config.secretKey;

	// Retrieve the user from his name
	User.findOne({ name: req.body.name }).exec(function (err, user) {
		if (err) {
			return next(err);
		} else if (!user) {
			return res.sendStatus(401);
		}

		// Verify that the user correspond to the stored password
		bcrypt.compare(req.body.password, user.password, function (err, valid) {
			if (err) {
				return next(err);
			} else if (!valid) {
				return res.sendStatus(401);
			}

			// Generate a valid JWT which expires in 7 days.
			const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
			const payload = { sub: user._id.toString(), exp: exp };
			jwt.sign(payload, secretKey, function (err, token) {
				if (err) {
					return next(err);
				}

				res.send({ token: token }); // Send the token to the client.
			});
		});
	});
});

module.exports = router;

/**
 * @apiDefine UserInResponseBody
 * @apiSuccess (Response body) {String} name The name of the user
 * @apiSuccess (Response body) {String} money The money of the user
 * @apiSuccess (Response body) {String} link A link to the user document
 * @apiSuccess (Response body) {String} bases A link to the user's bases
 * @apiSuccess (Response body) {String} id The id of the user
 */

/**
 * @apiDefine UserInRequestBody
 * @apiParam (Request body) {String{3..30}} name The name of the user
 * @apiParam (Request body) {String} password The password of the user
 */

/**
 * @apiDefine UserValidationError
 * @apiError (Object)
 */

/**
 * @apiDefine UserIdInUrlPath
 * @apiParam (URL path parameters) {String} id The id of the user
 */

/**
 * @apiDefine UserNotFoundError
 * @apiError (Object) 404/NotFound No user corresponding to the given id was found
 * @apiErrorExample {json} 404 Not Found
 *    HTTP/1.1 404 Not Found
 *    Content-Type: application/json
 *
 *    Error: User not found
 */
