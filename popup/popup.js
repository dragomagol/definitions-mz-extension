const defaultDeleteText = "Delete data";
const confirmationText = "Are you sure?";

var dayData; 

function msToTime(duration) {
	let seconds = Math.floor((duration / 1000) % 60);
	let minutes = Math.floor((duration / (1000 * 60)) % 60);
	let hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
  
	hours = (hours < 10) ? "0" + hours : hours;
	minutes = (minutes < 10) ? "0" + minutes : minutes;
	seconds = (seconds < 10) ? "0" + seconds : seconds;
  
	return hours + "h " + minutes + "m " + seconds + "s";
}

function hourBreakdownChart(event, active, dayData) {
	let datasetIndex = active[0].datasetIndex;
	let dataIndex = active[0].index;

	// The active time in minutes
	let value = event.chart.data.datasets[datasetIndex].data[dataIndex];
	// The hour
	let label = event.chart.data.labels[dataIndex];

	let hourlyData = [];
	dayData.map((period) => {
		if (period.hour == label) {
			period.hostMap.map((item) => {
				hourlyData.push({
					host: item.host, duration: Math.round(item.duration / 60000)
				});
			});
		}
	});

	let hourBreakdown = document.createElement("canvas");
	new Chart(
		hourBreakdown, {
			type: 'pie',
			data: {
				labels: hourlyData.map(row => row.host),
				datasets: [{ data: hourlyData.map(row => row.duration) }]
			},
			options: {
				plugins: {
					title: {
						display: true,
						text: "Hourly breakdown for " + label + ":00"
					}
				}
			}
		}
	);
	return hourBreakdown;
}

function configureDayGraph(response) {
	let textElement = document.getElementById("dayTotal");
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
			},
			options: {
				responsive: true,
				onClick: (e, active) => {
					if (active.length == 0 || dayData.length == undefined) {
						return;
					}
					let chartElement = document.getElementById("hourBreakdown");
					chartElement.innerHTML = "";
					chartElement.append(hourBreakdownChart(e, active, response));
				}
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
// TODO: separate by duration (day week month), or remove it
chrome.runtime.sendMessage({command: "getDayData"}, function(response) {
	dayData = response;
	configureDayGraph(response);
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
