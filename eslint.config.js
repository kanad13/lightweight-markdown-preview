const js = require("@eslint/js");

module.exports = [
	{
		ignores: ["node_modules/**", "dist/**"]
	},
	{
		files: ["**/*.js"],
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: "module",
			globals: {
				console: "readonly",
				process: "readonly",
				Buffer: "readonly",
				__dirname: "readonly",
				__filename: "readonly",
				exports: "writable",
				module: "writable",
				require: "readonly"
			}
		},
		rules: {
			...js.configs.recommended.rules,
			"indent": ["error", "tab"],
			"linebreak-style": ["error", "unix"],
			"quotes": ["error", "double"],
			"semi": ["error", "always"],
			"no-unused-vars": ["warn"],
			"no-console": "off"
		}
	}
];
