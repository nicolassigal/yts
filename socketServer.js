'use strict';

const express = require('express'),
      socketIO = require('socket.io'),
      path = require('path'),
      search = require('youtube-search'),
      ffmpeg = require('@ffmpeg-installer/ffmpeg'),
      YoutubeMp3Downloader = require("youtube-mp3-downloader"),
      PORT = process.env.PORT || 3000,
      INDEX = path.join(__dirname, 'index.html'),
      server = express(),
      opts = { maxResults: 50, key: 'AIzaSyCnqAFM5z0dsC_gPE-DQeFrQe2PScejMMw' };

server
    .use((req, res) => res.sendFile(INDEX) )
    .listen(PORT, () => console.log(`Listening on ${ PORT }`));

const io = socketIO(server);

io.on('connection', (socket) => {
  console.log('Client connected');
  socket.on('search', query => {
    search(query, opts, function(err, results) {
        if(err) return console.log(err);
        socket.emit('search', {results: results});
    });
  })
  socket.on('disconnect', () => console.log('Client disconnected'));
});