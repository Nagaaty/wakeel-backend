require('dotenv').config();

const key = process.env.BREVO_API_KEY;
const senderEmail = process.env.BREVO_SENDER_EMAIL || 'wakeel.justice@gmail.com';

async function testEmail() {
  console.log("Testing Brevo API with key starting with:", key.substring(0, 15));
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': key,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'Wakeel Legal', email: senderEmail },
      to: [{ email: 'test@example.com' }],
      subject: 'Test API Key',
      htmlContent: '<p>Test</p>'
    })
  });
  
  const data = await res.json();
  console.log("Response:", res.status, data);
}

testEmail();
