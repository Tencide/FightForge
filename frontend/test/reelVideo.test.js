import { describe, it, expect } from 'vitest';
import {
  extForMime,
  formatBytes,
  needsReelTranscode,
  REEL_RECORDER_BITS,
} from '../src/utils/reelVideo.js';

describe('frontend reelVideo utils', () => {
  describe('extForMime', () => {
    it('returns .mp4 for mp4 mime types', () => {
      expect(extForMime('video/mp4')).toBe('.mp4');
      expect(extForMime('video/mp4;codecs=avc1')).toBe('.mp4');
    });

    it('defaults to .webm otherwise', () => {
      expect(extForMime('video/webm')).toBe('.webm');
      expect(extForMime('')).toBe('.webm');
    });
  });

  describe('formatBytes', () => {
    it('formats B, KB, and MB', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(2048)).toBe('2.0 KB');
      expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    });
  });

  describe('needsReelTranscode', () => {
    it('skips small files', () => {
      expect(needsReelTranscode({ size: 1024, type: 'video/webm' })).toBe(false);
      expect(needsReelTranscode(null)).toBe(false);
    });

    it('requires transcode for large non-mp4', () => {
      expect(
        needsReelTranscode({ size: 25 * 1024 * 1024, type: 'video/webm' })
      ).toBe(true);
    });

    it('skips large mp4 under skip threshold', () => {
      expect(
        needsReelTranscode({ size: 25 * 1024 * 1024, type: 'video/mp4' })
      ).toBe(false);
    });

    it('transcodes very large mp4', () => {
      expect(
        needsReelTranscode({ size: 35 * 1024 * 1024, type: 'video/mp4' })
      ).toBe(true);
    });
  });

  describe('REEL_RECORDER_BITS', () => {
    it('uses sub-1Mbps video for mobile uploads', () => {
      expect(REEL_RECORDER_BITS.videoBitsPerSecond).toBeLessThanOrEqual(1_000_000);
      expect(REEL_RECORDER_BITS.audioBitsPerSecond).toBeGreaterThan(0);
    });
  });
});
