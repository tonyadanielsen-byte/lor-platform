'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('LOR cannot deploy security rules of shared OpEx Realtime Database', () => {
  const cfg = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
  assert.equal(cfg.database, undefined, 'firebase.json must never contain database.rules');
});
