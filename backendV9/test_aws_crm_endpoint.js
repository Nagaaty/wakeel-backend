const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'wakeel_jwt_secret_k8x9m2p4v7n1q3w6t0y5r8u2i4o7a1s3';
const lawyerId = 'b4289c98-b928-44a2-8fa0-2f2e80a7ec18'; // demo lawyer

// Generate token
const token = jwt.sign({ id: lawyerId, role: 'lawyer' }, JWT_SECRET);
console.log('Generated JWT Token:', token);

async function testEndpoint() {
  try {
    console.log('Sending request to AWS production server...');
    const response = await axios.get('http://16.171.32.21:5001/api/lawyers/me/clients', {
      headers: {
        Authorization: `Bearer ${token}`
      },
      timeout: 5000
    });
    console.log('AWS Server responded with 200 OK!');
    console.log('Clients count:', response.data.clients?.length);
    console.log('Clients:', response.data.clients);
  } catch (err) {
    if (err.response) {
      console.log('AWS Server returned error status:', err.response.status);
      console.log('Error data:', err.response.data);
    } else {
      console.log('Request failed:', err.message);
    }
  }
}

testEndpoint();
