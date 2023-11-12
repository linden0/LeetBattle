const ENVIRONMENT = 'production';
const DEV_WEBSOCKET_URL = 'ws://localhost:3000';
const PROD_WEBSOCKET_URL = 'wss://leet-battle.fly.dev';
const WEBSOCKET_URL = ENVIRONMENT === 'development' ? DEV_WEBSOCKET_URL : PROD_WEBSOCKET_URL;

let webSocket = null;
let roomID = null;

// connect to websocket server
function connect(message) {
  webSocket = new WebSocket(WEBSOCKET_URL);

  webSocket.onopen = () => {
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
      // send push notification with chrome.notifications
      chrome.notifications.create('', {
        title: 'Leet Battle',
        message: 'Match found!',
        iconUrl: 'icons/128.png',
        type: 'basic'
      });
      
      // update roomID variable
      if (response.roomID) {
        roomID = response.roomID;
      }
      // store url in storage
      chrome.storage.sync.set({ 'url': response.url });
      // open up a problem tab
      chrome.tabs.create({ url: response.url });
      // Tell popup.js to show room screen
      chrome.storage.sync.set({ 'screen' : {'screen-name': 'room'} });

    }

    if (response.status === 'return-code') {
      // update roomID variable
      roomID = response.roomID;
      if (response.displayCode) {
        // send code to popup.js
        chrome.runtime.sendMessage({ message: 'return-code', roomID: response.roomID });
      }
    }

    if (response.status === 'game-won') {
      chrome.storage.sync.clear();
      // disconnect from server
      disconnect();
      // show you lose screen
      chrome.tabs.create({ url: chrome.runtime.getURL('game-end-page.html?status=lose') });
      roomID = null;
    }

    if (response.status === 'game-lost') {
      chrome.storage.sync.clear();
      // disconnect from server
      disconnect();
      if (response.forfeit) {
        chrome.tabs.create({ url: chrome.runtime.getURL('game-end-page.html?status=forfeit') });
      } else {
        // show you win screen
        chrome.tabs.create({ url: chrome.runtime.getURL('game-end-page.html?status=win') });
      }
      roomID = null;
    }

    if (response.status === 'room-expired') {
      roomID = null;
      // show room expired screen if popup is open, otherwise save screen to storage
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
    sendMessage({ status: 'create-room', difficulty: request.difficulty });

  }
  if (request.message === 'join-room') {
    roomID = request.roomID;
    sendMessage({ status: 'join-room', roomID });
  }
  if (request.message === 'game-won') {
    if (!roomID) {
      return;
    }
    // open result page
    chrome.tabs.create({ url: chrome.runtime.getURL('game-end-page.html?status=win') });
    sendMessage({ status: 'game-won', roomID });
    // clear storage
    chrome.storage.sync.clear();
    disconnect();
  }
  if (request.message === 'forfeit') {
    sendMessage({status: 'game-lost', roomID, forfeit: true});
    roomID = null;
    disconnect();
  }
  if (request.message === 'play-online') {
    sendMessage({status: 'play-online', difficulty: request.difficulty});
  }
  if (request.message === 'cancel-search') {
    sendMessage({status: 'cancel-search', roomID});
    roomID = null;
    disconnect();
  }
});