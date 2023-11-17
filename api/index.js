const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const fs = require('fs');
const csv = require('csv-parser');
const redis = require('redis');
require('dotenv').config();
const client = redis.createClient({
    password: 'WtT3ypInw99ZX18rXeF9CakITVbJvERJ',
    socket: {
        host: 'redis-18576.c81.us-east-1-2.ec2.cloud.redislabs.com',
        port: 18576
    }
});
const nodemailer = require('nodemailer');
client.on('error', (err) => {
  console.error(`Redis error: ${err}`);
});

const WebSocket = require('ws');
const server = app.listen(port, () => {
  client.connect().then(() => {
    console.log('Connected to Redis');
  });
  console.log(`Server is running on http://localhost:${port}`);
});
const wss = new WebSocket.Server({ server });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'career.sample.com@gmail.com',
    pass: 'vcqsglnukaxjejzm'
  },
});


console.log('FIXME: roomcode validation should be done through websocket');
console.log('FIXME: room code generation should handle collisions inside function');

function sendSMS(message) {
  if (process.env.ENVIRONMENT === 'development') {
    return;
  }
  const mailOptions = {
    from: 'career-sample.com@gmail.om',
    to: 'linden.wang04@gmail.com',
    subject: 'Alert',
    text: message,
  };
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
    }
  });
}

function generateRandomCode() {
  LENGTH = 6
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    code += charset[randomIndex];
  }
  return code;
}

function fetchLeetcodeProblem(difficulty) {
  if (process.env.ENVIRONMENT === 'development') {
    return new Promise((resolve, reject) => {
      resolve('https://leetcode.com/problems/two-sum/');
    });
  }
  return new Promise((resolve, reject) => {
    const problems = [];

    fs.createReadStream('leetcode-problems.csv')
      .pipe(csv())
      .on('data', (row) => {
        if (difficulty.has(row.difficulty) && row.is_premium !== "1") {
          problems.push(row.url);
        }
      })
      .on('end', () => {
        if (problems.length > 0) {
          const randomURL = problems[Math.floor(Math.random() * problems.length)];
          resolve(randomURL);
        } else {
          reject(null);
        }
      });
  });
}

// { 
//   roomID: { 
//     difficulty: set{"Medium"}, 
//     members: set([ws1, ws2]), 
//     chat: set([ws1, ws2]), 
//     isPrivate: boolean, 
//     isGameFinished: boolean 
//   }
// }
let rooms = new Map();

app.get('/test', (req, res) => {
  console.log(rooms)
});

app.get('/get-player-count', (req, res) => {
  let count = 0;
  // loop through rooms
  for (const [key, value] of rooms) {
    // if room is not private and is not full
    if (!value.private) {
      count += (value.members.size == 1) ? 1 : 2;
    }
  }
  res.json({ count });
});

