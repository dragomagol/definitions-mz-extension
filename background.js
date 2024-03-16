// For some undefined future time: use Manifest V3
// Our database, ideally this would be in a separate file
class TimeDatabase {
	// Constants for milliseconds in a day, week, and month
	DAY = 86400000;
	WEEK = 604800000;
	MONTH = 2592000000;

	tableName = "timeBlocks";
	db = null;

	constructor() {
		this.createDatabase();
	}

	createDatabase() {
		if (this.db) {
			console.error("Database already open.");
			return;
		}
		console.log("Creating database.")
		const request = window.indexedDB.open('TimeTracker', 1);

		request.onerror = (event) => {
			console.error("Database error:", event.target.errorCode);
		};

		request.onupgradeneeded = (event) => {
			this.db = event.target.result;

			// Create an objectStore to hold information about our blocks
			let dataTable = this.db.createObjectStore(this.tableName);

			// Create an index to search blocks by start time
			dataTable.createIndex("startTime", "startTime", { unique: true });

			// Create an index to search hosts by name. We may have duplicates
			// so we can't use a unique index.
			dataTable.createIndex("host", "host", { unique: false });

			dataTable.transaction.oncomplete = function (event) {
				console.log("ObjectStore created.");
			};
		};

		request.onsuccess = (event) => {
			this.db = event.target.result;
			console.log("Database open.");

			this.db.onerror = (event) => {
				console.error("Database error:", event.target.errorCode);
			};
		};
	}

	async insertBlock(timeBlock) {
		return new Promise(async () => {
			if (!this.db) {
				console.log("Database not open.");
				reject("Database not open.");
			}
			
			const insertTransaction = this.db.transaction(this.tableName, "readwrite");
			const dataTable = insertTransaction.objectStore(this.tableName);

			let request = await dataTable.add(timeBlock, timeBlock.startTime);
			
			request.onsuccess = function () {
				console.log("Block added:", timeBlock);
			}

			request.onerror = function () {
				console.error("Problem adding block:", request.error);
			}
		});
	}

	async getDataInRange(duration) {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				console.error("Database not open.");
				reject("Database not open.");
			}

			const dataTable = this.db.transaction(this.tableName).objectStore(this.tableName);
			let dataMap = new Map();

			let currentTime = new Date().getTime();
			let durationStart = currentTime - duration;

			dataTable.openCursor().onsuccess = function(event) {
				// Use the cursor and add the extracted data to the array
				let cursor = event.target.result;
				if (cursor) {
					let host = cursor.value.host;
					let startTime = cursor.value.startTime;
					let endTime = cursor.value.endTime;

					if (startTime >= durationStart) {
						var hour = new Date(startTime).getHours();
						if (dataMap.has(hour)) {
							var hourMap = dataMap.get(hour);
							if (hourMap.has(host)) {
								hourMap.set(host, hourMap.get(host) + (endTime - startTime));
							} else {
								hourMap.set(host, endTime - startTime);
							}
							dataMap.set(hour, hourMap);
						} else {
							var hourMap = new Map();
							hourMap.set(host, endTime - startTime);
							dataMap.set(hour, hourMap);
						}
					}
					cursor.continue();
				} else {
					let valueArray = Array.from(dataMap, ([hour, hostMap]) => ({ hour, hostMap }));
					// flatten the inner maps remaining
					valueArray = valueArray.map((item) => {
						let hostMap = item.hostMap;
						let hostArray = Array.from(hostMap, ([host, duration]) => ({ host, duration }));
						return { hour: item.hour, hostMap: hostArray };
					});
					resolve(valueArray);
				}
			};

			dataTable.openCursor().onerror = function(event) {
				console.error("Error retrieving data:", event.target.error);
			};
		});
	}
	
	// Combine all data and sort it by duration
	async getDataSorted() {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				console.error("Database not open.");
				reject("Database not open.");
			}

			const dataTable = this.db.transaction(this.tableName).objectStore(this.tableName);
			let dataMap = new Map();

			dataTable.openCursor().onsuccess = function(event) {
				// Use the cursor and add the extracted data to the array
				let cursor = event.target.result;
				if (cursor) {
					let host = cursor.value.host;
					let startTime = cursor.value.startTime;
					let endTime = cursor.value.endTime;

					if (dataMap.has(host)) {
						dataMap.set(host, dataMap.get(host) + (endTime - startTime));
					} else {
						dataMap.set(host, endTime - startTime);
					}
					cursor.continue();
				} else {
					let sortedMap = new Map([...dataMap.entries()].sort((a, b) => b[1] - a[1]));
					let valueArray = Array.from(sortedMap, ([host, duration]) => ({ host, duration }));
					resolve(valueArray);
				}
			};

			dataTable.openCursor().onerror = function(event) {
				console.error("Error retrieving data:", event.target.error);
			};
		});
	}

	// Not sure if this is needed
	// Might be useful for deleting data in a range, i.e. older than 30d
	deleteBlock(timeBlock) {
		if (!this.db) {
			console.error("Database not open.");
			return;
		}
		const deleteTransaction = this.db.transaction([this.tableName], "readwrite");
		const dataTable = deleteTransaction.objectStore(this.tableName);

		return new Promise((resolve, reject) => {
			deleteTransaction.oncomplete = function () {
				console.log("All \"DELETE\" transactions complete.");
				resolve(true);
			};

			deleteTransaction.onerror = function () {
				console.log("Problem deleting this block.");
				resolve(false);
			};

			dataTable.delete(timeBlock);
		});
	}

	deleteDatabase() {
		if (!this.db) {
			console.error("Database not open.");
			return;
		}
		this.db.close();
		this.db = null;
		window.indexedDB.deleteDatabase('TimeTracker');
		console.log("Database deleted.");
	}
}

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
