const { expect } = require("chai");
const supertest = require("supertest"); // http test library for nodejs http servers
const app = require("../app");
const mongoose = require("mongoose");
const { cleanUpDatabase, generateValidJwt } = require("./utils");
const User = require("../models/user");

beforeEach(cleanUpDatabase); // clean database before each test

/* Test POST User
 ********************************/
describe("POST /users", function () {
	it("should create a user", async function () {
		const res = await supertest(app)
			.post("/users") // make a POST request
			.send({
				name: "John Doe",
				password: "1234",
			}) // send method is serialized json by default
			.expect(200) // assertion: must specify the expected response status code
			.expect("Content-Type", /json/); // expected value in response header

		// Check that the response body is a JSON object with exactly the properties we expect.
		expect(res.body).to.be.an("object");
		expect(res.body._id).to.be.a("string");
		expect(res.body.name).to.equal("John Doe");
		expect(res.body).to.have.all.keys("_id", "name");
	});
});

/* Test GET user
 ********************************/
describe("GET /users", function () {
	let user;
	beforeEach(async function () {
		// Create 2 users before retrieving the list.
		const users = await Promise.all([
			User.create({ name: "John Doe" }),
			User.create({ name: "Jane Doe" }),
		]);

		// Retrieve a user to authenticate as.
		user = users[0];
	});

	it("should retrieve the list of users", async function () {
		const token = await generateValidJwt(user);
		const res = await supertest(app)
			.get("/users")
			.set("Authorization", `Bearer ${token}`)
			.expect(200)
			.expect("Content-Type", /json/);

		// How many users (2)
		expect(res.body).to.be.an("array");
		expect(res.body).to.have.lengthOf(2);

		// First user
		expect(res.body[0]).to.be.an("object");
		expect(res.body[0]._id).to.be.a("string");
		expect(res.body[0].name).to.equal("Jane Doe");
		expect(res.body[0]).to.have.all.keys("_id", "name");

		// Second user
		expect(res.body[1]).to.be.an("object");
		expect(res.body[1]._id).to.be.a("string");
		expect(res.body[1].name).to.equal("John Doe");
		expect(res.body[1]).to.have.all.keys("_id", "name");
	});
});

after(mongoose.disconnect); // tell mongoose to disconnect when test are done
