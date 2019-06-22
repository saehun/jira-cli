const path = require("path");
const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
const {
  NODE_ENV = "production",
} = process.env;
module.exports = {
  entry: "./src/index.ts",
  mode: NODE_ENV,
  target: "node",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.js"
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          "ts-loader",
        ]
      }
    ]
  },
  externals: [ nodeExternals() ],
  plugins: [
    new webpack.BannerPlugin({ banner: "#!/usr/bin/env node", raw: true }),
  ]
}
