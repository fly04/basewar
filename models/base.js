const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

// Define the schema for bases
const baseSchema = new Schema({
    name: {
        type: String,
        unique: true,
        minlength: 3,
        maxlength: 50,
        unique: true,
        validate: {
            // Manually validate uniqueness to send a "pretty" validation error
            // rather than a MongoDB duplicate key error
            validator: validateBaseNameUniqueness,
            message: 'Base {VALUE} already exists'
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    ownerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
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

// Customize the behavior of base.toJSON() (called when using res.send)
baseSchema.set('toJSON', {
    transform: transformJsonBase, // Modify the serialized JSON with a custom function
    virtuals: true // Include virtual properties when serializing documents to JSON
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
 * Given a name, calls the callback function with true if no base exists with that name
 * (or the only base that exists is the same as the base being validated).
 */
function validateBaseNameUniqueness(value) {
    const MovieModel = mongoose.model('Base', baseSchema);
    return MovieModel.findOne().where('name').equals(value).exec().then((existingBase) => {
        return !existingBase || existingBase._id.equals(this._id)
    });
}

/**
 * Removes extra MongoDB properties from serialized bases,
 * and includes the owner's data if it has been populated.
 */
function transformJsonBase(doc, json, options) {

    json.owner = doc.ownerId.toJSON();
    delete json.ownerId;

    delete json._id;
    delete json.__v;
    delete json.createdAt;

    return json;
}

// Create the model from the schema and export it
module.exports = mongoose.model("Base", baseSchema);