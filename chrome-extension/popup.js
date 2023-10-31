const savedScreens = ["enter-code", "room", "room-expired", "waiting-room"];

document.addEventListener('DOMContentLoaded', function () {
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

    // document.getElementById('test-btn2').addEventListener('click', async () => {
    //     fetch('https://leet-battle.fly.dev/test')
    //         .then(res => res.json())
    //         .then(data => console.log(data))
    //         .catch(err => console.log(err));
    // });
    
    document.getElementById('visit-create-room-btn').addEventListener('click', function () {
        showScreen('create-room');
    })
    
    document.getElementById('visit-join-room-btn').addEventListener('click', function () {
        showScreen('join-room');
    })
    
    document.getElementById('create-room-btn').addEventListener('click', function () {
        // get difficulty from dropdown
        const difficulty = document.getElementById('difficulty-select').value;
        // validate difficulty
        if (difficulty === '') {
            alert('Please select a difficulty');
            return;
        }
        // send message to background.js
        chrome.runtime.sendMessage({ message: 'create-room', difficulty });
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
        fetch(`https://leet-battle.fly.dev/validate-room-code?roomCode=${roomID}`)
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
    })

    document.getElementById('find-match-btn').addEventListener('click', function () {
        // validate difficulty
        const difficultyCheckboxContainer = document.getElementById('difficulty-checkbox');
        const selections = [];
        for (let i = 0; i < difficultyCheckboxContainer.children.length; i++) {
            const child = difficultyCheckboxContainer.children[i];
            if (child.checked) {
                selections.push(child.value);
            }
        }
        if (!selections) {
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
            document.getElementById('room-code-display').innerHTML = result['code'];
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
            "code": document.getElementById('room-code-display').innerHTML
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
        document.getElementById('room-code-display').innerHTML = request.roomID;
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



