//@ts-check

"use strict";

const path = require("path");

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
	},
	module: {
		rules: [
			{
				test: /\.html$/,
				type: "asset/source",
			},
		],
	},
	devtool: "nosources-source-map",
	infrastructureLogging: {
		level: "log",
	},
};

module.exports = config;
