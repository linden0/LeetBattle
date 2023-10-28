let webSocket = null;
let roomID = null;


function connect(message) {
  webSocket = new WebSocket('ws://localhost:3000');

  webSocket.onopen = (event) => {
    console.log('websocket open');
    keepAlive();
    if (message) {
      webSocket.send(JSON.stringify(message))
    }
  };

  webSocket.onmessage = (event) => {
    const response = JSON.parse(event.data);
    // if message.status is game-start, start match
    if (response.status === 'game-start') {
      if (response.roomID) {
        roomID = response.roomID;
      }
      // open up a problem tab
      chrome.tabs.create({ url: response.url }, (newTab) => {
        // Wait for the new tab to be fully loaded
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
          if (tabId === newTab.id && changeInfo.status === 'complete') {
            // The new tab has finished loading, so it's safe to send the message now
            chrome.tabs.sendMessage(newTab.id, { message: 'game-start' });
            
            // Tell popup.js to show room screen
            chrome.storage.sync.set({ 'screen' : {'screen-name': 'room'} });

            // Remove the listener to avoid sending the message multiple times
            chrome.tabs.onUpdated.removeListener(listener);
          }
        });
      });
      
    }
    // if message.status is return-code
    if (response.status === 'return-code') {
      // update roomID variable
      roomID = response.roomID;
      // send code to popup.js
      chrome.runtime.sendMessage({ message: 'return-code', roomID: response.roomID });
    }
    // if message.status is game-won
    if (response.status === 'game-won') {
      chrome.storage.sync.clear();
      // disconnect from server
      disconnect();
      // show you lose screen
      chrome.tabs.create({ url: chrome.runtime.getURL('game-end-page.html?status=false') });
    }
    if (response.status === 'game-lost') {
      chrome.storage.sync.clear();
      // disconnect from server
      disconnect();
      // show you win screen
      chrome.tabs.create({ url: chrome.runtime.getURL('game-end-page.html?status=true') });
    }
    if (response.status === 'room-expired') {
      roomID = null;
      // check if popup is running
      try {
        chrome.runtime.sendMessage({ message: 'room-expired' });
      }
      catch (err) {
        chrome.storage.sync.set({ 'screen' : {'screen-name': 'room-expired'} });
      }
    }

    
  };

  webSocket.onclose = (event) => {
    console.log('websocket connection closed');
    webSocket = null;
  };
}

function disconnect() {
  if (webSocket == null) {
    return;
  }
  webSocket.close();
}

function keepAlive() {
  const keepAliveIntervalId = setInterval(
    () => {
      if (webSocket) {
        console.log('staying alive')
        webSocket.send(JSON.stringify({status: 'keepalive'}));
      } else {
        clearInterval(keepAliveIntervalId);
      }
    },
    // Set the interval to 20 seconds to prevent the service worker from becoming inactive.
    20 * 1000 
  );
}



function sendMessage(message) {
  if (webSocket == null) {
    connect(message);
  } else {
    webSocket.send(JSON.stringify(message));
  }

}

// receive message from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'create-room') {
    console.log('creating room')
    sendMessage({ status: 'create-room', difficulty: request.difficulty });

  }
  if (request.message === 'join-room') {
    roomID = request.roomID;
    sendMessage({ status: 'join-room', roomID: request.roomID });
  }
  if (request.message === 'game-won') {
    // open result page
    chrome.tabs.create({ url: chrome.runtime.getURL('game-end-page.html?status=true') });
    sendMessage({ status: 'game-won', roomID });
    // clear storage
    chrome.storage.sync.clear();
    disconnect();
  }
  if (request.message === 'forfeit') {
    sendMessage({status: 'game-lost', roomID});
    roomID = null;
    disconnect();
  }
  if (request.message === 'play-online') {
    sendMessage({status: 'play-online', difficulty: request.difficulty});
  }
});