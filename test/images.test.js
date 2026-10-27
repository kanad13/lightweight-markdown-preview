/**
 * Tests that every image the readme shows is sharp enough, small enough, and not cut off.
 *
 * Why it exists: a screenshot with a fixed crop can slice through a heading or a diagram, and
 * nothing else notices. A cut-off picture leaves ink (text or lines) on the outer edge, while a
 * picture cropped between blocks leaves the edge plain, so the check looks for ink on the edge ring.
 * The PNG decoder is small on purpose: it reads the 8-bit RGB and RGBA files that Chrome and `sips` write,
 * so the test needs no dependency.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");

/**
 * Decodes an 8-bit, non-interlaced RGB or RGBA PNG.
 *
 * @param {Buffer} file - PNG file bytes
 * @returns {{ width: number, height: number, pixel: (x: number, y: number) => number[] }} Image size and a reader that returns [r, g, b]
 */
function decodePng(file) {
	assert.equal(file.subarray(1, 4).toString(), "PNG", "not a PNG");
	let width, height, channels;
	const chunks = [];
	for (let at = 8; at < file.length; ) {
		const length = file.readUInt32BE(at);
		const type = file.subarray(at + 4, at + 8).toString();
		const data = file.subarray(at + 8, at + 8 + length);
		if (type === "IHDR") {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);
			assert.equal(data[8], 8, "only 8-bit PNGs");
			assert.ok(data[9] === 2 || data[9] === 6, "only RGB or RGBA PNGs");
			assert.equal(data[12], 0, "no interlacing");
			channels = data[9] === 2 ? 3 : 4;
		} else if (type === "IDAT") {
			chunks.push(data);
		}
		at += 12 + length;
	}
	const raw = zlib.inflateSync(Buffer.concat(chunks));
	const stride = width * channels;
	const pixels = Buffer.alloc(stride * height);
	for (let y = 0; y < height; y++) {
		const filter = raw[y * (stride + 1)];
		const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
		for (let i = 0; i < stride; i++) {
			const left = i >= channels ? pixels[y * stride + i - channels] : 0;
			const up = y ? pixels[(y - 1) * stride + i] : 0;
			const upLeft = y && i >= channels ? pixels[(y - 1) * stride + i - channels] : 0;
			let value = line[i];
			if (filter === 1) value += left;
			else if (filter === 2) value += up;
			else if (filter === 3) value += Math.floor((left + up) / 2);
			else if (filter === 4) {
				const p = left + up - upLeft;
				const [pa, pb, pc] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)];
				value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
			}
			pixels[y * stride + i] = value & 255;
		}
	}
	return { width, height, pixel: (x, y) => [pixels[y * stride + x * channels], pixels[y * stride + x * channels + 1], pixels[y * stride + x * channels + 2]] };
}

/** Fraction of pixels in the outer `band` pixels that differ clearly from the background colour of the picture */
function edgeInk(image, band = 3) {
	const ring = [];
	for (let y = 0; y < image.height; y++) {
		for (let x = 0; x < image.width; x++) {
			if (x < band || y < band || x >= image.width - band || y >= image.height - band) ring.push(image.pixel(x, y));
		}
	}
	const counts = new Map();
	for (const color of ring) counts.set(color.join(), (counts.get(color.join()) || 0) + 1);
	const background = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split(",").map(Number);
	// Text and diagram lines are far from the background; borders and tints of panels are not
	const ink = ring.filter((color) => color.reduce((sum, value, i) => sum + Math.abs(value - background[i]), 0) > 150).length;
	return ink / ring.length;
}

const readme = fs.readFileSync(path.join(root, "readme.md"), "utf8");
const images = [...new Set([...readme.matchAll(/assets\/(readme-[\w-]+\.png)/g)].map((match) => match[1]))];

describe("readme images", () => {
	it("are found", () => {
		assert.ok(images.length >= 10, images.join());
	});

	for (const name of images) {
		describe(name, () => {
			const file = fs.readFileSync(path.join(root, "assets", name));
			const image = decodePng(file);

			it("is large enough to read and small enough to load", () => {
				assert.ok(image.width >= 600, `${image.width}px wide`);
				assert.ok(image.height >= 120 && image.height <= 3000, `${image.height}px tall`);
				assert.ok(file.length <= 400 * 1024, `${Math.round(file.length / 1024)} KB`);
			});

			it("has nothing cut off at its edges", () => {
				const share = edgeInk(image);
				assert.ok(share < 0.005, `${(share * 100).toFixed(2)}% of the edge ring is ink, so text or a diagram is cut off`);
			});
		});
	}

	it("the check can fail: a picture sliced through its content is caught", () => {
		const bands = { width: 40, height: 40, pixel: (x, y) => (y > 20 && x % 4 === 0 ? [0, 0, 0] : [255, 255, 255]) };
		assert.ok(edgeInk(bands) > 0.005);
	});
});
