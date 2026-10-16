const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
test('Drive reels resolve to embeddable players; direct media stays native', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync('js/config.js', 'utf8'), context);
  const drive = context.resolveReelVideo({ drive_file_id: '123456789012345678901' });
  assert.equal(drive.kind, 'drive');
  assert.equal(drive.url, 'https://drive.google.com/file/d/123456789012345678901/preview');
  assert.equal(context.resolveReelVideo({ video: 'https://example.com/video.mp4' }).url, 'https://example.com/video.mp4');
});
