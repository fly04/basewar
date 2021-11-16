const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { baseUrl, URL_PREFIX } = require("../config");

// Define the schema for users
const userSchema = new Schema({
	name: {
		type: String,
		unique: true,
		minlength: 3,
		maxlength: 30,
		required: true,
	},
	password: {
		type: String,
		required: true,
	},
	money: {
		type: Number,
		default: 0,
	},
});

// Hiding the password hash from API responses
userSchema.set("toJSON", {
	transform: transformJsonUser,
	virtuals: true, // Include virtual properties when serializing documents to JSON
});

// Create a virtual property `link` which lead to this user data
userSchema.virtual("link").get(function () {
	return `${baseUrl}${URL_PREFIX}/users/${this.id}`;
});

// Create a virtual property `bases` which lead to this user data
userSchema.virtual("bases").get(function () {
	return `${baseUrl}${URL_PREFIX}/bases?ownerId=${this.id}`;
});

function transformJsonUser(doc, json, options) {
	// Remove the id, hashed password and version from response.
	delete json._id;
	delete json.password;
	delete json.__v;
	return json;
}

// Create the model from the schema and export it
module.exports = mongoose.model("User", userSchema);
