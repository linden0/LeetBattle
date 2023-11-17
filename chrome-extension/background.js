const ENVIRONMENT = 'production';
const DEV_WEBSOCKET_URL = 'ws://localhost:3000';
const PROD_WEBSOCKET_URL = 'wss://leet-battle.fly.dev';
const WEBSOCKET_URL = ENVIRONMENT === 'development' ? DEV_WEBSOCKET_URL : PROD_WEBSOCKET_URL;

let webSocket = null;
let roomID = null;
let url = null;
let screen = null;

// connect to websocket server
function connect(message) {
  webSocket = new WebSocket(WEBSOCKET_URL);

  webSocket.onopen = () => {
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
      // store url
      url = response.url;
      // open up problem tab
      chrome.tabs.create({ url: response.url });
      // tell popup.js to show room screen
      screen = 'room';
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
      // disconnect from server
      disconnect();
      // show you lose screen
      chrome.tabs.create({ url: chrome.runtime.getURL('game-end-page.html?status=lose&roomID=' + roomID) });
      // clear variables
      url = null;
      screen = null;
      roomID = null;
    }

    if (response.status === 'game-lost') {
      // disconnect from server
      disconnect();
      // show screen depending on if player lost or forfeited
      if (response.forfeit) {
        chrome.tabs.create({ url: chrome.runtime.getURL('game-end-page.html?status=forfeit') });
      } else {
        // show you win screen
        chrome.tabs.create({ url: chrome.runtime.getURL('game-end-page.html?status=win&roomID' + roomID) });
      }
      // clear variables
      url = null;
      screen = null;
      roomID = null;
    }

    if (response.status === 'room-expired') {
      roomID = null;
      url = null;
      screen = 'room-expired';
      disconnect();
    }
  };

  webSocket.onclose = (event) => {
    webSocket = null;
    roomID = null;
    url = null;
    screen = null;

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
    chrome.tabs.create({ url: chrome.runtime.getURL('game-end-page.html?status=win&roomID=' + roomID) });
    sendMessage({ status: 'game-won', roomID });
    disconnect();
    // clear variables
    url = null;
    screen = null;
    roomID = null;
  }

  if (request.message === 'forfeit') {
    sendMessage({status: 'game-lost', roomID, forfeit: true});
    roomID = null;
    url = null;
    screen = null;
    disconnect();
  }

  if (request.message === 'play-online') {
    sendMessage({status: 'play-online', difficulty: request.difficulty});
  }

  if (request.message === 'cancel-search') {
    sendMessage({status: 'cancel-search', roomID});
    roomID = null;
    url = null;
    screen = null;
    disconnect();
  }

  if (request.message === 'end-session') {
    url = null;
    screen = null;
    roomID = null;
    disconnect();
  }

  if (request.message === 'save-screen') {
    screen = request.screen;
  }

  if (request.message === 'get-screen') {
    sendResponse({ screen, roomID });
  }
  
  if (request.message === 'get-url') {
    sendResponse({ url });
  }

  if (request.message === 'test') {
    // respond with all details
    sendResponse(JSON.stringify({ url, screen, roomID, webSocket: webSocket != null }));
  }
});
