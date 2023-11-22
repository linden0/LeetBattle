console.log('leetbattle content.js loaded');

setInterval(() => {
    console.log('listening')
    try {
        // check if current url matches problem url - if so, we are in a game, on the right problem, and should check for acceptance span
        chrome.runtime.sendMessage({ message: 'get-session-details' }, function (response) {
            if (response.url && window.location.href.includes(response.url)) {
                // check if we are on the leetcode problem submission page and acceptance span exists
                const element = document.querySelector('span[data-e2e-locator="submission-result"]');
                if (element) {
                    // send message to background indidcating player won
                    chrome.runtime.sendMessage({ message: 'game-won' });
                }
            }
        });
    }
    catch {
        console.log('error')
    }
}, 1000)