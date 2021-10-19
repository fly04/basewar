const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

// Define the schema for bases
const baseSchema = new Schema({
    name: {
        type: String,
        unique: true,
    },
    ownerId: {
        type: Schema.Types.ObjectId,
        ref: 'Person',
        default: null,
        required: true,
        validate: {
            // Validate that the userId is a valid ObjectId
            // and references an existing user
            validator: validateUser,
            message: props => props.reason.message
        }
    }

});

/**
 * Given a user ID, ensures that it references an existing user.
 *
 * If it's not the case or the ID is missing or not a valid object ID,
 * the "userId" property is invalidated.
 */
function validateUser(value) {
    if (!ObjectId.isValid(value)) {
        throw new Error('user not found');
    }

    return mongoose.model('User').findOne({ _id: ObjectId(value) }).exec().then(user => {
        if (!user) {
            throw new Error('user not found');
        }

        return true;
    });
}

/**
 * Removes extra MongoDB properties from serialized movies,
 * and includes the director's data if it has been populated.
 */
function transformJsonBase(doc, json, options) {

    // Remove MongoDB _id & __v (there's a default virtual "id" property)
    delete json._id;
    delete json.__v;

    if (!(json.userId instanceof ObjectId)) {
        // If the user was populated, include it in the serialization
        json.user = doc.userId.toJSON();
        json.userId = doc.userId._id;
    }

    return json;
}

// Create the model from the schema and export it
module.exports = mongoose.model("Base", baseSchema);