const express = require('express');
const app = express();
const port = 3000;
const fs = require('fs');
const csv = require('csv-parser');
const redis = require('redis');
const client = redis.createClient({
    password: '***REMOVED***',
    socket: {
        host: 'redis-18576.c81.us-east-1-2.ec2.cloud.redislabs.com',
        port: 18576
    }
});

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

// Test route
app.get('/test', async (req, res) => {
  const url = await fetchLeetcodeProblem(new Set(['Medium']));
  console.log(url);
});

rooms = new Map();
// { room_id: { difficulty: set{"Medium"}, members: set(ws1, ws2) } }
wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('message', async (message) => {
      const msg = JSON.parse(message);

      if (msg.status === 'keepalive') {
        return;
      }

      if (msg.status === 'create-room') {
        console.log('crating room')
        // create room id using uuid
        let roomID = generateRandomCode();
        while (rooms.get(roomID)) {
          roomID = generateRandomCode();
        }
        // map room id to set containing ws
        rooms.set(roomID, { difficulty: new Set([msg.difficulty]), private: true, members: new Set([ws]) });
        // send room id to client
        ws.send(JSON.stringify({ status: 'return-code', roomID }));
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
        console.log('joining room')
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
            member.send(JSON.stringify({ status: 'game-lost' }));
          }
        });
        // clear room id from map
        rooms.delete(roomID);
      }

      if (msg.status === 'play-online') {
        const difficulties = new Set(msg.difficulty);
        // find a valid room to join
        rooms.forEach(async (value, key) => {
          const difficultyIntersection = [...difficulties].filter(i => value.difficulty.has(i));
          // if room is not private, is not full, and matches difficulty criteria
          if (!value.private && value.members.size === 1 && difficultyIntersection.length > 0) {
            const roomID = key;
            // add ws to set mapped to room id
            rooms.get(roomID).members.add(ws);
            const difficulty = difficultyIntersection[0];
            // get leetcode problem url
            const url = await fetchLeetcodeProblem(new Set([difficulty]));
            // broadcast game starting with problem url
            rooms.get(roomID).members.forEach((member) => {
              member.send(JSON.stringify({ status: 'game-start', url, roomID }));
            });
            // delete room id from map after 2 hours
            setTimeout(() => {
              if (rooms.get(roomID)) {
                ws.send(JSON.stringify({ status: 'room-expired' }));
                rooms.delete(roomID);
              }
            }, 7200000);
            return;
          }
        })
        console.log('creating online room')
        // otherwise, create a room and wait for another player to join
        // create room id using uuid
        const roomID = generateRandomCode();
        while (rooms.get(roomID)) {
          roomID = generateRandomCode();
        }
        // map room id to set containing ws
        rooms.set(roomID, { difficulty: difficulties, private: false, members: new Set([ws]) });
        // delete room id from map after 10 minutes, if room is not full
        setTimeout(() => {
          // if room still exists after 10 minutes not full
          if (rooms.get(roomID) && rooms.get(roomID).members.size < 2) {
            // send message to client that room expired
            ws.send(JSON.stringify({ status: 'room-expired' }));
            rooms.delete(roomID);
          }
        }, 600000);

        

      }


    });
  
    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });

app.get('/validate-room-code', (req, res) => {
  console.log('validing room code')
  const roomCode = req.query.roomCode;
  const room = rooms.get(roomCode);
  // if room does not exist, send error
  if (!room) {
    res.status(404).json({valid: false, message: 'Room does not exist'});
    return;
  }
  // if room has two players, send error
  if (room.members.size === 2) {
    res.status(400).json({valid: false, message: 'Room is full'});
    return;
  }
  // room id is valid
  res.json({valid: true});
});

function fetchLeetcodeProblem(difficulty) {
  return new Promise((resolve, reject) => {
    const problems = [];

    fs.createReadStream('leetcode-problems.csv')
      .pipe(csv())
      .on('data', (row) => {
        console.log(row.is_premium, typeof(row.is_premium));
        if (difficulty.has(row.difficulty)) {
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

app.get('/fetch-problem', (req, res) => {
  const requestedDifficulty = 'Medium'; // Get the difficulty from the request
  const problems = [];

  // Read the CSV file and filter problems by the specified difficulty
  fs.createReadStream('leetcode-problems.csv')
      .pipe(csv())
      .on('data', (row) => {
          if (row.difficulty === requestedDifficulty) {
              problems.push(row.url);
          }
      })
      .on('end', () => {
            // Select a random problem from the filtered list
            const randomURL = problems[Math.floor(Math.random() * problems.length)];
            res.json({ url: randomURL });
      });
  
});

