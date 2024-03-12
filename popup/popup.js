function msToTime(duration) {
	var milliseconds = Math.floor((duration % 1000) / 100),
	  seconds = Math.floor((duration / 1000) % 60),
	  minutes = Math.floor((duration / (1000 * 60)) % 60),
	  hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
  
	hours = (hours < 10) ? "0" + hours : hours;
	minutes = (minutes < 10) ? "0" + minutes : minutes;
	seconds = (seconds < 10) ? "0" + seconds : seconds;
  
	return hours + ":" + minutes + ":" + seconds + "." + milliseconds;
}

document.getElementById('sendMessage').addEventListener('click', function() {
	let body = document.getElementsByClassName("panel")[0];
	let spinner = document.getElementById("spinner");
	body.hidden = !body.hidden;

	spinner.hidden = !spinner.hidden;

	chrome.runtime.sendMessage("Hello from popup!", function(response) {
		let textElement = document.getElementById("pills-day");
		textElement.textContent = "";
		response.map((item) => {
			let newLine = document.createElement("div");
			newLine.textContent = `${msToTime(item.duration)} ${item.host}`; // `(${timeToSeconds(diff)}s) ${item.host} ${startDate.toLocaleTimeString()} ${endDate.toLocaleTimeString()}`;
			textElement.append(newLine);
		});
	});
	body.hidden = !body.hidden;
	spinner.hidden = !spinner.hidden;
});

const defaultDeleteText = "Delete data";
const confirmationText = "Are you sure?";

document.getElementById('deleteData').addEventListener('click', function() {
	if (this.textContent === defaultDeleteText) {
		this.textContent = confirmationText;
		this.className = "btn btn-danger";
		return;
	} else {
		chrome.runtime.sendMessage("deleteData", function(response) {
			console.log("Received response in popup script: " + response);
			document.getElementById("pills-day").textContent = "";
		});
		this.textContent = defaultDeleteText;
		this.className = "btn btn-primary";
	}
});
