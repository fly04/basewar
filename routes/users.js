const bcrypt = require('bcrypt');
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/user');
const {authenticate} = require('./auth');
const config = require('../config');

/* POST new user */
router.post('/', function (req, res, next) {

  const plainPassword = req.body.password;

  bcrypt.hash(plainPassword, config.bcryptCostFactor, function (err, passwordHash) {
    if (err) {
      return next(err);
    }

    // Create a new document from the JSON in the request body
    const newUser = new User(req.body);
    newUser.password = passwordHash;

    // Save that document
    newUser.save(function (err, savedUser) {
      if (err) {
        return next(err);
      }
      // Send the saved document in the response
      res.send(savedUser);
    });
  });
});

/* GET users listing. */
router.get('/', authenticate, function (req, res, next) {
  User.find().sort('name').exec(function (err, users) {
    if (err) {
      return next(err);
    }
    res.send(users);
  });
});

// Login route
router.post('/login', function (req, res, next) {
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
      jwt.sign(payload, secretKey, function(err, token) {
        if (err) { return next(err); }

        res.send({ token: token }); // Send the token to the client.
      });

    });
  })
});

module.exports = router;
