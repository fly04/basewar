const debug = require("debug")("my-app:messaging");
const settings = require("./gameSettings");
const WebSocket = require("ws");
const User = require("./models/user");
const Base = require("./models/base");
const Investment = require("./models/investment");

// Array of currently connected WebSocket clients.
const clients = [];
const users = [];
const activeBases = [];

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
				case "createBase":
					//TO CODE
					break;
				case "createInvestment":
					//TO CODE
					break;
				case "clients": //debug
					console.log(clients);
					break;
				case "users": //debug
					console.log(users);
					break;
				case "bases": //debug
					console.log(activeBases);
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

// PAS UTILISÉ POUR LE MOMENT?
// // Broadcast a message to all connected clients.
// exports.broadcastMessage = function (message) {
// 	debug(
// 		`Broadcasting message to all connected clients: ${JSON.stringify(message)}`
// 	);
// 	// You can easily iterate over the "clients" array to send a message to all
// 	// connected clients.
// };

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

function setActiveUser(location, userId) {
	User.findById(userId).exec((err, user) => {
		if (err) {
			return next(new Error(err));
		}
		users.push({
			id: user.id,
			money: user.money,
			location: location,
		});
	});
}

function updateAllActiveBases() {
	Base.find({}).exec((err, bases) => {
		if (err) {
			return next(new Error(err));
		}

		//Checks if any of the connected users are close to any base
		bases.forEach((base) => {
			let baseLong = base.location.coordinates[0];
			let baseLat = base.location.coordinates[1];

			let activeUsers = [];
			users.forEach((user) => {
				let userLong = user.location.coordinates[0];
				let userLat = user.location.coordinates[1];

				if (
					distanceBetweenTwoPoints(baseLat, baseLong, userLat, userLong) <=
					settings.baseRange
				) {
					activeUsers.push(user);
				}
			});
			// console.log("activeUsers: " + activeUsers);

			//If yes, add the users to bases activeUsers and add the base in the activeBases array
			if (activeUsers.length > 0) {
				let query = Investment.find({ baseId: base.id });
				query.count(function (err, investmentCount) {
					if (err) {
						return next(err);
					}

					//Remove old version of the active base
					activeBases.splice(
						activeBases.findIndex((base) => base.id === base.id),
						1
					);

					//Add new version of the active base
					activeBases.push({
						id: base.id,
						income:
							settings.baseIncome +
							investmentCount * settings.incomeIncreasePerInvestment,
						activeUsers: activeUsers,
					});
				});
			}
			//If not, remove the base from activeBases array
			else {
				activeBases.splice(
					activeBases.findIndex((base) => base.id === base.id),
					1
				);
			}
		});
	});

	// console.log("activeBases: " + activeBases);
}

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

		// console.log(income);

		base.activeUsers.forEach((user) => {
			user.money += income;
		});
	});
}

function updateUserMoney(userId, newAmount) {
	User.findOne({ _id: userId }, (err, user) => {
		if (err) {
			return next(new Error(err));
		}
		console.log(user);
		user.money = newAmount;
		user.save();
	});
}

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

function deg2rad(deg) {
	return deg * (Math.PI / 180);
}

setInterval(() => {
	updateAllActiveBases();
	updateUsersMoney();
	// users.forEach((user) => {
	// 	console.log(user.money);
	// });
	// console.log("----------");
}, 1000);
