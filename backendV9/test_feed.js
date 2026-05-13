const https = require('https');
https.get('https://wakeel-api.onrender.com/api/forum/feed', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Keys:', Object.keys(parsed));
      if (parsed.questions) {
        console.log('Posts count:', parsed.questions.length);
      } else {
        console.log('Data:', data.substring(0, 200));
      }
    } catch (e) {
      console.log('Error parsing JSON:', data.substring(0, 100));
    }
  });
}).on('error', (err) => console.log('Error: ' + err.message));
