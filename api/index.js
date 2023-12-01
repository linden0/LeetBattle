const express = require('express');
const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;
const fs = require('fs');
const csv = require('csv-parser');
const redis = require('redis');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();
const dbo = require("./database/connection");
const User = require("./models/users");

const client = redis.createClient({
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: 'redis-18576.c81.us-east-1-2.ec2.cloud.redislabs.com',
        port: 18576
    }
});
const nodemailer = require('nodemailer');

if (!process.env.ENVIRONMENT) {
  console.error('ERROR: Environment variable not set');
  process.exit(1);
}

client.on('error', (err) => {
  console.error(`Redis error: ${err}`);
});

const WebSocket = require('ws');
const server = app.listen(port, () => {
  client.connect().then(() => {
    console.log('Connected to Redis');
  });
  dbo.connectToServer(function (err) {
    if (err) console.error(err);
  });
  console.log(`Server is running on http://localhost:${port}`);
});
const wss = new WebSocket.Server({ server });



console.log('FIXME: roomcode validation should be done through websocket');
console.log('FIXME: room code generation should handle collisions inside function');

function sendSMS(message) {
  if (process.env.ENVIRONMENT === 'development') {
    return;
  }
  const mailOptions = {
    from: process.env.PERSONAL_EMAIL,
    to: process.env.SECONDARY_EMAIL,
    subject: 'Alert',
    text: message,
  };
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.PERSONAL_EMAIL,
      pass: process.env.EMAIL_PASSWORD
    },
  });
  
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

function updateEloAndWinLoss(winner, loser) {
  const K = 32;
  const expectedScoreWinner = 1 / (1 + 10 ** ((loser.elo - winner.elo) / 400));
  const expectedScoreLoser = 1 / (1 + 10 ** ((winner.elo - loser.elo) / 400));
  winner.elo = Math.round(winner.elo + K * (1 - expectedScoreWinner));
  loser.elo = Math.round(loser.elo + K * (0 - expectedScoreLoser));
  winner.wins++;
  loser.losses++;
}

// { 
//   roomID: { 
//     difficulty: set{"Medium"}, 
//     members: [Player1, Player2], 
//     chat: set([ws1, ws2]), 
//     isPrivate: boolean, 
//     isGameFinished: boolean 
//   }
// }
let rooms = new Map();

app.get('/test', (req, res) => {
  console.log('rooms: ')
  rooms.forEach((value, key) => {
    console.log(key);
    console.log(value);
  });
  return res.json({ message: 'success' });
});

class Player {
  constructor(ws, elo, email, wins, losses) {
    this.ws = ws;
    this.elo = elo;
    this.email = email;
    this.wins = wins;
    this.losses = losses;
  }
}

app.post('/auth-check', async (req, res) => {
  let token = req.headers.authorization;
  token = token.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // fetch user stats from db
      const user = await User.findOne({ email: decoded.email });
      return res.json({elo: user.elo, wins: user.wins, losses: user.losses, isValid: true, email: decoded.email})
    } catch (err) {
      return res.json({ isValid: false })
    }
  } else {
    return res.json({ isValid: false })
  }
})

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.send({ error: true, message: 'Incorrect email' });
    }
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.send({ error: true, message: 'Incorrect password' });
    }

    // Generate JWT Token
    const token = jwt.sign({email: email}, process.env.JWT_SECRET, { expiresIn: '50d' });
    return res.send({ error: false, message: 'Logged in successfully', token, email: email, elo: user.elo, wins: user.wins, losses: user.losses })
  } catch (err) {
    console.log(err);
    res.send({ error: true, message: 'An error occurred while logging in' });
  }
});

