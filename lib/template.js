module.exports = ({ markup, helmet, bundle, preloadedState }) => `<!doctype html>
<html ${helmet.htmlAttributes.toString()}>
  <head>
    ${helmet.title.toString()}
    ${helmet.meta.toString()}
    ${helmet.link.toString()}
  </head>
  <body ${helmet.bodyAttributes.toString()}>
  <div id="app">${markup}</div>
  <script>window.__PRELOADED_STATE__=${preloadedState}</script>
  <script type="text/javascript" src="/${bundle}"></script>
  </body>
</html>`;
