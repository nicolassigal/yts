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
const http = require('http');
const mime = require('mime');
const cors = require('cors');
const fs = require('fs');
const bodyParser = require('body-parser');

const app  = express(); 
const router = express.Router();
var server = http.createServer(app);
var io = require('socket.io').listen(server); 

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'dist')));
app.use(cors());
app.use('/api', router);
server.listen(PORT, () => console.log(`Listening on ${ PORT }`));
var YD = new YoutubeMp3Downloader({
    "ffmpegPath": ffmpeg.path,
    "outputPath": __dirname + '/files',
    "youtubeVideoQuality": "highest",
    "queueParallelism": 5,
    "progressTimeout": 100
});



function deleteFile (file) { 
    fs.unlink(file, function (err) {
        if (err) {
            console.error(err.toString());
        } else {
            console.warn(file + ' deleted');
        }
    });
}

router.get('/download/:name', function(req, res) {
    var file = __dirname + '/files/'+ req.params.name;
    var filename = path.basename(file);
    var mimetype = mime.lookup(file);
  
    res.setHeader('Content-disposition', 'attachment; filename=' + filename);
    res.setHeader('Content-type', mimetype);
  
    var filestream = fs.createReadStream(file);
    filestream.pipe(res).once("close", function () {
      if(filestream){
      filestream.destroy(); // makesure stream closed, not close if download aborted.
      }
  });
});

io.on('connection', (socket) => {
  console.log('Client connected');
    YD.on("progress", function(progress) {
    socket.emit('download-progress', {id: progress.videoId, progress: progress});
    });
    YD.on("finished", function(err, data) {
        socket.emit('download-finished', {id: data.videoId, data: data});
    });

    YD.on("queueSize", function(size) {
        socket.emit('queue-changed', {size: size});
    });
  socket.on('search', query => {
    search(query, opts, function(err, results) {
        if(err) return console.log(err);
        socket.emit('search', {results: results})
    });
  })

  socket.on('download', id  => {
    YD.download(id);
  });

  YD.on("queueSize", function(size) {
      if(size === 0){
        setTimeout(function(){
            fs.readdir(__dirname + '/files', (err, files) => {
                if (err) throw err;
                for (const file of files) {
                    if (fs.existsSync(__dirname + '/files/'+file)) {
                        deleteFile(__dirname + '/files/'+file);
                    }
                }
            }); 
        }, 15000);
      }
  });

  socket.on('disconnect', () => console.log('Client disconnected'));
});
