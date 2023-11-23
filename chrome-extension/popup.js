const ENVIRONMENT = 'production';
const DEV_API_URL = 'http://localhost:3000';
const PROD_API_URL = 'https://leet-battle.fly.dev';
const API_URL = ENVIRONMENT === 'development' ? DEV_API_URL : PROD_API_URL;

// screens that should persist until user navigates away
const savedScreens = ["enter-code", "room", "room-expired", "waiting-room"];

document.addEventListener('DOMContentLoaded', function () {

    // capitalize letters when entering room code
    document.getElementById('room-code').addEventListener('input', function () {
        document.getElementById('room-code').value = document.getElementById('room-code').value.toUpperCase();
    });

    // copy code to clipboard
    document.getElementById('copy-code-btn').addEventListener('click', function () {
        const code = document.getElementById('room-code-display').value;
        navigator.clipboard.writeText(code);
    });

    // implement back button
    const backButtons = document.getElementsByClassName('back-btn');
    for (let i = 0; i < backButtons.length; i++) {
        backButtons[i].addEventListener('click', function () {
            // if on enter code page, send message to background.js to delete room
            if (document.getElementById('enter-code').style.display === 'block') {
                chrome.runtime.sendMessage({ message: 'cancel-search' });
            }
            // end session and disconnect
            chrome.runtime.sendMessage({ message: 'end-session' });
            showScreen('home');
        });
    }

    // document.getElementById('test-btn1').addEventListener('click', async () => {
    //     // send message to background with message = test, and alert with response
    //     chrome.runtime.sendMessage({ message: 'test' }, function (response) {
    //         alert(response);
    //     });
    // });
    // document.getElementById('test-btn2').addEventListener('click', async () => {
    //     fetch(`${API_URL}/test`)
    //         .then(res => res.json())
    //         .then(data => alert(data.message))
    //         .catch(err => console.log(err));
    // });
    
    document.getElementById('request-shuffle-btn').addEventListener('click', function () {
        // send message to background.js
        chrome.runtime.sendMessage({ message: 'request-shuffle' });
        // hide shuffle button, accept button
        document.getElementById('request-shuffle-btn').style.display = 'none';
        document.getElementById('accept-shuffle-btn').style.display = 'none';
        // show room status that shuffle has been requested, waiting for opponent to accept
        document.getElementById('room-status').innerText = 'Waiting for your opponent to accept shuffle request...';
        document.getElementById('room-status').style.display = 'block';
    }); 

    document.getElementById('accept-shuffle-btn').addEventListener('click', function () {
        //      send message to background.js
        chrome.runtime.sendMessage({ message: 'accept-shuffle' });
        //      show message in popup that shuffle has been accepted
        document.getElementById('room-status').innerText = 'Shuffle accepted! Redirecting to new problem...';
        document.getElementById('room-status').style.display = 'block';
        //      hide shuffle button, accept button
        document.getElementById('request-shuffle-btn').style.display = 'none';
        document.getElementById('accept-shuffle-btn').style.display = 'none';
    });

    document.getElementById('visit-create-room-btn').addEventListener('click', function () {
        showScreen('create-room');
    })
    
    document.getElementById('visit-join-room-btn').addEventListener('click', function () {
        showScreen('join-room');
    })
    
    document.getElementById('create-room-btn').addEventListener('click', function () {
        // validate difficulty
        const difficultyCheckboxContainer = document.getElementById('create-room-difficulty-checkbox');
        const selections = [];
        for (let i = 0; i < difficultyCheckboxContainer.children.length; i++) {
            const child = difficultyCheckboxContainer.children[i];
            if (child.children[0].checked) {
                selections.push(child.children[0].value);
            }
        }
        if (selections.length === 0) {
            alert('Please select at least one difficulty, or all if no preference')
            return;
        }

        // send message to background.js
        chrome.runtime.sendMessage({ message: 'create-room', difficulty: selections });
        // show enter code screen
        showScreen('enter-code');
    })
    
    document.getElementById('join-room-btn').addEventListener('click', function () {
        // get room code from input
        const roomID = document.getElementById('room-code').value;
        // validate room code
        if (roomID === '') {
            alert('Please enter a room code');
            return;
        }
        // validate room code
        fetch(`${API_URL}/validate-room-code?roomCode=${roomID}`)
            .then(res => res.json())
            .then(data => {
                console.log('here')
                if (data.valid) {
                    // send message to background.js
                    chrome.runtime.sendMessage({ message: 'join-room', roomID });
                } else {
                    alert('Invalid room code');
                }
            })
            .catch(err => console.log(err));
    });

    document.getElementById('forfeit').addEventListener('click', function () {
        showScreen('home');
        chrome.runtime.sendMessage({message: 'forfeit'})
    });

    document.getElementById('visit-play-online-btn').addEventListener('click', function() {
        showScreen('play-online');
        fetch(`${API_URL}/get-player-count`)
            .then(res => res.json())
            .then(data => {
                document.getElementById('player-count').innerHTML = data.count + ' players online';
            })
            .catch(err => console.log(err));
    })

    document.getElementById('find-match-btn').addEventListener('click', function () {
        // validate difficulty
        const difficultyCheckboxContainer = document.getElementById('play-online-difficulty-checkbox');
        const selections = [];
        for (let i = 0; i < difficultyCheckboxContainer.children.length; i++) {
            const child = difficultyCheckboxContainer.children[i];
            if (child.children[0].checked) {
                selections.push(child.children[0].value);
            }
        }
        if (selections.length === 0) {
            alert('Please select at least one difficulty, or all if no preference')
            return;
        }
        showScreen('waiting-room');
        chrome.runtime.sendMessage({ message: 'play-online', difficulty: selections });

    })

    document.getElementById('cancel-search').addEventListener('click', function () {
        showScreen('home');
        // send message to background.js
        chrome.runtime.sendMessage({message: 'cancel-search'});
    });

    renderScreens();
    
});

