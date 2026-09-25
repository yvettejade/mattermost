const path = require('path');

module.exports = {
    entry: './src/index.tsx',
    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
    },
    module: {
        rules: [
            {test: /\.tsx?$/, exclude: [/node_modules/, /\.test\.tsx?$/], use: 'ts-loader'},
            {test: /\.css$/, use: ['style-loader', 'css-loader']},
        ],
    },
    externals: {
        react: 'React',
        'react-dom': 'ReactDOM',
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'main.js',
    },
};
