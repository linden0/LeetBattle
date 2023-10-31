console.log('leetbattle content.js loaded');

setInterval(() => {
    console.log('listening')
    try {
        // check if we are in a game (url key exists in storage)
        chrome.storage.sync.get(['url'], (result) => {
            if (result.url && window.location.href.includes(result.url)) {
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


// // listen for message 'game-start' from background.js
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     console.log(request.message)
//     if (request.message === 'game-start') {
//         console.log('starting')
//         // set timeout to listen for game won
//         setInterval(() => {
//             console.log('listening')
//             const element = document.querySelector('span[data-e2e-locator="submission-result"]');
//             if (element) {
//                 // send message to background indidcating player won
//                 chrome.runtime.sendMessage({ message: 'game-won' });
//             }
//         }, 1000);


//         // // montior the dom and listen for the accepted span to appear
//         // // span is <span data-e2e-locator="submisson-result">Accepted</span>
        
//         // // Select the node that will be observed for mutations
//         // const targetNode = document.getElementsByTagName("BODY")[0];

//         // // Options for the observer (which mutations to observe)
//         // const config = { attributes: true, childList: true, subtree: true };

//         // // Callback function to execute when mutations are observed
//         // const callback = (mutationList, observer) => {
//         //     console.log('mutation')
//         //     const element = document.querySelector('span[data-e2e-locator="submission-result"]');
//         //     if (element) {
//         //         // send message to background indidcating player won
//         //         chrome.runtime.sendMessage({ message: 'game-won' });
//         //         observer.disconnect();
//         //     }

//         // };

//         // // Create an observer instance linked to the callback function
//         // const observer = new MutationObserver(callback);

//         // // Start observing the target node for configured mutations
//         // observer.observe(targetNode, config);

//     }
// });