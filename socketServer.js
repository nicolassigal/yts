"use strict";
const search = require("youtube-search");
const express = require("express");
const socketIO = require("socket.io");
const path = require("path");

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
const Spotify = require("node-spotify-api");

const spotify = new Spotify({
  id: "89bb271e01a541e6a3f060e67b594e62",
  secret: "589e58be2c69441fa152ee8f997f94a7"
});

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
  return sha.digest("hex").substring(0, 15);
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

function getList(playlist) {
  playlist = playlist.map(song => {
    return `${song.track.artists[0].name} - ${song.track.name} (audio only)`;
  });

  return playlist;
}

function searchQuery (song, artist) {
  return new Promise((resolve, reject) => {
      search(song, { maxResults: 50, key: "AIzaSyCnqAFM5z0dsC_gPE-DQeFrQe2PScejMMw" }, function(err, results) {
      if (err) return console.log(err);
      let found = false;
      let vid = results.filter(element => {
        if (!found && element.kind == "youtube#video" && element.title.includes(artist) && (!element.title.includes("instrumental") && !element.title.includes("cover"))) {
          found = true;
          return element;
        }
      });
      resolve(vid[0]);
    });
  });
}

io.on("connection", socket => {
  console.log("a client connected");
  let client_session = generate_key();
  socket.emit("session", client_session);
  socket.on("spotify-get-playlist", user => {
    spotify
      .request(`	https://api.spotify.com/v1/users/${user}/playlists`)
      .then(res => {
        socket.emit("spotify-get-playlist", res);
      })
      .catch(err => console.log(err));
  });

  socket.on("spotify-search", search => {
    spotify
      .search({ type: search.type, query: search.query })
      .then(function(response) {
        if (search.type == "track") {
          response = response.tracks.items;
        }
        if (search.type == "playlist") {
          response = response.playlists.items;
        }
        if (search.type == "artist") {
          response = response.artists.items;
        }
        if (search.type == "album") {
          response = response.albums.items;
        }
        socket.emit("spotify-search", { list: response, type: search.type });
      })
      .catch(function(err) {
        console.log(err);
      });
  });

  socket.on("spotify-request", req => {
    spotify.request(`${req.query}`).then(res => {
      let type = "";
      socket.emit("spotify-request", { list: res, type: req.type });
    });
  });

  socket.on("spotify-track-search", track => {
    socket.emit("spotify-search-list-length", 1);
    search(`${track.artists[0].name} - ${track.name} (audio only)`, { maxResults: 50, key: "AIzaSyCnqAFM5z0dsC_gPE-DQeFrQe2PScejMMw" }, function(err, results) {
        if (err) return console.log(err);
        let found = false;
        let vid = results.filter(element => {
          if (!found && element.kind == "youtube#video" && (!element.title.includes("instrumental") && !element.title.includes("cover"))) {
            found = true;
            return element;
          }
        });
        socket.emit("search-spotube", vid[0]);
      }
    );
  });

  socket.on("spotify-playlist-search", playlist => {
    spotify
      .request(`${playlist}`)
      .then(function(response) {
        socket.emit("spotify-search-list-length", response.items.length);

        let playlist = getList(response.items);
        playlist.forEach(song => {
          search(
            song,
            { maxResults: 50, key: "AIzaSyCnqAFM5z0dsC_gPE-DQeFrQe2PScejMMw" },
            function(err, results) {
              if (err) return console.log(err);
              let found = false;
              let vid = results.filter(element => {
                if (
                  !found &&
                  element.kind == "youtube#video" &&
                  (!element.title.includes("instrumental") &&
                    !element.title.includes("cover"))
                ) {
                  found = true;
                  return element;
                }
              });
              socket.emit("search-spotube", vid[0]);
            }
          );
        });
      })
      .catch(function(err) {
        console.log(err);
      });
  });

  YD.on("progress", function(progress) {
    socket.emit("download-progress", {
      id: progress.videoId,
      progress: progress
    });
  });
  YD.on("finished", function(err, data) {
    data.videoTitle = data.videoTitle.replace(/[^a-zA-Z ]/g, '');
    let fileDir = `${__dirname}/files/${client_session}/${data.videoTitle}.mp3`;
    if (fs.existsSync(fileDir)) {      
      socket.emit("download-finished", { id: data.videoId, data: data });
    }
  });

  socket.on("search", query => {
    const opts = {
      maxResults: 50,
      key: "AIzaSyCnqAFM5z0dsC_gPE-DQeFrQe2PScejMMw"
    };
    search(query, opts, function(err, results) {
      if (err) return console.log(err);
      socket.emit("search", { results: results });
    });
  });

  socket.on("download", data => {
    let dir = path.join(__dirname, "files", data.ssid);
    let ssid = data.ssid;
    let title = data.song.title.replace(/[^a-zA-Z ]/g, '');
    fs.ensureDirSync(dir);
    YD.download(data.song.id,`${data.ssid}/${title}.mp3`);
  });

  socket.on("spotify-download-all", list => {
    let promises = [];
    let plist = list.map(song => {
      return { url: `${song.artists[0].name} - ${song.name}  audio (only) lyrics letras letra`, artist: song.artists[0].name };
    });
    
    plist.forEach(track => {
      promises.push(searchQuery(track.url, track.artist));
    });
    
    Promise.all(promises).then(tracks => {
      socket.emit("spotify-download-all", tracks);
    })
  });

  socket.on("disconnect", () => {
    console.log("client disconnected");
    let dir = path.join(__dirname, "files", client_session);
    fs.removeSync(dir);
  });
});
