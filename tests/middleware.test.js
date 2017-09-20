/* eslint-env jest */
/* global jasmine */

const path = require('path');
const http = require('http');
const express = require('express');
const request = require('request');

const main = require('../lib/main.js');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 4 * 60 * 1000;

const webpackDevConfig = require('../lib/webpack-dev-config.js');

webpackDevConfig[0].entry[2] = path.join(__dirname, 'files/src/client/index.js');
webpackDevConfig[1].entry[2] = path.join(__dirname, 'files/src/client/App.jsx');
webpackDevConfig[2].entry[2] = path.join(__dirname, 'files/src/client/reducer.js');

describe('middleware unit test', () => {
  it('call it with minimal option', (done) => {
    main({
      webpackDevConfig,
      webpackDevBuildCallback: () => done(),
    });
  });
});

describe('middleware run test', () => {
  'use strict';

  let server;
  let port;
  beforeAll((done) => {
    const app = express();
    app.use(main({
      webpackDevConfig,
      webpackDevBuildCallback: () => done(),
    }));
    server = http.createServer(app);
    server.listen(() => {
      port = server.address().port;
    });
  });

  it('get /', (done) => {
    request.get(`http://localhost:${port}/`, (err, res, body) => {
      expect(err).toBeFalsy();
      expect(body).toContain('script');
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });
});

describe('middleware run test with / route SSR', () => {
  'use strict';

  let server;
  let port;
  beforeAll((done) => {
    const app = express();
    app.use(main({
      webpackDevConfig,
      webpackDevBuildCallback: () => done(),
    }));
    server = http.createServer(app);
    server.listen(() => {
      port = server.address().port;
    });
  });

  it('get /', (done) => {
    request.get(`http://localhost:${port}/`, (err, res, body) => {
      expect(body).toContain('<h1');
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });
});

describe('middleware run test with async functions to populate the Store before SSR', () => {
  'use strict';

  let server;
  let port;
  beforeAll((done) => {
    const app = express();
    app.use(main({
      webpackDevConfig,
      webpackDevBuildCallback: () => done(),
      beforeSSR: (store, req) => new Promise((resolve) => {
        setTimeout(() => {
          store.dispatch({
            type: 'ADD_TODO',
            todo: `Current path: ${req.url}, Async function resolved 👏`,
          });
          resolve();
        }, 1000);
      }),
    }));
    server = http.createServer(app);
    server.listen(() => {
      port = server.address().port;
    });
  });

  it('get /', (done) => {
    request.get(`http://localhost:${port}/about`, (err, res, body) => {
      expect(body).toContain('Current path: \\u002Fabout, Async function resolved 👏');
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });
});

describe('middleware run test with Helmet injecting custom document.title', () => {
  'use strict';

  let server;
  let port;
  beforeAll((done) => {
    const app = express();
    app.use(main({
      webpackDevConfig,
      webpackDevBuildCallback: () => done(),
    }));
    server = http.createServer(app);
    server.listen(() => {
      port = server.address().port;
    });
  });

  it('get /', (done) => {
    request.get(`http://localhost:${port}/`, (err, res, body) => {
      expect(body).toContain('Test Page</title>');
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });
});
