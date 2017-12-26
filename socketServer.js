"use strict";
const search = require("youtube-search");
const express = require("express");
const socketIO = require("socket.io");
const path = require("path");
const opts = { maxResults: 50, key: "AIzaSyCnqAFM5z0dsC_gPE-DQeFrQe2PScejMMw" };
const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, "index.html");
const ffmpeg = require("@ffmpeg-installer/ffmpeg");
const YoutubeMp3Downloader = require("youtube-mp3-downloader");
const http = require("http");
const crypto = require('crypto');
const stream = require("youtube-audio-stream-2");
const url = "http://youtube.com/watch?v=";
const decoder = require("lame").Decoder;
const speaker = require("speaker");
let streamVideo;
const mime = require("mime");
const cors = require("cors");
const fs = require("fs");
const bodyParser = require("body-parser");
const app = express();
const router = express.Router();
var server = http.createServer(app);
var io = require("socket.io").listen(server);
let dwnDir;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "dist")));
app.use(cors());
app.use("/api", router);
server.listen(PORT, () => console.log(`Listening on ${PORT}`));

function deleteFile(file) {
  fs.unlink(file, function(err) {
    if (err) {
      console.error(err.toString());
    } else {
      console.warn(file + " deleted");
    }
  });
}

function generateDir() {
    dwnDir = __dirname + "/files/" + generate_key();
    fs.mkdirSync(dwnDir);
    return dwnDir;
}

function generate_key() {
    var sha = crypto.createHash('sha256');
    sha.update(Math.random().toString());
    return sha.digest('hex');
};

router.get("/download/:name", function(req, res) {
  var file = dwnDir + "/" + req.params.name;
  var filename = path.basename(file);
  var mimetype = mime.lookup(file);

  res.setHeader("Content-disposition", "attachment; filename=" + filename);
  res.setHeader("Content-type", mimetype);

  var filestream = fs.createReadStream(file);
  filestream.pipe(res).once("close", function() {
    if (filestream) {
      filestream.destroy(); // makesure stream closed, not close if download aborted.
    }
  });
});


function deleteAll () {
    setTimeout(function() {
        fs.readdir(dwnDir, (err, files) => {
            if (err) throw err;
            for (const file of files) {
                if (fs.existsSync(dwnDir + "/" + file)) {
                    deleteFile(dwnDir + "/" + file);
                }
            }
        });
    }, 15000);
}
io.on("connection", socket => {
var YD = new YoutubeMp3Downloader({
    ffmpegPath: ffmpeg.path,
    outputPath: generateDir(),
    youtubeVideoQuality: "highest",
    queueParallelism: 5,
    progressTimeout: 100
    });
  console.log("Client connected");
  YD.on("progress", function(progress) {
    socket.emit("download-progress", {
      id: progress.videoId,
      progress: progress
    });
  });
  YD.on("finished", function(err, data) {
    socket.emit("download-finished", { id: data.videoId, data: data });
  });

  YD.on("queueSize", function(size) {
    socket.emit("queue-changed", { size: size });
  });
  socket.on("search", query => {
    search(query, opts, function(err, results) {
      if (err) return console.log(err);
      socket.emit("search", { results: results });
    });
  });

  socket.on("download", id => {
    YD.download(id);
  });

  socket.on("play", id => {
    try {
      streamVideo = stream(url+id)
        .pipe(decoder())
        .pipe(speaker());
    } catch (exception) {
        console.log(exception);
    }
  });
  socket.on("stop", () => {
    try {
      speaker().end();
      streamVideo.end();
    } catch (exception) {
        console.log(exception);
    }
  });

  YD.on("queueSize", function(size) {
    if (size === 0) {
        deleteAll();
    }
  });

  socket.on("disconnect", () => {
        deleteAll();
        fs.rmdirSync(dwnDir);
    });
});
