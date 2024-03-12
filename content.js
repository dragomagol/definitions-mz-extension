chrome.runtime.sendMessage("Hello from content script!", function(response) {
	console.log("Received response in content script: " + response);
});

// document.addEventListener("blur", () => {
// 	console.log("Tab blurred: ", location.hostname);
// 	chrome.runtime.sendMessage("Blurred " + location.hostname);//"pageBlurred");
// });

document.addEventListener("focus", () => {
	console.log("Tab focused: ", location.hostname);
	chrome.runtime.sendMessage("Focused " + location.hostname);//"pageFocused");
});

document.addEventListener("visibilitychange", () => {
	if (document.hidden) {
		console.log("Tab hidden: ", location.hostname);
		chrome.runtime.sendMessage("Blurred " + location.hostname);
	// } else {
	// 	console.log("Tab active: ", location.hostname);
	// 	chrome.runtime.sendMessage("Focused " + location.hostname);
	}
});
