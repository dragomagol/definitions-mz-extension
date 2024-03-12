// For some undefined future time: use Manifest V3
// Our database, ideally this would be in a separate file
class TimeDatabase {
	tableName = "timeBlocks";
	db = null;

	constructor() {
		this.createDatabase();
	}

	createDatabase() {
		const request = window.indexedDB.open('TimeTracker', 1);

		request.onerror = (event) => {
			console.error(`Database error: ${event.target.errorCode}`);
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
				console.error(`Database error: ${event.target.errorCode}`);
			};
		};
	}

	async insertBlock(timeBlock) {
		return new Promise(async () => {
			if (!this.db) {
				console.log("Database not open.");
			}
			
			const insertTransaction = this.db.transaction(this.tableName, "readwrite");
			const dataTable = insertTransaction.objectStore(this.tableName);
			
			// TODO: Can we verify that our timeBlock is in the correct format?
			let request = await dataTable.add(timeBlock, timeBlock.startTime);
			
			request.onsuccess = function () {
				console.log("Block added:", request.result);
			}

			request.onerror = function () {
				console.log("Problem adding block:", request.error);
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
		window.indexedDB.deleteDatabase('TimeTracker');
		console.log("Database deleted.");
	}
}

var currentHost = "";
var lastInterval = new Date().getTime();
var database = new TimeDatabase();

// This works for when a website is loaded the first time, 
// not on tab changes
chrome.webNavigation.onCompleted.addListener(function() {
	changeWebpage();
});

// Get the host name of the active tab
async function getCurrentTab() {
	return new Promise((resolve, reject) => {
		let queryOptions = { active: true, lastFocusedWindow: true };
		chrome.tabs.query(queryOptions, (tabs) => {
			let [tab] = tabs;
			if (tab) {
				let url = new URL(tab.url);
				resolve(url.hostname);
			} else {
				reject("No active tab found.");
			}
		});
	});
}

async function onFocusGained() {
	let newHost = await getCurrentTab();
	if (currentHost == newHost) {
		return;
	}
	currentHost = newHost;
	lastInterval = new Date().getTime();
}

async function onFocusLost() {
	let timeBlock = {
		host: currentHost,
		startTime: lastInterval,
		endTime: new Date().getTime(),
	};

	if (currentHost != "") {
		database.insertBlock(timeBlock);
	}
	currentHost = "";
}

async function changeWebpage() {
	let newHost = await getCurrentTab();
	
	if (currentHost == newHost) {
		return;
	}

	let timeBlock = {
		host: currentHost,
		startTime: lastInterval,
		endTime: new Date().getTime(),
	};
	
	// Don't save empty hosts
	if (currentHost != "") {
		database.insertBlock(timeBlock);
	}

	currentHost = newHost;
	lastInterval = new Date().getTime();
}

// Prepare the data to send to the frontend
async function generateData(request) {
	let responseData = await database.getDataSorted();
	console.log(responseData);
	return responseData;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log(request)
    // if (request == "deleteData") {
	// 	database.deleteDatabase();
	// 	sendResponse("Data deleted.");
	// } else if (request == "pageFocused") {
	// 	console.log("Tab focused!");
	// } else if (request == "pageBlurred") {
	// 	console.log("Tab blurred!");
	// } else {
		generateData(request).then(sendResponse);
	// }
	// Important! Return true to indicate you want to send a response asynchronously
	return true;
});
