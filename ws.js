const debug = require("debug")("my-app:messaging");
const settings = require("./gameSettings");
const WebSocket = require("ws");
const User = require("./models/user");
const Base = require("./models/base");
const Investment = require("./models/investment");

// Array of currently connected WebSocket clients.
const clients = [];
const users = [];
let activeBases = [];

// Create a WebSocket server using the specified HTTP server.
exports.createWebSocketServer = function (httpServer) {
	debug("Creating WebSocket server");
	const wss = new WebSocket.Server({
		server: httpServer,
	});

	// Handle new client connections.
	wss.on("connection", function (ws) {
		debug("New WebSocket client connected");

		// Keep track of clients.
		clients.push(ws);

		// Listen for messages sent by clients.
		ws.on("message", (message) => {
			// Make sure the message is valid JSON.
			let parsedMessage;
			try {
				parsedMessage = JSON.parse(message);
			} catch (err) {
				// Send an error message to the client with "ws" if you want...
				return debug("Invalid JSON message received from client");
			}

			// Handle the message.
			switch (parsedMessage.command) {
				case "updateLocation":
					handleUpdateLocation(parsedMessage.location, parsedMessage.userId);
					break;
			}
		});

		// Clean up disconnected clients and update BDD.
		ws.on("close", () => {
			clients.splice(clients.indexOf(ws), 1);
			let disconnectedUser = users.splice(clients.indexOf(ws), 1)[0];
			updateUserMoney(disconnectedUser.id, disconnectedUser.money);
			debug("WebSocket client disconnected");
		});
	});
};

// Update user location if user exists else add him to users array
function handleUpdateLocation(location, userId) {
	let userExistsAlready = false;

	//Checks if the user is already in the users array
	users.forEach((user) => {
		if (user.id === userId) {
			//If yes, update the user's location
			userExistsAlready = true;
			user.location = location;
		}
	});

	//If not, add the user to the users array
	if (!userExistsAlready) {
		setActiveUser(location, userId);
	}
}

//Add a new user to the users array
function setActiveUser(location, userId) {
	User.findById(userId).exec((err, user) => {
		if (err) {
			return next(new Error(err));
		}
		users.push({
			id: user.id,
			money: user.money,
			location: location,
			notification: false,
		});
	});
}

function updateAllActiveBases() {
	Base.find({}).exec((err, storedBases) => {
		if (err) {
			return next(new Error(err));
		}

		//Checks if any of the connected users are close to any base
		storedBases.forEach((storedBase) => {
			let baseLong = storedBase.location.coordinates[0];
			let baseLat = storedBase.location.coordinates[1];

			let activeUsers = [];
			users.forEach((user) => {
				let userLong = user.location.coordinates[0];
				let userLat = user.location.coordinates[1];

				//If yes, add the users to activeUsers
				if (
					distanceBetweenTwoPoints(baseLat, baseLong, userLat, userLong) <=
					settings.baseRange
				) {
					activeUsers.push(user);
				}
			});

			if (activeUsers.length > 0) {
				Investment.find({ baseId: storedBase.id })
					.count()
					.exec((err, investmentsCount) => {
						if (err) {
							return next(new Error(err));
						}

						let income =
							settings.baseIncome +
							investmentsCount * settings.incomeIncreasePerInvestment;

						let newBase = {
							id: storedBase.id,
							name: storedBase.name,
							income: income,
							activeUsers: activeUsers,
							ownerId: storedBase.ownerId,
						};

						// upsert(activeBases, newBase);

						const i = activeBases.findIndex(
							(oldBase) => oldBase.id === newBase.id
						);

						if (i > -1) {
							sendUserNotificationToOwner(i);
							activeBases[i] = newBase;
						} else {
							activeBases.push(newBase);
							const j = activeBases.findIndex((base) => base.id === newBase.id);
							sendUserNotificationToOwner(j);
						}
					});
			} else {
				activeBases.splice(
					activeBases.findIndex((base) => storedBase.id === base.id),
					1
				);
			}
		});
	});
}

function sendUserNotificationToOwner(baseIndex) {
	activeBases[baseIndex].activeUsers.forEach((user) => {
		if (
			user.notification === false &&
			activeBases[baseIndex].ownerId != user.id
		) {
			sendMessageToUser(activeBases[baseIndex].ownerId, {
				command: "notification",
				params: {
					message:
						"Someone is close to your base " + activeBases[baseIndex].name,
				},
			});
			user.notification = true;
		}
	});
}

// Update every active users money
function updateUsersMoney() {
	activeBases.forEach((base) => {
		let activeUsersCount = base.activeUsers.length;
		let income = base.income;

		if (activeUsersCount > 1) {
			income =
				base.income +
				base.income *
					settings.incomeMultiplierPerActiveUser *
					(activeUsersCount - 1);
		}

		base.activeUsers.forEach((user) => {
			user.money += income;
			sendMessageToUser(user.id, {
				command: "updateUser",
				params: { money: user.money, income: income },
			});
		});
	});
}

// Update users money in DB
function updateUserMoney(userId, newAmount) {
	User.findOne({ _id: userId }, (err, user) => {
		if (err) {
			return next(new Error(err));
		}
		user.money = newAmount;
		user.save();
	});
}

//Calculate distance between two points
function distanceBetweenTwoPoints(lat1, lon1, lat2, lon2) {
	const R = 6371; // Radius of the earth in km
	const dLat = deg2rad(lat2 - lat1);
	const dLon = deg2rad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(deg2rad(lat1)) *
			Math.cos(deg2rad(lat2)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const d = R * c; // Distance in km
	return d * 1000;
}

//Convert degrees to radians
function deg2rad(deg) {
	return deg * (Math.PI / 180);
}

//Send a message to a user
function sendMessageToUser(userId, messageData) {
	let user = users.find((user) => user.id == userId);
	let index = users.indexOf(user);
	let client = clients[index];
	if (client) {
		client.send(JSON.stringify(messageData));
	}
}

// Run update functions every seconds
setInterval(() => {
	updateAllActiveBases();
	updateUsersMoney();

	//DEBUG
	// users.forEach((user) => {
	// 	console.log(user.money + " --- " + user.id);
	// });
	// console.log("----------");

	// activeBases.forEach((base) => {
	// 	console.log(base.id + " --- income: " + base.income);
	// 	base.activeUsers.forEach((user) => {
	// 		console.log(user);
	// 	});
	// });

	// 	// 	// base.activeUsers.forEach((user) => {
	// 	// 	// 	console.log(user.id == base.ownerId);
	// 	// 	// });

	// console.log("--------------");
}, 1000);
