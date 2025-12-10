function log(msg) {
    const el = document.getElementById("log");
    el.textContent += msg + "\n";
    el.scrollTop = el.scrollHeight;
}

async function injectScript(file) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true});
    if (!tab?.id) {
        log("No active tab.");
        return;
    }

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [file]
    });

    log(`Injected ${file}`);
}

document.getElementById("solve-sudoku").addEventListener("click", () => {
    injectScript("sudoku_content.js").catch(err => log("Error: " + err));
});

document.getElementById("solve-zip").addEventListener("click", () => {
    injectScript("zip_content.js").catch(err => log("Error: " + err));
});
