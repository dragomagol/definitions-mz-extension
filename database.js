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
				console.error("Database not open.");
				reject("Database not open.");
			}
			
			const insertTransaction = this.db.transaction(this.tableName, "readwrite");
			const dataTable = insertTransaction.objectStore(this.tableName);

			let request = await dataTable.add(timeBlock, timeBlock.startTime);

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
