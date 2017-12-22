var search = require('youtube-search');
var ffmpeg = require('@ffmpeg-installer/ffmpeg');
var YoutubeMp3Downloader = require("youtube-mp3-downloader");
var path = require('path');
var http = require('http');

var streamUrl;

var opts = {
 maxResults: 10,
 key: 'AIzaSyCnqAFM5z0dsC_gPE-DQeFrQe2PScejMMw'
};
var YD = new YoutubeMp3Downloader({
  "ffmpegPath": ffmpeg.path,     // Where is the FFmpeg binary located?
  "outputPath": "",    // Where should the downloaded and encoded files be stored?
  "youtubeVideoQuality": "highest",       // What video quality should be used?
  "queueParallelism": 2,                  // How many parallel downloads/encodes should be started?
  "progressTimeout": 2000                 // How long should be the interval of the progress reports
});
var express    = require('express');        // call express
var app        = express();                 // define our app using express
var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'dist')));
var port = process.env.PORT || 5500;
app.set('port', port);
var router = express.Router();
var percent;
var cors = require('cors')
var isPlaying = false;
app.use(cors());

router.get('/search/:query', function(req, res) {
  search(req.params.query, opts, function(err, results) {
    if(err) return console.log(err);
    res.json(results);
   });
});


router.get('/download/:id', function(req, res) {
  YD.download(req.params.id);

  YD.on("error", function(error) {
    console.log("Error:", error);
  });
  YD.on("progress", function(err, data) {
    console.log(data);
  });
  YD.on("finished", function(err, data) {
    res.json({ok: true, data: data})
  });
});
//app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'dist/index.html'));});
app.use('/api', router);
app.listen(port);
//var server = http.createServer(app);
//server.listen(port, () => console.log(`API running on http://localhost:${port}`));
