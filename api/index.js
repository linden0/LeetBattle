const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const fs = require('fs');
const csv = require('csv-parser');
const redis = require('redis');
require('dotenv').config();
const client = redis.createClient({
    password: '***REMOVED***',
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
      user: '***REMOVED***',
      pass: '***REMOVED***'
  },
});

function sendSMS(message) {
  if (process.env.ENVIRONMENT === 'development') {
    return;
  }
  const mailOptions = {
    from: 'career-sample.com@gmail.om',
    to: '***REMOVED***',
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

rooms = new Map();

app.get('/get-player-count', (req, res) => {
  let count = 0;
  // loop through rooms
  for (const [key, value] of rooms) {
    // if room is not private and is not full
    if (!value.private) {
      count += (value.members.size == 1) ? 1 : 2;
    }
  }
  res.json({count});
});
  

// { room_id: { difficulty: set{"Medium"}, members: set(ws1, ws2) } }
wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('message', async (message) => {
      const msg = JSON.parse(message);
      
      if (msg.status === 'keepalive') {
        return;
      }

      if (msg.status === 'create-room') {
        // create room id using uuid
        let roomID = generateRandomCode();
        while (rooms.get(roomID)) {
          roomID = generateRandomCode();
        }
        // map room id to set containing ws
        rooms.set(roomID, { difficulty: new Set(msg.difficulty), private: true, members: new Set([ws]) });
        // send room id to client
        ws.send(JSON.stringify({ status: 'return-code', roomID, displayCode: true }));
        // delete room after 5 minutes, if room is not full
        setTimeout(() => {
          if (rooms.get(roomID) && rooms.get(roomID).members.size < 2) {
            // send message to client that room expired
            ws.send(JSON.stringify({ status: 'room-expired' }));
            rooms.delete(roomID);
          }
        }, 300000);
      }

      if (msg.status === 'join-room') {
        console.log('Starting Private Match')
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
        // delete room id from map after 2 hours
        setTimeout(() => {
          if (rooms.get(roomID)) {
            ws.send(JSON.stringify({ status: 'room-expired' }));
            rooms.delete(roomID);
          }
        }, 7200000);
      }

      if (msg.status === 'game-won') {
        console.log('Game Won')
        sendSMS('Game Won')
        // get room id from client
        const roomID = msg.roomID;
        // get ws from map
        const wsSet = rooms.get(roomID).members;
        // send message to other ws in set
        wsSet.forEach((member) => {
          if (member !== ws) {
            member.send(JSON.stringify({ status: 'game-won' }));
          }
        });
        // clear room id from map
        rooms.delete(roomID);
      }

      if (msg.status === 'game-lost') {
        // get room id from client
        const roomID = msg.roomID;
        // get ws from map
        const wsSet = rooms.get(roomID).members;
        // send message to other ws in set
        wsSet.forEach((member) => {
          if (member !== ws) {
            member.send(JSON.stringify({ status: 'game-lost', forfeit: msg.forfeit}));
          }
        });
        // clear room id from map
        rooms.delete(roomID);
      }

      if (msg.status === 'play-online') {
        const difficulties = new Set(msg.difficulty);
        // find a valid room to join
        for (const [key, value] of rooms) {
          // find shared problem difficulties
          const difficultyIntersection = [...difficulties].filter(i => value.difficulty.has(i));
          // if room is not private, is not full, and matches difficulty criteria
          if (!value.private && value.members.size === 1 && difficultyIntersection.length > 0) {
            console.log('found valid room')
            const roomID = key;
            // send code back
            ws.send(JSON.stringify({ status: 'return-code', roomID, displayCode: false }));
            // add ws to set mapped to room id
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
        sendSMS('Someone is playing online');
        // if no valid room found, create a room for another player to join
        // create room id
        const roomID = generateRandomCode();
        while (rooms.get(roomID)) {
          roomID = generateRandomCode();
        }
        // send code back
        ws.send(JSON.stringify({ status: 'return-code', roomID, displayCode: false }));
        // map room id to set containing ws
        rooms.set(roomID, { difficulty: difficulties, private: false, members: new Set([ws]) });
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
        console.log('deleting', msg.roomID)
        // get room id from client
        const roomID = msg.roomID;
        // clear room id from map
        rooms.delete(roomID);
      }


    });
  
    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });

//
app.get('/validate-room-code', (req, res) => {
  const roomCode = req.query.roomCode;
  const room = rooms.get(roomCode);
  // if room does not exist, send error
  if (!room) {
    return res.status(404).json({valid: false, message: 'Room does not exist'});
  }
  // if room has two players, send error
  if (room.members.size === 2) {
    return res.status(400).json({valid: false, message: 'Room is full'});
  }
  // room id is valid
  res.json({valid: true});
});



