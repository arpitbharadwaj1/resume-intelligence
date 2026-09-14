import { describe, expect, it } from "vitest";

import { scoreJobMatch } from "@/lib/scoring/job-match";
import type { ParsedJD } from "@/types/jd";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const JD: ParsedJD = {
  jobTitle: "Senior Frontend Developer",
  seniority: "senior",
  minExperienceYears: 5,
  preferredExperienceYears: 7,
  requiredSkills: ["React", "TypeScript", "JavaScript", "CSS", "REST APIs", "Git"],
  preferredSkills: ["Next.js", "Testing", "GraphQL"],
  responsibilities: [
    "build reusable React components",
    "implement responsive layouts",
    "collaborate with design team",
    "write unit tests",
    "review pull requests",
  ],
  keywords: ["component", "state management", "accessibility", "bundler", "code review", "CI/CD"],
  otherRequirements: [],
  industry: "Software",
  workModel: "hybrid",
};

const STRONG_RESUME = `
John Smith — Senior Frontend Developer

EXPERIENCE
Senior Frontend Developer at Acme Corp (2019–2024)
- Built reusable React components used across 5 product teams
- Implemented responsive layouts with CSS and HTML
- Integrated REST APIs using TypeScript and JavaScript
- Wrote unit tests with Jest achieving 80% code coverage
- Reviewed pull requests daily and managed code review process
- State management with Redux across the component library
- Accessibility improvements following WCAG guidelines
- Bundler configuration with Webpack reducing bundle size 30%
- CI/CD pipeline maintenance via Git branching strategy

SKILLS
React, TypeScript, JavaScript, CSS, REST APIs, Git, Next.js, GraphQL
`;

const WEAK_RESUME = `
Jane Doe — Junior Developer (2023–2024)
- Attended daily standups
- Supported the team with basic tasks

SKILLS
Microsoft Word, Excel
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scoreJobMatch", () => {
  it("returns total 0–100", () => {
    const r = scoreJobMatch(STRONG_RESUME, 6, JD);
    expect(r.total).toBeGreaterThanOrEqual(0);
    expect(r.total).toBeLessThanOrEqual(100);
  });

  it("strong resume scores above 70", () => {
    const r = scoreJobMatch(STRONG_RESUME, 6, JD);
    expect(r.total).toBeGreaterThan(70);
  });

  it("weak resume scores below 35", () => {
    const r = scoreJobMatch(WEAK_RESUME, 1, JD);
    expect(r.total).toBeLessThan(35);
  });

  it("returns six categories with correct keys", () => {
    const r = scoreJobMatch(STRONG_RESUME, 6, JD);
    const keys = r.categories.map((c) => c.category).sort();
    expect(keys).toEqual(["experience", "keywords", "otherRequirements", "requiredSkills", "responsibilities", "seniority"]);
  });

  it("category weights sum to 100", () => {
    const r = scoreJobMatch(STRONG_RESUME, 6, JD);
    const total = r.categories.reduce((s, c) => s + c.weight, 0);
    expect(total).toBe(100);
  });

  it("weightedScore ≈ score × weight (within 0.1 of rounding)", () => {
    const r = scoreJobMatch(STRONG_RESUME, 6, JD);
    for (const cat of r.categories) {
      expect(Math.abs(cat.weightedScore - cat.score * cat.weight)).toBeLessThan(0.1);
    }
  });

  it("synonym normalization: AWS matches Amazon Web Services in JD", () => {
    const jdWithAWS: ParsedJD = { ...JD, requiredSkills: ["Amazon Web Services"] };
    const resumeWithAWS = STRONG_RESUME + "\nAWS certified cloud practitioner";
    const r = scoreJobMatch(resumeWithAWS, 6, jdWithAWS);
    const req = r.categories.find((c) => c.category === "requiredSkills")!;
    expect(req.matched).toContain("Amazon Web Services");
  });

  it("synonym normalization: React.js matches React in resume", () => {
    const jdWithReactJs: ParsedJD = { ...JD, requiredSkills: ["React.js"] };
    const r = scoreJobMatch(STRONG_RESUME, 6, jdWithReactJs);
    const req = r.categories.find((c) => c.category === "requiredSkills")!;
    expect(req.matched).toContain("React.js");
  });

  it("experience at minimum scores >= 0.7 × weight", () => {
    const r = scoreJobMatch(STRONG_RESUME, 5, JD);
    const exp = r.categories.find((c) => c.category === "experience")!;
    expect(exp.weightedScore).toBeGreaterThanOrEqual(exp.weight * 0.7);
  });

  it("experience well below minimum scores low", () => {
    const r = scoreJobMatch(STRONG_RESUME, 1, JD);
    const exp = r.categories.find((c) => c.category === "experience")!;
    expect(exp.score).toBeLessThan(0.4);
  });

  it("seniority within range scores 1.0", () => {
    const r = scoreJobMatch(STRONG_RESUME, 7, JD);
    const sen = r.categories.find((c) => c.category === "seniority")!;
    expect(sen.score).toBe(1);
  });

  it("gaps include missing required skills when resume lacks them", () => {
    const r = scoreJobMatch(WEAK_RESUME, 1, JD);
    const skillGap = r.gaps.find((g) => g.category === "requiredSkills");
    expect(skillGap).toBeDefined();
    expect(skillGap!.items.length).toBeGreaterThan(0);
  });

  it("strong resume has no required-skills gap", () => {
    const r = scoreJobMatch(STRONG_RESUME, 6, JD);
    const skillGap = r.gaps.find((g) => g.category === "requiredSkills");
    expect(skillGap).toBeUndefined();
  });

  it("matched skills appear in category.matched array", () => {
    const r = scoreJobMatch(STRONG_RESUME, 6, JD);
    const req = r.categories.find((c) => c.category === "requiredSkills")!;
    expect(req.matched).toContain("React");
    expect(req.matched).toContain("TypeScript");
  });

  it("parsedJD and candidateYears passed through to result", () => {
    const r = scoreJobMatch(STRONG_RESUME, 6, JD);
    expect(r.parsedJD).toBe(JD);
    expect(r.candidateYears).toBe(6);
  });

  it("empty JD requirements score all dimensions fully", () => {
    const empty: ParsedJD = {
      jobTitle: "Developer",
      seniority: "unknown",
      minExperienceYears: 0,
      requiredSkills: [],
      preferredSkills: [],
      responsibilities: [],
      keywords: [],
      otherRequirements: [],
    };
    const r = scoreJobMatch(STRONG_RESUME, 5, empty);
    expect(r.categories.filter((c) => c.category !== "seniority").every((c) => c.score >= 1)).toBe(true);
  });
});
