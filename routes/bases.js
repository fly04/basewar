const config = require('../config');
const express = require('express');
const mongoose = require('mongoose');
const Base = require('../models/base');
const ObjectId = mongoose.Types.ObjectId;
const utils = require('./utils');

const router = express.Router();

/* POST new base */
router.post('/', utils.requireJson, function (req, res, next) {

    if (req.body.userId && !ObjectId.isValid(req.body.userId)) {
        return res.status(422).send({
            message: 'Base validation failed: userId: person not found',
            errors: {
                userId: {
                    message: 'user not found',
                    path: 'userId',
                    value: req.body.userId
                }
            }
        });
    }

    const newBase = new Base(req.body);
    newBase.save(function (err, savedBase) {
        if (err) {
            return next(err);
        }

        res
            .status(201)
            .set('Location', `${config.baseUrl}/api/bases/${savedBase._id}`)
            .send(savedBase);
    });
});


module.exports = router;