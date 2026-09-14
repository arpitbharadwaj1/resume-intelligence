import { describe, expect, it } from "vitest";

import { scoreRoleReadiness } from "@/lib/scoring/role-readiness";
import type { RoleContext, RoleExpectations } from "@/types/role";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CONTEXT: RoleContext = {
  jobTitle: "Senior Frontend Developer",
  experienceYears: 5,
};

const EXPECTATIONS: RoleExpectations = {
  requiredSkills: ["React", "TypeScript", "JavaScript", "CSS", "HTML", "REST APIs", "Git"],
  preferredSkills: ["Next.js", "Testing", "GraphQL"],
  typicalResponsibilities: [
    "build reusable React components",
    "implement responsive layouts",
    "collaborate with design team",
    "write unit tests",
    "review pull requests",
    "optimise web performance",
  ],
  seniorityRange: { min: 4, max: 8 },
  keyTerminology: ["component", "state management", "accessibility", "bundler", "CI/CD", "code review"],
};

const STRONG_RESUME = `
John Smith — Senior Frontend Developer

EXPERIENCE
Senior Frontend Developer at Acme Corp (2020–2024)
- Built reusable React components used across 5 product teams
- Implemented responsive layouts with CSS and HTML improving mobile NPS by 15%
- Integrated REST APIs to fetch and display dynamic data using TypeScript and JavaScript
- Wrote unit tests with Jest achieving 80% code coverage
- Reviewed pull requests daily and mentored junior developers
- Optimised web performance reducing bundle size by 30% using bundler configuration
- Managed releases via CI/CD pipelines and Git branching strategy

SKILLS
React, TypeScript, JavaScript, HTML, CSS, REST APIs, Git, Next.js, GraphQL

EDUCATION
BSc Computer Science
`;

const WEAK_RESUME = `
Jane Doe — Junior Web Developer

EXPERIENCE
Web Developer (2023–2024)
- Attended daily standups
- Supported the development team

SKILLS
Microsoft Word, Excel
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scoreRoleReadiness", () => {
  it("returns total 0–100", () => {
    const r = scoreRoleReadiness(STRONG_RESUME, CONTEXT, EXPECTATIONS);
    expect(r.total).toBeGreaterThanOrEqual(0);
    expect(r.total).toBeLessThanOrEqual(100);
  });

  it("strong resume scores above 70", () => {
    const r = scoreRoleReadiness(STRONG_RESUME, CONTEXT, EXPECTATIONS);
    expect(r.total).toBeGreaterThan(70);
  });

  it("weak resume scores below 40", () => {
    const r = scoreRoleReadiness(WEAK_RESUME, CONTEXT, EXPECTATIONS);
    expect(r.total).toBeLessThan(40);
  });

  it("returns four categories with correct keys", () => {
    const r = scoreRoleReadiness(STRONG_RESUME, CONTEXT, EXPECTATIONS);
    const keys = r.categories.map((c) => c.category).sort();
    expect(keys).toEqual(["experience", "responsibilities", "skills", "terminology"]);
  });

  it("category weights sum to 100", () => {
    const r = scoreRoleReadiness(STRONG_RESUME, CONTEXT, EXPECTATIONS);
    const total = r.categories.reduce((s, c) => s + c.weight, 0);
    expect(total).toBe(100);
  });

  it("weightedScore = score × weight (rounded to 1dp)", () => {
    const r = scoreRoleReadiness(STRONG_RESUME, CONTEXT, EXPECTATIONS);
    for (const cat of r.categories) {
      expect(cat.weightedScore).toBeCloseTo(cat.score * cat.weight, 1);
    }
  });

  it("experience at minimum threshold scores >= 0.7 of weight", () => {
    const atMin: RoleContext = { jobTitle: "Developer", experienceYears: 4 };
    const r = scoreRoleReadiness(STRONG_RESUME, atMin, EXPECTATIONS);
    const exp = r.categories.find((c) => c.category === "experience")!;
    expect(exp.weightedScore).toBeGreaterThanOrEqual(exp.weight * 0.7);
  });

  it("experience well below minimum scores low", () => {
    const junior: RoleContext = { jobTitle: "Developer", experienceYears: 1 };
    const r = scoreRoleReadiness(STRONG_RESUME, junior, EXPECTATIONS);
    const exp = r.categories.find((c) => c.category === "experience")!;
    expect(exp.score).toBeLessThan(0.5);
  });

  it("experience above max scores full weight", () => {
    const senior: RoleContext = { jobTitle: "Developer", experienceYears: 10 };
    const r = scoreRoleReadiness(STRONG_RESUME, senior, EXPECTATIONS);
    const exp = r.categories.find((c) => c.category === "experience")!;
    expect(exp.score).toBe(1);
  });

  it("gaps list missing required skills when resume lacks them", () => {
    const r = scoreRoleReadiness(WEAK_RESUME, CONTEXT, EXPECTATIONS);
    const skillGap = r.gaps.find((g) => g.area === "skills");
    expect(skillGap).toBeDefined();
    expect(skillGap!.missing.length).toBeGreaterThan(0);
  });

  it("strong resume has no skill gaps (all required skills present)", () => {
    const r = scoreRoleReadiness(STRONG_RESUME, CONTEXT, EXPECTATIONS);
    const skillGap = r.gaps.find((g) => g.area === "skills");
    expect(skillGap).toBeUndefined();
  });

  it("strengths populated for strong resume", () => {
    const r = scoreRoleReadiness(STRONG_RESUME, CONTEXT, EXPECTATIONS);
    expect(r.strengths.length).toBeGreaterThan(0);
  });

  it("roleContext and expectations passed through to result", () => {
    const r = scoreRoleReadiness(STRONG_RESUME, CONTEXT, EXPECTATIONS);
    expect(r.roleContext).toEqual(CONTEXT);
    expect(r.expectations).toEqual(EXPECTATIONS);
  });

  it("empty expectations score all dimensions fully (no penalty)", () => {
    const empty: RoleExpectations = {
      requiredSkills: [],
      preferredSkills: [],
      typicalResponsibilities: [],
      seniorityRange: { min: 0, max: 10 },
      keyTerminology: [],
    };
    const r = scoreRoleReadiness(STRONG_RESUME, CONTEXT, empty);
    // With no expected items, everything matches — deterministic fallback.
    expect(r.categories.every((c) => c.score === 1)).toBe(true);
  });
});
