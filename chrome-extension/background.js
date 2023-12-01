const ENVIRONMENT = 'production';
const DEV_WEBSOCKET_URL = 'ws://localhost:3000';
const PROD_WEBSOCKET_URL = 'wss://leet-battle.fly.dev';
const WEBSOCKET_URL = ENVIRONMENT === 'development' ? DEV_WEBSOCKET_URL : PROD_WEBSOCKET_URL;

let webSocket = null;
let roomID = null;
let url = null;
let screen = null;
let shuffleStatus = null;

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
      if (response.forfeit) {
        chrome.tabs.create({ url: chrome.runtime.getURL('game-end-page.html?status=forfeit') });
      } else {
        // show you win screen
        chrome.tabs.create({ url: chrome.runtime.getURL('game-end-page.html?status=win&roomID=' + roomID) });
      }
      disconnect();

    }

    if (response.status === 'game-lost') {
      // if player forfeited, don't show you lose screen, just update stats
      if (response.forfeit) {
        chrome.runtime.sendMessage({ message: 'update-stats', elo: response.elo, wins: response.wins, losses: response.losses });
        // otherwise, show you lose screen
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL('game-end-page.html?status=lose&roomID=' + roomID) });
      }
      disconnect();
    }

    if (response.status === 'room-expired') {
      roomID = null;
      url = null;
      shuffleStatus = null;
      screen = 'room-expired';
      disconnect();
    }

    if (response.status === 'request-shuffle') {
      // update shuffleStatus
      shuffleStatus = 'accept-shuffle'
      // send notification to user
      chrome.notifications.create('', {
        title: 'Leet Battle',
        message: 'Opponent has requested a problem shuffle!',
        iconUrl: 'icons/128.png',
        type: 'basic'
      });
      // tell popup script to show shuffle button if popup is open
      // FIXME: try catch still throws error, supress error
      try {
        chrome.runtime.sendMessage({ message: 'show-shuffle-accept' });
      } catch (e) {
        console.log('popup not open');
      }
      
    }

    if (response.status === 'accept-shuffle') {
      // update shuffleStatus
      shuffleStatus = null;
      // update url
      url = response.url;
      // open problem tab
      chrome.tabs.create({ url: response.url });
    }
  };

  webSocket.onclose = (event) => {
    webSocket = null;
    roomID = null;
    url = null;
    screen = null;
    shuffleStatus = null;
  };
}

function disconnect() {
  if (webSocket !== null) {
    webSocket.close();
  }
  webSocket = null;
  roomID = null;
  url = null;
  screen = null;
  shuffleStatus = null;
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
  chrome.storage.local.get(['profile'], (result) => {
    const { profile } = result;
    const profileDetails = {email: profile.email, elo: profile.elo, wins: profile.wins, losses: profile.losses};
    if (webSocket == null) {
      connect({...message, ...profileDetails});
    } else {
      webSocket.send(JSON.stringify({...message, ...profileDetails}));
    }
  });
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
    sendMessage({ status: 'game-end', roomID, result: 'win' });
    url = null;
  }

  if (request.message === 'forfeit') {
    if (!roomID) {
      return;
    }
    sendMessage({status: 'game-end', roomID, result: 'forfeit'});
  }

  if (request.message === 'play-online') {
    sendMessage({status: 'play-online', difficulty: request.difficulty});
  }

  if (request.message === 'cancel-search') {
    console.log('canceling search');
    sendMessage({status: 'cancel-search', roomID});
  }

  if (request.message === 'end-session') {
    disconnect();
  }

  if (request.message === 'save-screen') {
    screen = request.screen;
  }

  if (request.message === 'get-session-details') {
    sendResponse({ url, screen, roomID, shuffleStatus });
  }

  if (request.message === 'request-shuffle') {
    // update shuffleStatus
    shuffleStatus = 'shuffle-requested';
    sendMessage({ status: 'request-shuffle', roomID });
  }

  if (request.message === 'accept-shuffle') {
    sendMessage({ status: 'accept-shuffle', roomID });
  }

  if (request.message === 'test') {
    // respond with all details
    sendResponse(JSON.stringify({ url, screen, roomID, webSocket: webSocket == null ? 'null': 'exists'}));
  }
});
