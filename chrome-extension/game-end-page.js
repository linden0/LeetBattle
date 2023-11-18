const ENVIRONMENT = 'production';
const WEBSOCKET_URL = ENVIRONMENT === 'development' ? 'ws://localhost:3000' : 'wss://leet-battle.fly.dev';
let webSocket = null;

document.addEventListener('DOMContentLoaded', function () {

  // fetch status - win/lose, roomID
  const params = new URLSearchParams(location.search);
  const result = params.get('status');
  const roomID = params.get('roomID');

  // render correct header based on result
  if (result === 'win') {
      document.getElementById('result').innerHTML = `<img src="img/victory-royale.png" alt="victory-royale" id="victory-royale" style="height: 150px;"></img>`
  }
  else if (result == 'lose') {
      document.getElementById('result').innerHTML = 
      `<h2>Eliminated</h2>`
  }
  else if (result == 'forfeit') {
    document.getElementById('result').innerHTML = `<h2>Your Opponent Forfeit</h2>`;
    document.getElementById('chatbox-input').style.display = 'none';
    document.getElementById('chatbox').innerHTML = `<img src="img/crying-emote.gif" alt="crying-emote" style="height: 100%;"></img>`;
  }

  
  // connect to websocket to initiate chat
  if (result !== 'forfeit') {

    // bind send message btn to sendMessage function
    document.getElementById('send-message-btn').addEventListener('click', sendMessage);
    document.getElementById('chat-input').addEventListener('keyup', function (event) {
      // if 'enter' key is pressed, send message
      if (event.keyCode === 13) {
        event.preventDefault();
        document.getElementById('send-message-btn').click();
      }
    });

    webSocket = new WebSocket(WEBSOCKET_URL);
  
    webSocket.addEventListener('open', (event) => {
      console.log('Connected to the server');
      webSocket.send(JSON.stringify({ status: 'join-chat', roomID }));
    });

    webSocket.onmessage = (event) => {
      const response = JSON.parse(event.data);

      if (response.status === 'connection-verdict') {
        if (response.message === 'success') {
          addMessage('Your opponent has joined the chat', 'system')
        }
        else {
          disableChat();
          alert('This room is not available')
          webSocket.close();
        }
      }

      if (response.status === 'receive-message') {
        addMessage(response.message, 'opponent');
      }

      if (response.status === 'opponent-leave') {
        addMessage('Your opponent has left the chat', 'system');
        webSocket.close();
        disableChat();
      }
    };

    webSocket.onclose = (event) => {
      console.log('Disconnected from the server');
    };

    function sendMessage() {
      const input = document.getElementById('chat-input');
      const message = input.value;
      webSocket.send(JSON.stringify({ status: 'send-message', message, roomID }));
      addMessage(message, 'you');
      input.value = '';
    }
    
    function addMessage(message, sender) {
      // don't allow empty messages
      if (message === '') {
        return;
      }
      // play audio
      const audio = new Audio('message.mp3');
      audio.play();
      const chatbox = document.getElementById('chatbox');
      var newMessage = document.createElement('div');
      newMessage.classList.add(sender);
      newMessage.innerHTML = message;
      chatbox.appendChild(newMessage);
      // scroll to bottom
      chatbox.scrollTop = chatbox.scrollHeight;
    }
    
    function disableChat() {
      document.getElementById('chat-input').disabled = true;
      document.getElementById('chat-input').style.cursor = 'not-allowed';
      document.getElementById('send-message-btn').disabled = true;
      document.getElementById('send-message-btn').style.cursor = 'not-allowed';
    }
    
  }
});






