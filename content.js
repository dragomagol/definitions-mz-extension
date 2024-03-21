chrome.runtime.sendMessage({command: "newPage", page: location.hostname});

document.addEventListener("blur", () => {
	chrome.runtime.sendMessage({command: "pageBlurred", page: location.hostname});
});

document.addEventListener("focus", () => {
	chrome.runtime.sendMessage({command: "pageFocused", page: location.hostname});
});
