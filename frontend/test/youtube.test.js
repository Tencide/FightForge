import { describe, it, expect } from 'vitest';
import { getYouTubeId, getYouTubeEmbedUrl } from '../src/utils/youtube.js';

describe('frontend youtube utils', () => {
  describe('getYouTubeId', () => {
    it('parses common URL formats', () => {
      expect(getYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(getYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(getYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(getYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(getYouTubeId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('returns null for invalid input', () => {
      expect(getYouTubeId('')).toBeNull();
      expect(getYouTubeId(null)).toBeNull();
      expect(getYouTubeId('https://example.com')).toBeNull();
    });
  });

  describe('getYouTubeEmbedUrl', () => {
    it('builds nocookie embed URL', () => {
      expect(getYouTubeEmbedUrl('dQw4w9WgXcQ')).toBe(
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
      );
    });

    it('returns null when id cannot be parsed', () => {
      expect(getYouTubeEmbedUrl('bad')).toBeNull();
    });
  });
});
