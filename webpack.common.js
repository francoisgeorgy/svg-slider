const path = require('path');

module.exports = {
    entry: './src/svg-slider.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'svg-slider.min.js',
        library: 'svgSlider',
        libraryTarget: 'umd'
    }
};