app.post('/register', async (req, res) => {
  try {
    // Check if a user with the same email already exists
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.send({ error: true, message: 'A user with that email already exists' });
    }
    // Hash the password with bcrypt
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    // Create a new user with the email and hashed password
    const newUser = new User({
      email: req.body.email,
      password: hashedPassword,
    });
    newUser.save();
    const token = jwt.sign({email: req.body.email}, process.env.JWT_SECRET, { expiresIn: '2d' });
    return res.send({ error: false, message: 'User created successfully', token, email: req.body.email, elo: 1000, wins: 0, losses: 0 })

  } catch (err) {
    console.error(err);
    res.send({ error: true, message: 'An error occurred while registering a new user' });
  }
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
  if (room.members.length === 2) {
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
      rooms.set(roomID, { difficulty: new Set(msg.difficulty), private: true, members: [new Player(ws, msg.elo, msg.email, msg.wins, msg.losses)], chat: new Set(), isGameFinished: false });
      // send room id to client
      ws.send(JSON.stringify({ status: 'return-code', roomID, displayCode: true }));
      // delete room after 5 minutes, if room is not full
      setTimeout(() => {
        // if room still exists after 5 minutes not full
        if (rooms.get(roomID) && rooms.get(roomID).members.length < 2) {
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
      rooms.get(roomID).members.push(new Player(ws, msg.elo, msg.email, msg.wins, msg.losses));
      // get leetcode problem url
      const url = await fetchLeetcodeProblem(rooms.get(roomID).difficulty);
      // broadcast game starting with problem url
      rooms.get(roomID).members.forEach((member) => {
        member.ws.send(JSON.stringify({ status: 'game-start', url }));
      });
      // delete room after 2 hours
      setTimeout(() => {
        if (rooms.get(roomID)) {
          ws.send(JSON.stringify({ status: 'room-expired' }));
          rooms.delete(roomID);
        }
      }, 7200000);
    }

    if (msg.status === 'game-end') {
      // get room id from client
      const roomID = msg.roomID;
      // update finished status
      rooms.get(roomID).isGameFinished = true;
      // find winner and loser
      let winner = null;
      let loser = null;
      if (msg.result === 'win') {
        if (rooms.get(roomID).members[0].ws === ws) {
          winner = rooms.get(roomID).members[0];
          loser = rooms.get(roomID).members[1];
        } else {
          winner = rooms.get(roomID).members[1];
          loser = rooms.get(roomID).members[0];
        }
      }
      else if (msg.result === 'forfeit') {
        if (rooms.get(roomID).members[0].ws === ws) {
          winner = rooms.get(roomID).members[1];
          loser = rooms.get(roomID).members[0];
        }
        else {
          winner = rooms.get(roomID).members[0];
          loser = rooms.get(roomID).members[1];
        }
      }
      // update their elo/wins/losses
      updateEloAndWinLoss(winner, loser);
      // save stats to db
      try {
        await User.updateOne({ email: winner.email }, { elo: winner.elo, wins: winner.wins, losses: winner.losses });
        await User.updateOne({ email: loser.email }, { elo: loser.elo, wins: loser.wins, losses: loser.losses });
      }
      catch {
        sendSMS('Error saving stats to db');
      }
      // send message to each player
      winner.ws.send(JSON.stringify({ status: 'game-won', forfeit: msg.result === 'forfeit', elo: winner.elo, wins: winner.wins, losses: winner.losses }));
      loser.ws.send(JSON.stringify({ status: 'game-lost', forfeit: msg.result === 'forfeit', elo: loser.elo, wins: loser.wins, losses: loser.losses}));

      if (msg.result === 'forfeit') {
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
        if (!value.private && value.members.length === 1 && difficultyIntersection.length > 0) {
          const roomID = key;
          // send room id back
          ws.send(JSON.stringify({ status: 'return-code', roomID, displayCode: false }));
          // add ws to room
          rooms.get(roomID).members.push(new Player(ws, msg.elo, msg.email, msg.wins, msg.losses));
          // get leetcode problem url
          const difficulty = difficultyIntersection[0];
          const url = await fetchLeetcodeProblem(new Set([difficulty]));
          // broadcast game starting with problem url
          rooms.get(roomID).members.forEach((member) => {
            member.ws.send(JSON.stringify({ status: 'game-start', url, roomID }));
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
      rooms.set(roomID, { difficulty: difficulties, private: false, members: [new Player(ws, msg.elo, msg.email, msg.wins, msg.losses)], chat: new Set(), isGameFinished: false });
      // delete room id from map after 10 minutes, if room is not full
      setTimeout(() => {
        // if room still exists after 1 hour not full
        if (rooms.get(roomID) && rooms.get(roomID).members.length < 2) {
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
      ws.close();
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

    if (msg.status === 'request-shuffle') {
      // get roomID
      const roomID = msg.roomID;
      // validate roomID
      if (!roomID || !rooms.get(roomID)) {
        return;
      }
      // send message to other player
      rooms.get(roomID).members.forEach((member) => {
        if (member.ws !== ws) {
          member.ws.send(JSON.stringify({ status: 'request-shuffle' }));
        }
      });
    }

    if (msg.status === 'accept-shuffle') {
      // get roomID
      const roomID = msg.roomID;
      // validate roomID
      if (!roomID || !rooms.get(roomID)) {
        return;
      }
      // get difficulty of room
      const difficulty = rooms.get(roomID).difficulty;
      // generate new problem url
      let url = null;
      if (process.env.ENVIRONMENT === 'development') {
        url = 'https://leetcode.com/problems/palindrome-number/';
      } else {
        url = await fetchLeetcodeProblem(difficulty);
      }
      // send message to both players
      rooms.get(roomID).members.forEach((member) => {
        member.ws.send(JSON.stringify({ status: 'accept-shuffle', url }));
      });
    }

  });

  ws.on('close', (message) => {
    console.log('Client disconnected');
    // find room id that ws is in
    const roomList = [...rooms];
    let roomID = null;
    let isGameDisconnect = false;

    for (let i = 0; i < roomList.length; i++) {
      roomList[i][1].members.forEach((member) => {
        if (member.ws === ws) {
          isGameDisconnect = true;
        }
      });

      if (isGameDisconnect || roomList[i][1].chat.has(ws)) {
        roomID = roomList[i][0];
        break;
      }
    }
    // if room was already deleted, do nothing
    if (!roomID) {
      return;
    }

    if (isGameDisconnect) {
      // if game ended through win/loss do nothing, since players could still be chatting
      if (rooms.get(roomID).isGameFinished) {
        return;
      }
      // if game ended through a player quitting, send message to other player and close room
      rooms.get(roomID).members.forEach((member) => {
        if (member.ws !== ws) {
          member.ws.send(JSON.stringify({ status: 'game-lost', forfeit: true }));
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