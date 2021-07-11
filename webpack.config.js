const path = require('path');

module.exports = {
    mode: "development", // production
    entry: './src/js/index.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'static')
    }
};