app.get('/validate-room-code', (req, res) => {
  console.log('FIXME: roomcode validation should be done through websocket');
  const roomCode = req.query.roomCode;
  const room = rooms.get(roomCode);
  // if room does not exist, send error
  if (!room) {
    return res.status(404).json({ valid: false, message: 'Room does not exist' });
  }
  // if room has two players, send error
  if (room.members.size === 2) {
    return res.status(400).json({ valid: false, message: 'Room is full' });
  }
  // room id is valid
  res.json({ valid: true });
});

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('message', async (message) => {
    const msg = JSON.parse(message);

    if (msg.status === 'keepalive') {
      return;
    }

    if (msg.status === 'create-room') {
      // generate room id
      let roomID = generateRandomCode();
      while (rooms.get(roomID)) {
        roomID = generateRandomCode();
      }
      // create room and add to rooms set
      rooms.set(roomID, { difficulty: new Set(msg.difficulty), private: true, members: new Set([ws]), chat: new Set(), isGameFinished: false });
      // send room id to client
      ws.send(JSON.stringify({ status: 'return-code', roomID, displayCode: true }));
      // delete room after 5 minutes, if room is not full
      setTimeout(() => {
        // if room still exists after 5 minutes not full
        if (rooms.get(roomID) && rooms.get(roomID).members.size < 2) {
          // send message to client that room expired
          ws.send(JSON.stringify({ status: 'room-expired' }));
          rooms.delete(roomID);
        }
      }, 300000);
    }

    if (msg.status === 'join-room') {
      sendSMS('Starting Private Match');
      // get room id from client
      const roomID = msg.roomID;
      // add ws to set mapped to room id
      rooms.get(roomID).members.add(ws);
      // get leetcode problem url
      const url = await fetchLeetcodeProblem(rooms.get(roomID).difficulty);
      // broadcast game starting with problem url
      rooms.get(roomID).members.forEach((member) => {
        member.send(JSON.stringify({ status: 'game-start', url }));
      });
      // delete room after 2 hours
      setTimeout(() => {
        if (rooms.get(roomID)) {
          ws.send(JSON.stringify({ status: 'room-expired' }));
          rooms.delete(roomID);
        }
      }, 7200000);
    }

    if (msg.status === 'game-won') {
      sendSMS('Game Won')
      // get room id from client
      const roomID = msg.roomID;
      // update finished status
      rooms.get(roomID).isGameFinished = true;
      // get ws from map
      const wsSet = rooms.get(roomID).members;
      // send message to other ws in set
      wsSet.forEach((member) => {
        if (member !== ws) {
          member.send(JSON.stringify({ status: 'game-won' }));
        }
      });
    }

    if (msg.status === 'game-lost') {
      // get room id from client
      const roomID = msg.roomID;
      // update finished status
      rooms.get(roomID).isGameFinished = true;
      // get ws from map
      const wsSet = rooms.get(roomID).members;
      // send message to other ws in set
      wsSet.forEach((member) => {
        if (member !== ws) {
          member.send(JSON.stringify({ status: 'game-lost', forfeit: msg.forfeit }));
        }
      });
      if (msg.forfeit) {
        // delete room
        rooms.delete(roomID);
      }
    }

    if (msg.status === 'play-online') {
      const difficulties = new Set(msg.difficulty);
      // find a valid room to join
      for (const [key, value] of rooms) {
        // find shared problem difficulties
        const difficultyIntersection = [...difficulties].filter(i => value.difficulty.has(i));
        // if room is not private, is not full, and matches difficulty criteria
        if (!value.private && value.members.size === 1 && difficultyIntersection.length > 0) {
          const roomID = key;
          // send room id back
          ws.send(JSON.stringify({ status: 'return-code', roomID, displayCode: false }));
          // add ws to room
          rooms.get(roomID).members.add(ws);
          // get leetcode problem url
          const difficulty = difficultyIntersection[0];
          const url = await fetchLeetcodeProblem(new Set([difficulty]));
          // broadcast game starting with problem url
          rooms.get(roomID).members.forEach((member) => {
            member.send(JSON.stringify({ status: 'game-start', url, roomID }));
          });
          // delete room after 2 hours
          setTimeout(() => {
            if (rooms.get(roomID)) {
              ws.send(JSON.stringify({ status: 'room-expired' }));
              rooms.delete(roomID);
            }
          }, 7200000);
          return;
        }
      };
      // otherwise, if no valid room found, create a room for another player to join
      sendSMS('Someone is playing online');
      // generate room id
      const roomID = generateRandomCode();
      while (rooms.get(roomID)) {
        roomID = generateRandomCode();
      }
      // send code back
      ws.send(JSON.stringify({ status: 'return-code', roomID, displayCode: false }));
      // create room and add to rooms map
      rooms.set(roomID, { difficulty: difficulties, private: false, members: new Set([ws]), chat: new Set(), isGameFinished: false });
      // delete room id from map after 10 minutes, if room is not full
      setTimeout(() => {
        // if room still exists after 1 hour not full
        if (rooms.get(roomID) && rooms.get(roomID).members.size < 2) {
          // send message to client that room expired
          ws.send(JSON.stringify({ status: 'room-expired' }));
          rooms.delete(roomID);
        }
      }, 60 * 60 * 1000);
    }

    if (msg.status === 'cancel-search') {
      // get room id from client
      const roomID = msg.roomID;
      // clear room id from map
      rooms.delete(roomID);
    }

    if (msg.status === 'join-chat') {
      // get room id
      const roomID = msg.roomID;
      // if room id is invalid or room is full, send error
      if (!roomID || !rooms.get(roomID) || rooms.get(roomID).chat.size === 2) {
        ws.send(JSON.stringify({ status: 'connection-verdict', message: 'failure' }));
        return;
      } 
      // add ws to chat room
      rooms.get(roomID).chat.add(ws);      
      // send message to client that connection is successful
      ws.send(JSON.stringify({ status: 'connection-verdict', message: 'success' }));
    }

    if (msg.status === 'send-message') {
      const roomID = msg.roomID;
      // if room id is invalid or room is full, send error
      if (!roomID || !rooms.get(roomID)) {
        ws.send(JSON.stringify({ status: 'connection-verdict', message: 'failure' }));
        return;
      } 
      // get other members in chat room and broadcast message
      const wsSet = rooms.get(roomID).chat;
      wsSet.forEach((member) => {
        if (member !== ws) {
          member.send(JSON.stringify({ status: 'receive-message', message: msg.message }));
        }
      });
    }

  });

  ws.on('close', () => {
    console.log('Client disconnected');
    // find room id that ws is in
    const roomList = [...rooms];
    let roomID = null;
    for (let i = 0; i < roomList.length; i++) {
      if (roomList[i][1].members.has(ws) || roomList[i][1].chat.has(ws)) {
        roomID = roomList[i][0];
        break;
      }
    }
    // if room was already deleted, do nothing
    if (!roomID) {
      return;
    }

    // if ws disconnected from game through extension
    if (rooms.get(roomID).members.has(ws)) {
      // if game ended through win/loss do nothing, since players could still be chatting
      if (rooms.get(roomID).isGameFinished) {
        return;
      }
      // if game ended through a player quitting, send message to other player and close room
      rooms.get(roomID).members.forEach((member) => {
        if (member !== ws) {
          member.send(JSON.stringify({ status: 'game-lost', forfeit: true }));
          // delete room
          rooms.delete(roomID);
        }
      });
    }
    // elif ws disconnected from chat room
    else if (rooms.get(roomID).chat.has(ws)) {
      // remove ws from chat room
      rooms.get(roomID).chat.delete(ws);
      // if still one ws in chat room
      if (rooms.get(roomID).chat.size === 1) {
        // send message to ws that other player disconnected
        rooms.get(roomID).chat.forEach((member) => {
          member.send(JSON.stringify({ status: 'opponent-leave'}));
        });
      // delete room
      rooms.delete(roomID);
      }
    }
  });
});





