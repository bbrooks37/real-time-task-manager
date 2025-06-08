    // client/webpack.config.js
    const path = require('path');
    const HtmlWebpackPlugin = require('html-webpack-plugin');
    const MiniCssExtractPlugin = require('mini-css-extract-plugin');
    const DotenvWebpackPlugin = require('dotenv-webpack');
    const { CleanWebpackPlugin } = require('clean-webpack-plugin');
    const CopyWebpackPlugin = require('copy-webpack-plugin'); // NEW: Import CopyWebpackPlugin

    module.exports = (env, argv) => {
        // Determine the mode (development or production)
        const isProduction = argv.mode === 'production';

        return {
            // Set the mode (development, production, or none)
            mode: isProduction ? 'production' : 'development',

            // Entry point of your application
            entry: './src/index.js',

            // Output configuration for the bundled files
            output: {
                // The output directory for the bundled files
                path: path.resolve(__dirname, 'dist'),
                // Naming convention for the main bundled JavaScript file
                // [contenthash] ensures unique file names for caching
                filename: isProduction ? 'js/[name].[contenthash].js' : 'js/bundle.js',
                // Public path helps resolve assets correctly when served from the root
                publicPath: '/', // Relative to the server's root where index.html is served
                clean: true, // Cleans the output directory before each build
            },

            // Source maps for easier debugging in development
            devtool: isProduction ? false : 'source-map',

            // Rules for handling different file types
            module: {
                rules: [
                    // Rule for JavaScript files (using Babel for transpilation)
                    {
                        test: /\.js$/, // Applies to .js files
                        exclude: /node_modules/, // Exclude node_modules for faster builds
                        use: {
                            loader: 'babel-loader', // Use babel-loader
                            options: {
                                presets: ['@babel/preset-env'], // Preset for compiling modern JS down to ES5
                            },
                        },
                    },
                    // Rule for CSS files
                    {
                        test: /\.css$/, // Applies to .css files
                        use: [
                            isProduction ? MiniCssExtractPlugin.loader : 'style-loader', // Extracts CSS into separate files in production, injects into HTML in development
                            'css-loader', // Interprets @import and url() like import/require() and resolves them
                        ],
                    },
                    // Rule for images and other assets (optional, but good for completeness)
                    {
                        test: /\.(png|svg|jpg|jpeg|gif|webp)$/i,
                        type: 'asset/resource', // Webpack 5 asset module type
                        generator: {
                            filename: 'images/[name].[contenthash][ext]', // Output path for images
                        },
                    },
                ],
            },

            // Plugins for additional functionalities
            plugins: [
                // Cleans the 'dist' folder before each build
                new CleanWebpackPlugin(),
                // Generates an HTML file and injects the bundled scripts/styles
                new HtmlWebpackPlugin({
                    template: './public/index.html', // Path to your source index.html
                    filename: 'index.html', // Output filename in the 'dist' directory
                    // Base tag for HTML, important if using history API or specific server configs
                    base: '/', 
                }),
                // Extracts CSS into separate files for production builds
                new MiniCssExtractPlugin({
                    filename: isProduction ? 'css/[name].[contenthash].css' : 'css/bundle.css',
                }),
                // Loads environment variables from .env files
                new DotenvWebpackPlugin({
                    path: `./.env.${isProduction ? 'production' : 'development'}`, // Path to your .env file
                    safe: true, 
                    systemvars: true, 
                    silent: true, 
                    defaults: false 
                }),
                // NEW: Copy _redirects file to the output directory
                new CopyWebpackPlugin({
                    patterns: [
                        { from: './public/_redirects', to: '.' }, // Copies _redirects from public to the root of dist
                    ],
                }),
            ],
        };
    };
    