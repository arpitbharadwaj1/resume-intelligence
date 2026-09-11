import { describe, expect, it } from "vitest";

import { normalizeText, toLines } from "@/lib/parser/normalize";
import {
  classifyHeading,
  detectSections,
  detectedCoreSections,
  findSection,
  looksLikeHeading,
} from "@/lib/parser/sections";

const sectionsOf = (raw: string) => detectSections(toLines(normalizeText(raw).text));

describe("looksLikeHeading", () => {
  it("accepts the conventional heading forms", () => {
    expect(looksLikeHeading("EXPERIENCE")).toBe(true);
    expect(looksLikeHeading("Professional Experience")).toBe(true);
    expect(looksLikeHeading("Skills:")).toBe(true);
  });

  it("rejects bullets, even when they contain a section word", () => {
    // Checking shape before vocabulary is what stops a bullet mentioning
    // "experience" from being read as a section break.
    expect(looksLikeHeading("• Five years of experience in React")).toBe(false);
    expect(looksLikeHeading("- Led the skills matrix rollout")).toBe(false);
  });

  it("rejects sentences", () => {
    expect(looksLikeHeading("Built a design system used by four teams.")).toBe(false);
  });

  it("rejects contact lines", () => {
    expect(looksLikeHeading("rhea@examplemail.test")).toBe(false);
    expect(looksLikeHeading("+61 400 111 222")).toBe(false);
  });

  it("rejects anything longer than a few words", () => {
    expect(looksLikeHeading("Senior Frontend Developer With Ten Years Of Experience")).toBe(false);
  });
});

describe("classifyHeading", () => {
  it("matches the many ways one section gets labelled", () => {
    // Spec section 89 requires flexible inference: a parser that only knows
    // "Experience" reports a missing section on a resume that plainly has one.
    for (const heading of [
      "EXPERIENCE",
      "Professional Experience",
      "Work History",
      "Employment History",
      "Career History",
    ]) {
      expect(classifyHeading(heading), heading).toBe("experience");
    }
  });

  it("maps summary synonyms", () => {
    for (const heading of ["SUMMARY", "Profile", "Objective", "About Me", "Executive Summary"]) {
      expect(classifyHeading(heading), heading).toBe("summary");
    }
  });

  it("returns null for a heading it does not recognise", () => {
    expect(classifyHeading("Referees")).toBeNull();
  });
});

describe("regression: a labelled content line is not a section heading", () => {
  // Bug: "Languages: JavaScript, TypeScript" inside a Skills section was read as
  // a new "languages" section. That consumed the rest of the Skills content and
  // left Skills empty, so detectedCoreSections reported Skills as MISSING on a
  // resume that had a perfectly good one -- costing real points in Structure and
  // Parseability, with a reason the candidate could not act on.
  const resume = [
    "Rhea Castellanos",
    "rhea@examplemail.test",
    "",
    "SKILLS",
    "Languages: JavaScript, TypeScript, HTML5, CSS3",
    "Frameworks: React, Next.js",
    "Tooling: Vite, Playwright",
  ].join("\n");

  it("keeps labelled skill groups inside the Skills section", () => {
    const skills = findSection(sectionsOf(resume), "skills");
    expect(skills).toBeDefined();
    expect(skills?.lines).toHaveLength(3);
  });

  it("does not create a phantom section from the group label", () => {
    expect(sectionsOf(resume).map((s) => s.kind)).not.toContain("languages");
  });

  it("still treats a bare trailing colon as a heading", () => {
    // The distinction is content *after* the colon, not the colon itself.
    expect(looksLikeHeading("Skills:")).toBe(true);
    expect(looksLikeHeading("Languages: JavaScript, TypeScript")).toBe(false);
  });

  it("reports Skills as present", () => {
    expect(detectedCoreSections(sectionsOf(resume))).toContain("skills");
  });
});

describe("detectSections", () => {
  const resume = [
    "Priya Venkatesan",
    "priya@examplemail.test",
    "",
    "SUMMARY",
    "Backend engineer with eight years of experience.",
    "",
    "EXPERIENCE",
    "• Built a payments service handling 2M requests a day.",
    "",
    "EDUCATION",
    "BSc Computer Science",
  ].join("\n");

  it("treats the unlabelled block at the top as the contact section", () => {
    // It carries the name and email whether or not the document labels it.
    const contact = findSection(sectionsOf(resume), "contact");
    expect(contact?.lines).toContain("priya@examplemail.test");
  });

  it("assigns content to the heading above it", () => {
    const experience = findSection(sectionsOf(resume), "experience");
    expect(experience?.lines.join(" ")).toContain("payments service");
  });

  it("does not count a heading with no content as a detected section", () => {
    const empty = ["EXPERIENCE", "", "SKILLS"].join("\n");
    expect(detectedCoreSections(sectionsOf(empty))).not.toContain("experience");
  });

  it("handles a document with no headings at all", () => {
    const sections = sectionsOf("Just some text\nwith no structure at all");
    expect(sections).toHaveLength(1);
    expect(sections[0]?.kind).toBe("contact");
  });

  it("handles empty input", () => {
    expect(sectionsOf("")).toHaveLength(0);
  });
});
