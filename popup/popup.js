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

document.getElementById('sendMessage').addEventListener('click', function() {
	let body = document.getElementsByClassName("panel")[0];
	// I'm pretty sure this doesn't work but whatever
    let spinner = document.getElementById("spinner");

    body.hidden = !body.hidden;
	spinner.hidden = !spinner.hidden;

	chrome.runtime.sendMessage({command: "getDayData"}, function(response) {
		let textElement = document.getElementById("pills-day");
		textElement.textContent = "";
		response.map((item) => {
            let newHeader = document.createElement("h3");
			newHeader.textContent = `${item.hour}`;
			textElement.append(newHeader);
            
            item.hostMap.map((item) => {
                let newLine = document.createElement("div");
                newLine.textContent = `${msToTime(item.duration)} - ${item.host}`;
                textElement.append(newLine);
            });
		});
	});

	body.hidden = !body.hidden;
	spinner.hidden = !spinner.hidden;
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
