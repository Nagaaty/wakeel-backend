const request = require('supertest');
const { app, server } = require('../src/index');
const pool = require('../src/config/db');

describe('QA Agent: Health & Uptime Test', () => {
  afterAll(async () => {
    // Close the server if it somehow started listening, though our NODE_ENV condition prevents this
    if (server.close) {
      server.close();
    }
    // Close the Database connection pool so Jest can exit cleanly unconditionally
    await pool.end();
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
