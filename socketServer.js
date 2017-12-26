'use strict';
const search = require('youtube-search');
const express = require('express');
const socketIO = require('socket.io');
const path = require('path');
const opts = { maxResults: 50, key: 'AIzaSyCnqAFM5z0dsC_gPE-DQeFrQe2PScejMMw' };
const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, 'index.html');

const server = express()
  .use((req, res) => res.sendFile(INDEX) )
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));

const io = socketIO(server);

io.on('connection', (socket) => {
  console.log('Client connected');
  socket.on('search', query => {
      console.log("query", query);
    search(query, opts, function(err, results) {
        if(err) return console.log(err);
        console.log("results", results);
        socket.emit('search', {results: results})
    });
  })
  socket.on('disconnect', () => console.log('Client disconnected'));
});
