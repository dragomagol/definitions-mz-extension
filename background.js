var currentHost = "";
var lastInterval = null;
var database = null;

chrome.runtime.onInstalled.addListener(function() {
	lastInterval = new Date().getTime();
	database = new TimeDatabase();
});

async function changeWebpage(newHost) {
	if (currentHost == newHost)
		return;

	currentHost = newHost;
	lastInterval = new Date().getTime();
}

async function onFocusLost() {
	if (currentHost == "")
		return;

	// Don't record intervals less than 1 second or if the host is empty
	if (new Date().getTime() - lastInterval >= 1000 && currentHost != "") {
		database.insertBlock({
			host: currentHost,
			startTime: lastInterval,
			endTime: new Date().getTime(),
		});
	}

	currentHost = "";
	lastInterval = new Date().getTime();
}

// Prepare the data to send to the frontend
async function generateData(duration) {
	let responseData = await database.getDataInRange(duration);
	return responseData;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log(request)
	if (request.command == "deleteData") {
		database.deleteDatabase();
		database.createDatabase();
		sendResponse("Data deleted.");
	} else if (request.command == "pageFocused") {
		changeWebpage(request.page);
	} else if (request.command == "pageBlurred") {
		onFocusLost();
	} else if (request.command == "newPage") {
		changeWebpage(request.page);
	} else if (request.command == "getDayData") {
		generateData(database.DAY).then(sendResponse);
	} else if (request.command == "getWeekData") {
		generateData(database.WEEK).then(sendResponse);
	} else if (request.command == "getMonthData") {
		generateData(database.MONTH).then(sendResponse);
	} else {
		console.error("Unknown command:", request.command);
	}

	// Important! Return true to indicate you want to send a response asynchronously
	return true;
});
