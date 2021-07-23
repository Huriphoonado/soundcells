const path = require('path');

module.exports = {
    mode: "production", // production
    entry: './src/js/index.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'static')
    }
};
