// For some undefined future time: use Manifest V3
// Our database, ideally this would be in a separate file
class TimeDatabase {
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

	async getAllData() {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				console.error("Database not open.");
				reject("Database not open.");
			}

			const dataTable = this.db.transaction(this.tableName).objectStore(this.tableName);
			let allData = [];

			dataTable.openCursor().onsuccess = function(event) {
				// Use the cursor and add the extracted data to the array
				let cursor = event.target.result;
				if (cursor) {
					allData.push(cursor.value);
					cursor.continue();
				} else {
					console.log("Got all data:", allData.length, "entries.");
					resolve(allData);
				}
			};

			dataTable.openCursor().onerror = function(event) {
				console.error("Error retrieving data:", event.target.error);
			};
		});
	}
	
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
					// console.log(Object.fromEntries(sortedMap));
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
	if (new Date().getTime() - lastInterval >= 1000 || currentHost != "") {
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
async function generateData(request) {
	// TODO: remember to separate this by function
	let responseData = await database.getDataSorted();
	return responseData;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log(new Date().toString());
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
	} else {
		generateData(request).then(sendResponse);
	}

	// Important! Return true to indicate you want to send a response asynchronously
	return true;
});
