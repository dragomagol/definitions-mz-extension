chrome.runtime.sendMessage({command: "newPage", page: location.hostname});

document.addEventListener("blur", () => {
	console.log("Tab blurred: ", location.hostname);
	chrome.runtime.sendMessage({command: "pageBlurred", page: location.hostname});
});

document.addEventListener("focus", () => {
	console.log("Tab focused: ", location.hostname);
	chrome.runtime.sendMessage({command: "pageFocused", page: location.hostname});
});
