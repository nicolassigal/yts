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
const crypto = require("crypto");
const mime = require("mime");
const cors = require("cors");
const fs = require("fs-extra");
const bodyParser = require("body-parser");
const app = express();
const router = express.Router();
var server = http.createServer(app);
var io = require("socket.io").listen(server);
let dir;
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "dist")));
app.use(cors());
app.use("/api", router);
server.listen(PORT, () => console.log(`Listening on ${PORT}`));
let method;
function deleteFile(file) {
  fs.unlink(file, function(err) {
    if (err) {
      console.error(err.toString());
    } else {
      console.warn(file + " deleted");
    }
  });
}

var YD = new YoutubeMp3Downloader({
    ffmpegPath: ffmpeg.path,
    outputPath: __dirname + "/files/",
    youtubeVideoQuality: "highest",
    queueParallelism: 3,
    progressTimeout: 100
});

function generate_key() {
  var sha = crypto.createHash("sha256");
  sha.update(Math.random().toString());
  return sha.digest("hex");
}

router.get("/download/:ssid/:name", function(req, res) {
  try {   
  var file = `${__dirname}/files/${req.params.ssid}/${req.params.name}`;
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
} catch (error) {
    console.log(error);
}
});

io.on("connection", socket => {
  let client_session = generate_key();
  socket.emit("session", client_session);

  YD.on("progress", function(progress) {
    socket.emit("download-progress", {
      id: progress.videoId,
      progress: progress
    });
  });
  YD.on("finished", function(err, data) {
    let fileDir = `${__dirname}/files/${client_session}/${data.videoTitle.replace(",","")}.mp3`;
    if (fs.existsSync(fileDir)) {
      data.videoTitle.replace(",","");
      socket.emit("download-finished", { id: data.videoId, data: data });
    }
  });

  socket.on("search", query => {
    search(query, opts, function(err, results) {
      if (err) return console.log(err);
      socket.emit("search", { results: results });
    });
  });

  socket.on("download", data => {
    if (!fs.existsSync(`${__dirname}/files/${data.ssid}`)){
      fs.mkdirSync(`${__dirname}/files/${data.ssid}`);
    }
    YD.download(data.song.id, `${data.ssid}/${data.song.title.replace(",","")}.mp3`);
  });


  socket.on("disconnect", () => {
    let dir = `${__dirname}/files/${client_session}`;
    if (fs.existsSync(dir)) {
      fs.removeSync(dir);
    }
  });
});
