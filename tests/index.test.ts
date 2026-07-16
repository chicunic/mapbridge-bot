import { describe, expect, it } from "bun:test";
import { buildAppleMapsUrl, buildGoogleMapsUrl, extractMapUrl, parseAppleMaps, parseGoogleMaps } from "../src/index.ts";

describe("extractMapUrl", () => {
  it("detects Google short links", () => {
    const result = extractMapUrl("check this https://maps.app.goo.gl/TtwZ739zi6KHx7JT8?g_st=ic out");
    expect(result).toEqual({ source: "google", url: "https://maps.app.goo.gl/TtwZ739zi6KHx7JT8?g_st=ic" });
  });

  it("detects legacy goo.gl/maps links", () => {
    const result = extractMapUrl("https://goo.gl/maps/abc123");
    expect(result).toEqual({ source: "google", url: "https://goo.gl/maps/abc123" });
  });

  it("detects full Google Maps URLs on any TLD", () => {
    const result = extractMapUrl("https://www.google.co.jp/maps/place/Tokyo/@35.68,139.76,15z");
    expect(result?.source).toBe("google");
  });

  it("detects Apple Maps links", () => {
    const result = extractMapUrl("https://maps.apple.com/?ll=35.68,139.76&q=Tokyo");
    expect(result).toEqual({ source: "apple", url: "https://maps.apple.com/?ll=35.68,139.76&q=Tokyo" });
  });

  it("detects Apple short links", () => {
    const result = extractMapUrl("https://maps.apple/p/AbCdEf");
    expect(result).toEqual({ source: "apple", url: "https://maps.apple/p/AbCdEf" });
  });

  it("returns null for text without map links", () => {
    expect(extractMapUrl("hello world https://example.com")).toBeNull();
  });
});

describe("parseGoogleMaps", () => {
  it("extracts !3d!4d coordinates and place name", () => {
    const loc = parseGoogleMaps(
      "https://www.google.com/maps/place/Tokyo+Tower/@35.65,139.74,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d35.6585805!4d139.7454329",
    );
    expect(loc).toEqual({ lat: 35.6585805, lng: 139.7454329, name: "Tokyo Tower" });
  });

  it("falls back to @lat,lng viewport coordinates", () => {
    const loc = parseGoogleMaps("https://www.google.com/maps/place/Tokyo+Tower/@35.65,139.74,17z");
    expect(loc).toEqual({ lat: 35.65, lng: 139.74, name: "Tokyo Tower" });
  });

  it("parses q as coordinates", () => {
    const loc = parseGoogleMaps("https://www.google.com/maps?q=-33.8688,151.2093");
    expect(loc).toEqual({ lat: -33.8688, lng: 151.2093, name: undefined });
  });

  it("splits text q into name and address (app share links)", () => {
    const loc = parseGoogleMaps(
      "https://www.google.com/maps?q=Konakasawa+Parking+B,+940-5+Miyagase,+Kiyokawa,+Aiko+District,+Kanagawa+243-0111&ftid=0x60190544b1520263:0xd136c36fbdcd5df1",
    );
    expect(loc).toEqual({
      name: "Konakasawa Parking B",
      address: "940-5 Miyagase, Kiyokawa, Aiko District, Kanagawa 243-0111",
    });
  });

  it("keeps a comma-free text q as name only", () => {
    const loc = parseGoogleMaps("https://www.google.com/maps?q=Tokyo+Tower");
    expect(loc).toEqual({ name: "Tokyo Tower" });
  });

  it("returns null when nothing is extractable", () => {
    expect(parseGoogleMaps("https://www.google.com/maps")).toBeNull();
  });
});

describe("parseAppleMaps", () => {
  it("extracts ll coordinates with name", () => {
    const loc = parseAppleMaps("https://maps.apple.com/?ll=35.6586,139.7454&q=Tokyo+Tower");
    expect(loc).toEqual({ lat: 35.6586, lng: 139.7454, name: "Tokyo Tower", address: undefined });
  });

  it("extracts coordinate parameter", () => {
    const loc = parseAppleMaps("https://maps.apple.com/place?coordinate=35.6586,139.7454&name=Tokyo+Tower");
    expect(loc).toEqual({ lat: 35.6586, lng: 139.7454, name: "Tokyo Tower", address: undefined });
  });

  it("falls back to name and address without coordinates", () => {
    const loc = parseAppleMaps("https://maps.apple.com/?q=Tokyo+Tower&address=4-2-8+Shibakoen");
    expect(loc).toEqual({ name: "Tokyo Tower", address: "4-2-8 Shibakoen" });
  });

  it("returns null without any location data", () => {
    expect(parseAppleMaps("https://maps.apple.com/")).toBeNull();
  });
});

describe("buildAppleMapsUrl", () => {
  it("builds ll + q + address link", () => {
    const url = buildAppleMapsUrl({
      lat: 35.5255679,
      lng: 139.2228554,
      name: "Konakasawa Parking B",
      address: "940-5 Miyagase",
    });
    expect(url).toBe(
      "https://maps.apple.com/?ll=35.5255679%2C139.2228554&q=Konakasawa+Parking+B&address=940-5+Miyagase",
    );
  });

  it("strips emoji prefixes from place names", () => {
    const url = buildAppleMapsUrl({ lat: 35.52, lng: 139.23, name: "🅿miyanohiradai 2 Parking Lot" });
    expect(url).toBe("https://maps.apple.com/?ll=35.52%2C139.23&q=miyanohiradai+2+Parking+Lot");
  });
});

describe("buildGoogleMapsUrl", () => {
  it("combines name and address into the query", () => {
    const url = buildGoogleMapsUrl({ name: "Tokyo Tower", address: "4-2-8 Shibakoen" });
    expect(url).toBe("https://www.google.com/maps/search/?api=1&query=Tokyo+Tower%2C+4-2-8+Shibakoen");
  });

  it("avoids duplicating the name when the address already starts with it", () => {
    const url = buildGoogleMapsUrl({ name: "Ginza", address: "Ginza, Chuo City, Tokyo" });
    expect(url).toBe("https://www.google.com/maps/search/?api=1&query=Ginza%2C+Chuo+City%2C+Tokyo");
  });

  it("falls back to coordinates without name or address", () => {
    const url = buildGoogleMapsUrl({ lat: 35.6586, lng: 139.7454 });
    expect(url).toBe("https://www.google.com/maps/search/?api=1&query=35.6586%2C139.7454");
  });
});
