import React from 'react';
import Helmet from 'react-helmet';

export default () => (
  <div>
    <Helmet>
      <title itemProp="name" lang="en">Test Page</title>
      <meta name="description" content="Helmet application" />
    </Helmet>
    <h1>Hello</h1>
  </div>
);
