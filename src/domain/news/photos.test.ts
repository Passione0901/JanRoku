import { describe, expect, it } from "vitest";
import { CopyHistory, type CopyUsage } from "./repetition";
import { newsPhotos, newsPhoto, selectNewsPhotos } from "./photos";

describe("news editorial photos", () => {
  it("offers twelve distinct assets with matching captions and alt text", () => {
    expect(newsPhotos).toHaveLength(12);
    expect(new Set(newsPhotos.map(p => p.src)).size).toBe(12);
    for (const photo of newsPhotos) {
      expect(newsPhoto(photo.id)).toEqual(photo);
      expect(photo.caption).toBeTruthy();
      expect(photo.alt).toBeTruthy();
    }
  });
  it("avoids lead-image reuse across the preceding ten editions and preserves deterministic selections", () => {
    const past: CopyUsage[] = [];
    const leads: string[] = [];
    for (let i = 1; i <= 25; i++) {
      const date = `2026-06-${String(i).padStart(2, "0")}`;
      const prior = past.slice(-10);
      const history = new CopyHistory(prior, []);
      const images = selectNewsPhotos("daily-leader", "test", date, history);
      expect(leads.slice(-10)).not.toContain(images.lead);
      expect(images.secondary).not.toBe(images.lead);
      expect(selectNewsPhotos("daily-leader", "test", date, new CopyHistory(prior, []))).toEqual(images);
      leads.push(images.lead);
      past.push(history.usage(date));
    }
    expect(new Set(leads).size).toBe(12);
  });
  it("prefers a matching topic among unused images", () => {
    const photo = selectNewsPhotos("nemesis-win", "test", "2026-06-01", new CopyHistory([], []));
    expect(newsPhoto(photo.lead).themes).toContain("matchup");
  });
});
