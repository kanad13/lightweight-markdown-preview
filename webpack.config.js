//@ts-check

"use strict";

const path = require("path");

//@ts-check
/** @type {import("webpack").Configuration} */
const config = {
	target: "node",
	mode: "production",
	entry: "./src/extension.js",
	output: {
		path: path.resolve(__dirname, "dist"),
		filename: "extension.js",
		libraryTarget: "commonjs2",
		devtoolModuleFilenameTemplate: "../../[resource-path]",
	},
	externals: {
		vscode: "commonjs vscode"
	},
	resolve: {
		extensions: [".js"],
		fallback: {
			"fs": false,
			"path": false,
			"util": false,
		}
	},
	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: /node_modules/,
				use: {
					loader: "babel-loader",
					options: {
						presets: ["@babel/preset-env"]
					}
				}
			}
		]
	},
	devtool: "nosources-source-map",
	infrastructureLogging: {
		level: "log",
	},
};

module.exports = config;
