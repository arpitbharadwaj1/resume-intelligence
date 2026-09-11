import { describe, expect, it } from "vitest";

import { segmentEntries } from "@/lib/analysis/segment";

describe("segmentEntries", () => {
  it("splits a section into one entry per role, keeping the header block whole", () => {
    const entries = segmentEntries([
      "Senior Frontend Developer",
      "Lumen Harbor Software, Melbourne, VIC",
      "Jan 2022 - Mar 2024",
      "- Rebuilt the dashboard in React.",
      "- Led a team of 5 engineers.",
      "Frontend Developer",
      "Tessellate Labs, Melbourne, VIC",
      "03/2020 – 12/2021",
      "- Delivered a reporting view.",
    ]);

    expect(entries).toHaveLength(2);
    expect(entries[0]!.headerLines).toEqual([
      "Senior Frontend Developer",
      "Lumen Harbor Software, Melbourne, VIC",
      "Jan 2022 - Mar 2024",
    ]);
    expect(entries[0]!.bullets).toHaveLength(2);
    expect(entries[0]!.dateRange!.start.year).toBe(2022);
    expect(entries[1]!.dateRange!.start.year).toBe(2020);
  });

  it("absorbs a wrapped bullet rather than starting a spurious new entry", () => {
    // The second physical line is the tail of the first bullet, not a new role.
    const entries = segmentEntries([
      "Frontend Developer",
      "Acme",
      "Jan 2022 - Mar 2024",
      "- Rebuilt the shipment tracking dashboard in React and TypeScript, cutting",
      "median time to interactive from 4.1 seconds to 1.6 seconds.",
      "- Introduced a shared component library.",
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]!.bullets).toHaveLength(2);
    expect(entries[0]!.bullets[0]).toContain("1.6 seconds");
  });

  it("leaves an entry undated when its header carries no date range", () => {
    const entries = segmentEntries([
      "Frontend Developer",
      "Quillfeather Digital, Remote",
      "- Shipped a marketing site refresh.",
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.dateRange).toBeNull();
  });
});
