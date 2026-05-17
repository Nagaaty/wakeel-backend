const fs = require('fs');
const https = require('https');
const models = [
  'ssd_mobilenetv1_model-weights_manifest.json', 'ssd_mobilenetv1_model-shard1', 'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json', 'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json', 'face_recognition_model-shard1', 'face_recognition_model-shard2'
];
const baseURL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';

if (!fs.existsSync('./models')) fs.mkdirSync('./models');

async function download(file) {
  return new Promise((resolve) => {
    https.get(baseURL + file, (res) => {
      if (res.statusCode !== 200) return resolve();
      const fileStream = fs.createWriteStream('./models/' + file);
      res.pipe(fileStream);
      fileStream.on('finish', () => resolve());
    });
  });
}
(async () => {
  console.log('Downloading face-api models...');
  for (const file of models) {
    await download(file);
    console.log('Downloaded', file);
  }
  console.log('Done.');
})();
