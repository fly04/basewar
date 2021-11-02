const config = require("../config");
const express = require("express");
const mongoose = require("mongoose");
const Base = require("../models/base");
const ObjectId = mongoose.Types.ObjectId;
const utils = require("./utils");

const router = express.Router();

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

    base.remove();
    res.send(`${base.name} deleted`);
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