// render saved screens if necessary
// "screen" : {
//     "screen-name": "enter-code",
//     "code": "123456"
// }
function renderScreens() {
    // get screen from background script
    try {
        chrome.runtime.sendMessage({ message: 'get-session-details' }, function (response) {
            if (!response.shuffleStatus) {
                // hide shuffle button, accept button, and room status
                document.getElementById('request-shuffle-btn').style.display = 'none';
                document.getElementById('accept-shuffle-btn').style.display = 'none';
                document.getElementById('room-status').style.display = 'none';
                // show shuffle button
                document.getElementById('request-shuffle-btn').style.display = 'block';
            }
            else if (response.shuffleStatus === 'accept-shuffle') {
                // hide shuffle button, accept button, and room status
                document.getElementById('request-shuffle-btn').style.display = 'none';
                document.getElementById('accept-shuffle-btn').style.display = 'none';
                document.getElementById('room-status').style.display = 'none';
                // show accept button
                document.getElementById('accept-shuffle-btn').style.display = 'block';
                document.getElementById('room-status').innerText = "Your opponent doesn't like this problem. Wanna shuffle?";
                document.getElementById('room-status').style.display = 'block';
            }
            else if (response.shuffleStatus === 'shuffle-requested') {
                // hide shuffle button, accept button, and room status
                document.getElementById('request-shuffle-btn').style.display = 'none';
                document.getElementById('accept-shuffle-btn').style.display = 'none';
                document.getElementById('room-status').style.display = 'none';
                // show room status
                document.getElementById('room-status').innerText = 'Waiting for your opponent to accept shuffle request...';
                document.getElementById('room-status').style.display = 'block';
            }

            if (response.screen) {
                if (response.screen === 'enter-code') {
                    // display code
                    document.getElementById('room-code-display').value = response.roomID;
                }
                showScreen(response.screen);
            } else {
                showScreen('home');
            }
        });
    }
    catch(e) {
        console.log(e)
        showScreen('home');
    }

}

// show correct screen
function showScreen(screen) {
    console.log(screen);
    closeScreens();
    document.getElementById(screen).style.display = "block";
    // save screen to storage
    if (savedScreens.includes(screen)) {
        chrome.runtime.sendMessage({ message: 'save-screen', screen });
    }
}

// close all screens
function closeScreens() {
    document.getElementById('home').style.display = "none";
    document.getElementById('create-room').style.display = "none";
    document.getElementById('join-room').style.display = "none";
    document.getElementById('enter-code').style.display = "none";
    document.getElementById('room').style.display = "none";
    document.getElementById('room-expired').style.display = "none";
    document.getElementById('play-online').style.display = "none";
    document.getElementById('waiting-room').style.display = "none";
}

// listen for message from background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'return-code') {
        document.getElementById('room-code-display').value = request.roomID;
        showScreen('enter-code');
    }
    if (request.message === 'game-start') {
        // show correct screen
        showScreen('room');
    }
    if (request.message === 'room-expired') {
        // show room expired screen
        showScreen('room-expired');
    }
    if (request.message === 'show-shuffle-accept') {
        // hide shuffle button, accept button, and room status
        document.getElementById('request-shuffle-btn').style.display = 'none';
        document.getElementById('accept-shuffle-btn').style.display = 'none';
        document.getElementById('room-status').style.display = 'none';
        // show accept button
        document.getElementById('accept-shuffle-btn').style.display = 'block';
        document.getElementById('room-status').innerText = "Your opponent doesn't like this problem. Wanna shuffle?";
        document.getElementById('room-status').style.display = 'block';
    }
});



