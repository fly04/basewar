let someFunction = function () {
	console.log("someFunction");
};

let controller = {
	tick: function () {
		// setInterval(function () {
		//     someFunction();
		// }, 100);
	},
};

module.exports = controller;
