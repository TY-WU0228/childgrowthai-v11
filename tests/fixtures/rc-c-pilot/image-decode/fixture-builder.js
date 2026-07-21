'use strict';

const sharp = require('sharp');
const zlib = require('zlib');

const VALID_JPEG_BASE64 = '/9j/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAJgABAAAAAAAAAAAAAAAAAAAAABABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAAPwA//9k=';
const VALID_WEBP_BASE64 = 'UklGRh4AAABXRUJQVlA4TBEAAAAvAUAAAAdQiirUo/+BiOh/AAA=';
const ANIMATED_WEBP_BASE64 = 'UklGRogAAABXRUJQVlA4WAoAAAACAAAAAQAAAQAAQU5JTQYAAAAAAAAAAABBTk1GKgAAAAAAAAAAAAEAAAEAAGQAAABWUDhMEQAAAC8BQAAAB1CKKtSj/4GI6H8AAEFOTUYqAAAAAAAAAAAAAQAAAQAAZAAAAFZQOEwRAAAALwFAAAAHUIoq1KP/gYjofwAA';

const CRC_TABLE = Array.from({ length: 256 }, (_unused, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBytes.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return result;
}

function png(width, height, compressed) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function jpegSegment(marker, payload) {
  const result = Buffer.alloc(payload.length + 4);
  result[0] = 0xff;
  result[1] = marker;
  result.writeUInt16BE(payload.length + 2, 2);
  payload.copy(result, 4);
  return result;
}

function oversubscribedJpeg() {
  const dqt = Buffer.concat([Buffer.from([0]), Buffer.alloc(64, 1)]);
  const dcCounts = Buffer.from([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const acCounts = Buffer.from([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const dht = Buffer.concat([
    Buffer.from([0]), dcCounts, Buffer.from([0, 1, 2]),
    Buffer.from([0x10]), acCounts, Buffer.from([0]),
  ]);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]), jpegSegment(0xdb, dqt),
    jpegSegment(0xc0, Buffer.from([8, 0, 1, 0, 1, 1, 1, 0x11, 0])),
    jpegSegment(0xc4, dht), jpegSegment(0xda, Buffer.from([1, 1, 0, 0, 63, 0])),
    Buffer.from([0x3f, 0xff, 0xd9]),
  ]);
}

function webpChunk(type, payload) {
  const padding = payload.length & 1 ? Buffer.from([0]) : Buffer.alloc(0);
  const header = Buffer.alloc(8);
  header.write(type, 0, 4, 'ascii');
  header.writeUInt32LE(payload.length, 4);
  return Buffer.concat([header, payload, padding]);
}

function webp(chunks) {
  const body = Buffer.concat([Buffer.from('WEBP', 'ascii'), ...chunks]);
  const header = Buffer.alloc(8);
  header.write('RIFF', 0, 4, 'ascii');
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

function jpegEntropyBounds(bytes) {
  const sos = bytes.indexOf(Buffer.from([0xff, 0xda]));
  const headerLength = bytes.readUInt16BE(sos + 2);
  return { start: sos + 2 + headerLength, end: bytes.length - 2 };
}

async function buildFixtures() {
  const validJpeg = Buffer.from(VALID_JPEG_BASE64, 'base64');
  const validPng = png(2, 2, zlib.deflateSync(Buffer.from([0, 10, 20, 30, 255, 10, 20, 30, 255, 0, 10, 20, 30, 255, 10, 20, 30, 255])));
  const validWebp = Buffer.from(VALID_WEBP_BASE64, 'base64');

  const raw = Buffer.alloc(64 * 64 * 3);
  for (let index = 0; index < raw.length; index += 1) raw[index] = (index * 73 + index * index * 19) & 0xff;
  const entropySource = await sharp(raw, { raw: { width: 64, height: 64, channels: 3 } }).jpeg({ quality: 80 }).toBuffer();
  const entropy = jpegEntropyBounds(entropySource);
  const truncatedJpeg = Buffer.concat([
    entropySource.subarray(0, entropy.start + Math.floor((entropy.end - entropy.start) / 4)),
    Buffer.from([0xff, 0xd9]),
  ]);
  const invalidEntropyJpeg = Buffer.from(entropySource);
  for (let index = entropy.start; index < entropy.end; index += 1) {
    invalidEntropyJpeg[index] = (index - entropy.start) % 2 === 0 ? 0xff : 0x00;
  }

  const invalidVp8Payload = Buffer.from([0x30, 0, 0, 0x9d, 0x01, 0x2a, 2, 0, 2, 0, 0]);
  const truncatedVp8Payload = Buffer.from([0xb0, 0, 0, 0x9d, 0x01, 0x2a, 2, 0, 2, 0, 0, 0]);
  const invalidVp8lPayload = Buffer.from([0x2f, 0x01, 0x40, 0, 0, 0]);

  return Object.freeze({
    'valid-baseline.jpeg': validJpeg,
    'valid.png': validPng,
    'valid-single-frame.webp': validWebp,
    'invalid-oversubscribed-huffman.jpeg': oversubscribedJpeg(),
    'invalid-truncated-entropy.jpeg': truncatedJpeg,
    'invalid-entropy-byte-stuffing.jpeg': invalidEntropyJpeg,
    'invalid-marker-only.jpeg': Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    'invalid-vp8.webp': webp([webpChunk('VP8 ', invalidVp8Payload)]),
    'invalid-truncated-vp8.webp': webp([webpChunk('VP8 ', truncatedVp8Payload)]),
    'invalid-vp8l.webp': webp([webpChunk('VP8L', invalidVp8lPayload)]),
    'invalid-vp8x-no-frame.webp': webp([webpChunk('VP8X', Buffer.alloc(10))]),
    'invalid-animated.webp': Buffer.from(ANIMATED_WEBP_BASE64, 'base64'),
    'invalid-compressed.png': png(2, 2, Buffer.from([0x78, 0x9c, 0, 0])),
    'excessive-width.png': png(6001, 1, zlib.deflateSync(Buffer.alloc(1 + 6001 * 4))),
    'excessive-pixels.png': png(5000, 5000, zlib.deflateSync(Buffer.alloc(5))),
  });
}

module.exports = Object.freeze({ buildFixtures });
