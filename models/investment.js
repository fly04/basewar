const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;
const { baseUrl } = require("../config");

// Define the schema for bases
const investmentSchema = new Schema({
	baseId: {
		type: Schema.Types.ObjectId,
		ref: "Base",
	},
	investorId: {
		type: Schema.Types.ObjectId,
		ref: "User",
		default: null,
		required: true,
		validate: {
			// Validate that the userId is a valid ObjectId
			// and references an existing user
			validator: validateUser,
			message: (props) => props.reason.message,
		},
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

// Customize the behavior of base.toJSON() (called when using res.send)
investmentSchema.set("toJSON", {
	transform: transformJsonInvestment, // Modify the serialized JSON with a custom function
	virtuals: true, // Include virtual properties when serializing documents to JSON
});

// Create a virtual property `link` which lead to this investment data
investmentSchema.virtual("link").get(function () {
	return `${baseUrl}/bases/${this.baseId}/investments/${this.id}`;
});

// Create a virtual property `base` which lead to this investment data
investmentSchema.virtual("base").get(function () {
	return `${baseUrl}/bases/${this.baseId}`;
});

/**
 * Given a user ID, ensures that it references an existing user.
 *
 * If it's not the case or the ID is missing or not a valid object ID,
 * the "userId" property is invalidated.
 */
function validateUser(value) {
	if (!ObjectId.isValid(value)) {
		throw new Error("user not found");
	}

	return mongoose
		.model("User")
		.findOne({ _id: ObjectId(value) })
		.exec()
		.then((user) => {
			if (!user) {
				throw new Error("user not found");
			}

			return true;
		});
}

/**
 * Removes extra MongoDB properties from serialized bases,
 * and includes the owner's data if it has been populated.
 */
function transformJsonInvestment(doc, json, options) {
	json.investor = doc.investorId.toJSON();
	delete json.investorId;
	delete json._id;
	delete json.__v;
	delete json.baseId;

	return json;
}

// Create the model from the schema and export it
module.exports = mongoose.model("Investment", investmentSchema);
