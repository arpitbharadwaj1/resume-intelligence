import { describe, expect, it } from "vitest";

import {
  collectDateFormats,
  endpointOrdinal,
  hasDateRange,
  parseDateRange,
} from "@/lib/analysis/dates";

describe("parseDateRange", () => {
  it("reads a month-name range and both endpoints", () => {
    const range = parseDateRange("Jan 2022 - Mar 2024");
    expect(range).not.toBeNull();
    expect(range!.start).toEqual({ year: 2022, month: 1, signature: "month-name-year" });
    expect(range!.end).toEqual({ year: 2024, month: 3, signature: "month-name-year" });
    expect(range!.signatures).toEqual(["month-name-year"]);
  });

  it("reads a numeric MM/YYYY range, including an en-dash separator", () => {
    const range = parseDateRange("03/2020 – 12/2021");
    expect(range!.start).toEqual({ year: 2020, month: 3, signature: "numeric-month-year" });
    expect(range!.end).toEqual({ year: 2021, month: 12, signature: "numeric-month-year" });
  });

  it("treats a 'Present' endpoint as open, with no format", () => {
    const range = parseDateRange("May 2022 - Present");
    expect(range!.start).toEqual({ year: 2022, month: 5, signature: "month-name-year" });
    expect(range!.end).toBeNull();
    expect(range!.signatures).toEqual(["month-name-year"]);
  });

  it("reads a bare year range as year-only, month unknown", () => {
    const range = parseDateRange("2019 - 2021");
    expect(range!.start).toEqual({ year: 2019, month: null, signature: "year-only" });
  });

  it("records two signatures when a single range mixes conventions", () => {
    const range = parseDateRange("Jan 2022 - 03/2024");
    expect(range!.signatures).toEqual(["month-name-year", "numeric-month-year"]);
  });

  it("is not fooled by a lone year — a graduation year is not an employment span", () => {
    expect(parseDateRange("Graduated 2018")).toBeNull();
    expect(parseDateRange("Bachelor of Science, 2016")).toBeNull();
  });

  it("returns null for a line with no date at all", () => {
    expect(parseDateRange("Senior Frontend Developer")).toBeNull();
    expect(hasDateRange("Lumen Harbor Software, Melbourne, VIC")).toBe(false);
  });
});

describe("collectDateFormats", () => {
  it("counts each distinct convention used across lines", () => {
    const formats = collectDateFormats([
      "Jan 2022 - Mar 2024",
      "03/2020 – 12/2021",
      "Feb 2015 - Nov 2018",
    ]);
    expect(formats).toEqual(new Set(["month-name-year", "numeric-month-year"]));
  });

  it("ignores four-digit numbers that are not part of a range", () => {
    const formats = collectDateFormats(["Reduced defects across 2000 records"]);
    expect(formats.size).toBe(0);
  });
});

describe("endpointOrdinal", () => {
  it("orders a year-only endpoint mid-year, so it does not sort before January", () => {
    const jan2020 = endpointOrdinal({ year: 2020, month: 1, signature: "month-name-year" });
    const year2020 = endpointOrdinal({ year: 2020, month: null, signature: "year-only" });
    const dec2019 = endpointOrdinal({ year: 2019, month: 12, signature: "month-name-year" });
    expect(year2020).toBeGreaterThan(jan2020);
    expect(year2020).toBeGreaterThan(dec2019);
  });
});
