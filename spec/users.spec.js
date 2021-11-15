const { expect } = require("chai");
const supertest = require("supertest"); // http test library for nodejs http servers
const app = require("../app");
const mongoose = require("mongoose");
const { cleanUpDatabase, generateValidJwt } = require("./utils");
const User = require("../models/user");
const faker = require("faker");

const expectedFields = ["id", "name", "bases", "link", "money"];

beforeEach(cleanUpDatabase); // clean database before each test

/* POST users
 ********************************/
describe("POST /users", function () {
	let user = {
		name: faker.name.findName(),
		password: faker.internet.password(),
	};

	it("should create a user", async function () {
		const res = await supertest(app)
			.post("/api/users") // make a POST request
			.send(user) // send method is serialized json by default
			.expect(201) // assertion: must specify the expected response status code
			.expect("Content-Type", /json/); // expected value in response header

		// Check that the response body is a JSON object with exactly the properties we expect.
		expect(res.body).to.be.an("object");
		expect(res.body.id).to.be.a("string");
		expect(res.body.name).to.equal(user.name);
		expect(res.body.bases).to.be.a("string");
		expect(res.body.link).to.be.a("string");
		expect(res.body.money).to.equal(0);
		expect(res.body).to.have.all.keys(expectedFields);
	});
});

/* GET users
 ********************************/
describe("GET /users", function () {
	// Create 1 user
	let user;
	beforeEach(async function () {
		const users = await Promise.all([
			User.create({
				name: faker.name.findName(),
				password: faker.internet.password(),
			}),
		]);

		user = users[0];
	});

	it("should retrieve the list of users", async function () {
		// const token = await generateValidJwt(user);
		const res = await supertest(app)
			.get("/api/users")
			// .set("Authorization", `Bearer ${token}`)
			.expect(200) // OK
			.expect("Content-Type", /json/);

		// How many users (1)
		expect(res.body).to.be.an("array");
		expect(res.body).to.have.lengthOf(1);

		// Second user
		expect(res.body[0]).to.be.an("object");
		expect(res.body[0].id).to.be.a("string");
		expect(res.body[0].name).to.equal(user.name);
		expect(res.body[0].bases).to.be.a("string");
		expect(res.body[0].link).to.be.a("string");
		expect(res.body[0].money).to.equal(0);
		expect(res.body[0]).to.have.all.keys(expectedFields);
	});
});

/* DELETE users
 ********************************/
describe("DELETE /users", function () {
	// Create 1 user
	let user;
	beforeEach(async function () {
		const users = await Promise.all([
			User.create({ name: "Kenny", password: "oh-my-god" }),
		]);

		user = users[0];
	});

	it("should delete a user", async function () {
		const res = await supertest(app)
			.delete(`/api/users/${user.id}`)
			// .set("Authorization", `Bearer ${token}`)
			.expect(204); // No content
	});
});

/* PATCH users
 ********************************/
describe("PUT /users", function () {
	// Create 1 user
	let user;
	beforeEach(async function () {
		const users = await Promise.all([
			User.create({
				name: faker.name.findName(),
				password: faker.internet.password(),
			}),
		]);

		user = users[0];
	});

	it("should modify the name of a user", async function () {
		const res = await supertest(app)
			.put(`/api/users/${user.id}`)
			.send({ name: "Bobby", password: user.password })
			// .set("Authorization", `Bearer ${token}`)
			.expect(201); // Created
		expect(res.body.name).to.equal("Bobby");
	});
});

after(mongoose.disconnect); // tell mongoose to disconnect when test are done
