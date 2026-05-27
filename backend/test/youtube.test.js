const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getYouTubeId, classifyVideoUrl } = require('../lib/youtube');

describe('youtube.js', () => {
  describe('getYouTubeId', () => {
    it('parses bare 11-char id', () => {
      assert.equal(getYouTubeId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    });

    it('parses youtu.be links', () => {
      assert.equal(getYouTubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    });

    it('parses watch URLs with extra query params', () => {
      assert.equal(
        getYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s'),
        'dQw4w9WgXcQ'
      );
    });

    it('parses embed URLs', () => {
      assert.equal(
        getYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ'),
        'dQw4w9WgXcQ'
      );
    });

    it('parses shorts URLs', () => {
      assert.equal(
        getYouTubeId('https://youtube.com/shorts/dQw4w9WgXcQ'),
        'dQw4w9WgXcQ'
      );
    });

    it('parses youtube-nocookie embed host', () => {
      assert.equal(
        getYouTubeId('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'),
        'dQw4w9WgXcQ'
      );
    });

    it('adds https when host-only URL provided', () => {
      assert.equal(getYouTubeId('youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    });

    it('returns null for invalid id length', () => {
      assert.equal(getYouTubeId('tooshort'), null);
      assert.equal(getYouTubeId('waytoolongvideoid'), null);
    });

    it('returns null for empty and non-string-ish input', () => {
      assert.equal(getYouTubeId(''), null);
      assert.equal(getYouTubeId('   '), null);
      assert.equal(getYouTubeId(null), null);
      assert.equal(getYouTubeId(undefined), null);
    });

    it('returns null for unrelated URLs', () => {
      assert.equal(getYouTubeId('https://example.com/video'), null);
      assert.equal(getYouTubeId('not-a-url'), null);
    });
  });

  describe('classifyVideoUrl', () => {
    it('classifies YouTube URLs', () => {
      const c = classifyVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      assert.equal(c.kind, 'youtube');
      assert.equal(c.youtubeId, 'dQw4w9WgXcQ');
    });

    it('classifies direct mp4/webm/mov', () => {
      assert.equal(classifyVideoUrl('https://cdn.example.com/clip.mp4').kind, 'direct');
      assert.equal(classifyVideoUrl('https://cdn.example.com/clip.webm').kind, 'direct');
      assert.equal(classifyVideoUrl('https://cdn.example.com/clip.mov').kind, 'direct');
    });

    it('classifies generic https links', () => {
      const c = classifyVideoUrl('https://vimeo.com/12345');
      assert.equal(c.kind, 'link');
      assert.equal(c.youtubeId, null);
    });

    it('returns null for empty input', () => {
      assert.equal(classifyVideoUrl(''), null);
      assert.equal(classifyVideoUrl('   '), null);
    });
  });
});
