/**
 * tests/helpers/authHelper.js
 *
 * Returns authenticated Supertest agents so route test files do not need
 * to repeat login boilerplate.  Each helper returns a fresh agent with a
 * valid session cookie.
 *
 * Usage:
 *   const { getCustomerAgent, getArtisanAgent, getAdminAgent } = require('../helpers/authHelper');
 *   const agent = await getCustomerAgent(app);
 *   const res   = await agent.get('/orders');
 */

'use strict';

const request = require('supertest');

/**
 * Return a supertest agent logged in with `email` / `password`.
 * Throws if login does not result in a 302 redirect (login failure).
 *
 * @param {import('express').Application} app
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('supertest').SuperAgentTest>}
 */
async function loginAgent(app, email, password) {
  const agent = request.agent(app);
  const res = await agent
    .post('/auth/login')
    .send({ email, password });

  if (res.statusCode !== 302) {
    throw new Error(
      `Login failed for ${email}: expected 302, got ${res.statusCode}. ` +
      `Location: ${res.headers.location}`
    );
  }

  return agent;
}

/**
 * Return an agent authenticated as the seeded customer.
 */
async function getCustomerAgent(app) {
  return loginAgent(app, 'customer@test.com', 'cust123');
}

/**
 * Return an agent authenticated as customer2 (the second seeded customer).
 */
async function getCustomer2Agent(app) {
  return loginAgent(app, 'customer2@test.com', 'cust123');
}

/**
 * Return an agent authenticated as the seeded artisan.
 */
async function getArtisanAgent(app) {
  return loginAgent(app, 'artisan@test.com', 'art123');
}

/**
 * Return an agent authenticated as the seeded admin.
 */
async function getAdminAgent(app) {
  return loginAgent(app, 'admin@test.com', 'admin123');
}

/**
 * Return an unauthenticated (guest) agent.
 * Useful for asserting that protected routes redirect to login.
 */
function getGuestAgent(app) {
  return request.agent(app);
}

/**
 * Generic helper – log in with any credentials.
 */
async function loginWith(app, email, password) {
  return loginAgent(app, email, password);
}

module.exports = {
  loginAgent,
  getCustomerAgent,
  getCustomer2Agent,
  getArtisanAgent,
  getAdminAgent,
  getGuestAgent,
  loginWith,
};
