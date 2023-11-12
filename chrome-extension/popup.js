const ENVIRONMENT = 'development';
const DEV_API_URL = 'http://localhost:3000';
const PROD_API_URL = 'https://leet-battle.fly.dev';
const API_URL = ENVIRONMENT === 'development' ? DEV_API_URL : PROD_API_URL;

const savedScreens = ["enter-code", "room", "room-expired", "waiting-room"];

document.addEventListener('DOMContentLoaded', function () {
    //implement copy code button
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
            // clear storage
            chrome.storage.sync.clear();
            showScreen('home');
        });
    }

    // when id="test-btn" is clicked, fetch to localhost:3000/test
    // document.getElementById('test-btn1').addEventListener('click', async () => {
    //     chrome.storage.sync.clear();
    // });

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
        // clear storage
        chrome.storage.sync.clear();
        // send message to background.js
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
        // clear storage
        chrome.storage.sync.clear();
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
    chrome.storage.sync.get(['screen'], function (result) {
        result = result['screen'];
        if (!result || (!savedScreens.includes(result['screen-name']))) {
            return;
        }
        else if (result['screen-name'] === 'enter-code') {
            
            // display code
            document.getElementById('room-code-display').value = result['code'];
            // show enter code screen
            showScreen('enter-code');
        }
        else {
            showScreen(result['screen-name']);
        }
    });
}

// show correct screen
function showScreen(screen) {
    closeScreens();
    document.getElementById(screen).style.display = "block";
    // save screen to storage
    if (savedScreens.includes(screen)) {
        const screenObj = (screen === 'enter-code') ? {
            "screen-name": screen,
            "code": document.getElementById('room-code-display').value
        } : {
            "screen-name": screen
        };
        chrome.storage.sync.set({ 'screen' : screenObj });
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
});



