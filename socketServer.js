'use strict';
const search = require('youtube-search');
const express = require('express');
const socketIO = require('socket.io');
const path = require('path');
const opts = { maxResults: 50, key: 'AIzaSyCnqAFM5z0dsC_gPE-DQeFrQe2PScejMMw' };
const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, 'index.html');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const YoutubeMp3Downloader = require("youtube-mp3-downloader");
const YD = new YoutubeMp3Downloader({
    "ffmpegPath": ffmpeg.path,
    "outputPath": __dirname + '/files',
    "youtubeVideoQuality": "highest",
    "queueParallelism": 20,
    "progressTimeout": 1000
});
const server = express()
  .use((req, res) => res.sendFile(INDEX) )
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));

const io = socketIO(server);

io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('search', query => {
    search(query, opts, function(err, results) {
        if(err) return console.log(err);
        socket.emit('search', {results: results})
    });
  })

  socket.on('download', id  => {
    console.log("id", id);
    YD.on("progress", function(progress) {
        console.log("progress", progress);
        socket.emit('download-progress', {id: id, progress: progress});
    });
    YD.on("finished", function(err, data) {
        console.log("data", data);
        socket.emit('download-finished', {id: id, data: data});
    });

    YD.on("queueSize", function(size) {
        console.log("size", size);
        socket.emit('queue-changed', {size: size});
    });
  })
  socket.on('disconnect', () => console.log('Client disconnected'));
});
