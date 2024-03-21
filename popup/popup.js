const defaultDeleteText = "Delete data";
const confirmationText = "Are you sure?";

function msToTime(duration) {
	var seconds = Math.floor((duration / 1000) % 60);
	var minutes = Math.floor((duration / (1000 * 60)) % 60);
	var hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
  
	hours = (hours < 10) ? "0" + hours : hours;
	minutes = (minutes < 10) ? "0" + minutes : minutes;
	seconds = (seconds < 10) ? "0" + seconds : seconds;
  
	return hours + "h " + minutes + "m " + seconds + "s";
}

function configureGraph(response) {
	let textElement = document.getElementById("pills-day");
	textElement.textContent = "";
	let data = [];
	let hourPerDay = 0;
	
	let currentHour = new Date().getHours();
	response.map((hour) => {
		// Fill in hours with no activity
		while(currentHour < hour.hour) {
			data.push({hour: currentHour, activeTime: 0});
			currentHour = (currentHour + 1) % 24;
		}
		currentHour = (currentHour + 1) % 24;
	
		let totalTime = 0;
		hour.hostMap.map((item) => {
			totalTime += item.duration;
		});
		data.push({hour: hour.hour, activeTime: totalTime});
		hourPerDay += totalTime;
	});

	let canvas = document.createElement("canvas");
	canvas.id = "daychart";

	new Chart(
		canvas,
		{
		  type: 'bar',
		  data: {
				labels: data.map(row => row.hour),
				datasets: [
					{
						label: 'Active Minutes',
						data: data.map(row => row.activeTime / 60000),
					}
				]
			}
		}
	);
	let dayTitle = document.createElement("h2");
	dayTitle.className = "text-center";
	dayTitle.textContent = new Date().toDateString();
	textElement.append(dayTitle);
	textElement.append(canvas);
	textElement.append(document.createTextNode("Total time: " + msToTime(hourPerDay)));
}

// request data on load
// TODO: separate by time, or remove it
chrome.runtime.sendMessage({command: "getDayData"}, function(response) {
	configureGraph(response);
});

document.getElementById('deleteData').addEventListener('click', function() {
	if (this.textContent === defaultDeleteText) {
		this.textContent = confirmationText;
		this.className = "btn btn-danger";
		return;
	} else {
		chrome.runtime.sendMessage({command: "deleteData"}, function(response) {
			document.getElementById("pills-day").textContent = "";
		});
		this.textContent = defaultDeleteText;
		this.className = "btn btn-primary";
	}
});
