const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the schema for users
const userSchema = new Schema({
  name: String,
  password: String
});

// Hiding the password hash from API responses
userSchema.set('toJSON', {
  transform: transformJsonUser
});

function transformJsonUser(doc, json, options) {
 // Remove the hashed password from the generated JSON.
 delete json.password;
 return json;
}

// Create the model from the schema and export it
module.exports = mongoose.model('User', userSchema);
