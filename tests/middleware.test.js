/* eslint-env jest */
/* global jasmine */

const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const request = require('request');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const main = require('../lib/main.js');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 4 * 60 * 1000;

const webpackDevConfig = require('../lib/webpack-dev-config.js');

webpackDevConfig[0].entry[2] = path.join(__dirname, 'files/src/client/index.js');
webpackDevConfig[1].entry[2] = path.join(__dirname, 'files/src/client/App.jsx');
webpackDevConfig[2].entry[2] = path.join(__dirname, 'files/src/client/reducer.js');
webpackDevConfig[0].plugins[1] = new HtmlWebpackPlugin({
  filename: 'index.html',
  template: path.join(__dirname, 'files/src/client/index.html'),
});

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
      indexSSR: true,
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

  it('get /before-ssr', (done) => {
    request.get(`http://localhost:${port}/before-ssr`, (err, res, body) => {
      expect(body).toContain('Current path: \\u002Fbefore-ssr, Async function resolved 👏');
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });
});

describe('middleware run test with custom renderHtml function', () => {
  'use strict';

  let server;
  let port;
  beforeAll((done) => {
    const app = express();
    app.use(main({
      webpackDevConfig,
      webpackDevBuildCallback: () => done(),
      renderHtml: ({ appHtml, state, indexJsCompiler }) => {
        let bundleJs;
        if (process.env.NODE_ENV === 'production') {
          bundleJs = fs.readdirSync('./build/client').find(file => /-index.js?$/.test(file));
        } else {
          bundleJs = indexJsCompiler.outputFileSystem.readdirSync(indexJsCompiler.outputPath).find(file => /-index.js?$/.test(file));
        }
        return `<!doctype html>
          <html>
            <head>
              <title>My App</title>
            </head>
            <body>
            <div id="app">${appHtml}</div>
            <script>window.__PRELOADED_STATE__=${state}</script>
            <script type="text/javascript" src="/${bundleJs}"></script>
            </body>
          </html>`;
      },
    }));
    server = http.createServer(app);
    server.listen(() => {
      port = server.address().port;
    });
  });

  it('get /custom-render-html', (done) => {
    request.get(`http://localhost:${port}/custom-render-html`, (err, res, body) => {
      expect(body).toContain('<title>My App</title>');
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });
});
