const request = require('supertest');
const { app, server } = require('../src/index');

describe('QA Agent: Health & Uptime Test', () => {
  afterAll((done) => {
    // Close the server if it somehow started listening, though our NODE_ENV condition prevents this
    if (server.close) {
      server.close();
    }
    done();
  });

  it('should return 200 OK from DevOps Health route', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('db_connected');
  });

  it('should return 404 for unknown route', async () => {
    const res = await request(app).get('/api/devops/this-does-not-exist');
    expect(res.statusCode).toEqual(404);
  });
});
