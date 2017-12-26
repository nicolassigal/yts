var search = require('youtube-search');
var ffmpeg = require('@ffmpeg-installer/ffmpeg');
var YoutubeMp3Downloader = require("youtube-mp3-downloader");
var path = require('path');
var http = require('http');
var mime = require('mime');
var fs = require('fs');
var streamUrl;
var YD = new YoutubeMp3Downloader({
  "ffmpegPath": ffmpeg.path,     // Where is the FFmpeg binary located?
  "outputPath": __dirname + '/files',    // Where should the downloaded and encoded files be stored?
  "youtubeVideoQuality": "highest",       // What video quality should be used?
  "queueParallelism": 20,                  // How many parallel downloads/encodes should be started?
  "progressTimeout": 1000                 // How long should be the interval of the progress reports
});
var opts = {
 maxResults: 50,
 key: 'AIzaSyCnqAFM5z0dsC_gPE-DQeFrQe2PScejMMw'
};

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
var cors = require('cors');
var files = [];
var isPlaying = false;
app.use(cors());

function deleteFile (file) { 
  fs.unlink(file, function (err) {
      if (err) {
          console.error(err.toString());
      } else {
          console.warn(file + ' deleted');
      }
  });
}



router.get('/search/:query', function(req, res) {
  search(req.params.query, opts, function(err, results) {
    if(err) return console.log(err);
    res.json(results);
   });
});

router.get('/delete/:name', function(req, res) {
  var file = __dirname + '/files/'+ req.params.name;

  var filename = path.basename(file);
  var mimetype = mime.lookup(file);

  res.setHeader('Content-disposition', 'attachment; filename=' + filename);
  res.setHeader('Content-type', mimetype);

  var filestream = fs.createReadStream(file);
  filestream.pipe(res);
});

router.get('/getlink/:id', function(req, res) {
  YD.download(req.params.id).on('success', function(data){
    console.log(data);
  });
});
//app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'dist/index.html'));});
app.use('/api', router);
app.listen(port);

//server.listen(port, () => console.log(`API running on http://localhost:${port}`));
