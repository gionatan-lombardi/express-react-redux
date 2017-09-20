const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const serveStatic = require('serve-static');
const app = require('./app-emulation.js');
const { createElement: h } = require('react');
const { renderToString } = require('react-dom/server');
const { StaticRouter } = require('react-router-dom');
const { createStore } = require('redux');
const { Provider } = require('react-redux');
const requireFromString = require('require-from-string');
const serialize = require('serialize-javascript');
const { Helmet } = require('react-helmet');
const Template = require('./template');


const defaultOptions = {
  isProductionMode: () => process.env.NODE_ENV === 'production',
  isRoutingUrl: (url, req) => (/\.html?$/.test(url) || !/\.\w+$/.test(url)) && req.header('accept') !== 'text/event-stream',
  dirSourceClient: './src/client',
  dirBuildClient: './build/client',
  fileIndexJs: 'index.js',
  fileAppJs: 'App.js',
  fileReducerJs: 'reducer.js',
  dirSourceServer: './src/server',
  dirBuildServer: './build/server',
  optsServeClient: { redirect: false },
  webpackDevConfig: require('./webpack-dev-config.js'),
  webpackDevOptions: { noInfo: true, publicPath: '/' },
  webpackDevBuildCallback: () => console.log('webpack dev build done.'),
  beforeSSR: (store, req, cb) => cb(),
};


function middleware(options = {}) {
  options = _.merge(defaultOptions, options);

  // STEP-01 check production mode
  const productionMode = options.isProductionMode();
  let compiler; // webpack compiler only used in non-production mode
  const getCompiler = filename => (
    compiler.compilers &&
    compiler.compilers.find(x => x.options.output.filename.endsWith(filename))
  ) || compiler;

  // STEP-02 serve assets and index.html
  if (productionMode) {
    app.use(serveStatic(options.dirBuildClient, options.optsServeClient));
  } else {
    compiler = require('webpack')(options.webpackDevConfig);
    compiler.plugin('done', options.webpackDevBuildCallback);
    app.use(require('webpack-dev-middleware')(compiler, options.webpackDevOptions));

    app.get('/', (req, res) => {
      const c = getCompiler(options.fileIndexJs);
      const html = c.outputFileSystem.readFileSync(path.join(c.outputPath, options.fileIndexHtml), 'utf8');
      res.set('content-type', 'text/html');
      res.send(html);
    });
    app.use(require('webpack-hot-middleware')(compiler, options.webpackHotOptions));
  }

  // STEP-03 serve prerendered html
  const clientModuleMap = new Map();
  const getClientModule = (file) => {
    let module;
    if (productionMode) {
      module = clientModuleMap.get(file);
      if (!module) {
        // eslint-disable-next-line import/no-dynamic-require
        module = require(path.resolve(options.dirBuildClient, file));
        clientModuleMap.set(file, module);
      }
    } else {
      module = clientModuleMap.get(file);
      if (!module) {
        const c = getCompiler(file);
        const filename = path.join(c.outputPath, file);
        const content = c.outputFileSystem.readFileSync(filename, 'utf8');
        module = requireFromString(content, filename);
        clientModuleMap.set(file, module);
        c.watch({}, () => clientModuleMap.delete(file));
      }
    }
    if (module.default) module = module.default;
    return module;
  };

  const getBundleJs = () => {
    let bundleJs;
    if (productionMode) {
      if (!bundleJs) {
        bundleJs = fs.readdirSync('./build/client').find(file => /-index.js?$/.test(file));
      }
      return bundleJs;
    }
    // non-production mode
    if (!bundleJs) {
      const c = getCompiler(options.fileIndexJs);
      // for (v in c) {
      //   console.log(v);
      // }
      // console.log(c.records);
      bundleJs = c.outputFileSystem.readdirSync(c.outputPath).find(file => /-index.js?$/.test(file));
    }
    return bundleJs;
  };

  app.use((req, res, next) => {
    if (!options.isRoutingUrl(req.url, req)) return next();
    const reducer = getClientModule(options.fileReducerJs);
    const App = getClientModule(options.fileAppJs);
    if (!reducer || !App) return next();
    const store = createStore(reducer);
    const render = (err) => {
      if (err) return next(err);
      const context = {};
      const markup = renderToString(
        h(Provider, { store },
          h(StaticRouter, { location: req.url, context },
            h(App))));
      if (context.url) {
        res.redirect(302, context.url);
      } else {
        const bundle = getBundleJs();
        const helmet = Helmet.renderStatic();
        res.set('content-type', 'text/html');
        const template = Template({
          markup,
          helmet,
          bundle,
          preloadedState: serialize(store.getState()),
        });
        console.log(template);
        res.send(template);
      }
      return null;
    };
    const promise = options.beforeSSR(store, req, render);
    if (promise && promise.then) promise.then(() => render(), err => render(err));
    return null; // just to make eslint happy
  });

  return (req, res, next) => {
    app.handle(0, req, res, next);
  };
}

module.exports = middleware;
