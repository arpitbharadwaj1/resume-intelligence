/**
 * Evidence-linked experience bullets.
 *
 * Experience, Impact and skill-evidence all measure the same unit — one
 * experience bullet — so they must all count over the *same* bullets, each
 * carrying the same stable evidence ID. Segmentation already groups bullets by
 * role (lib/analysis/segment.ts); this flattens that into an addressable list.
 *
 * The ID scheme is the one types/scoring.ts documents: `exp_02_bullet_03` is the
 * third bullet of the second role. It is stable across runs because it is derived
 * only from position, and it is what lets a feature value point back at the exact
 * line that produced it (R1 — every value is evidence-linked).
 */
import type { ExperienceEntry } from "./segment";

export interface RoleBullet {
  /** Stable evidence ID, e.g. `exp_02_bullet_03`. */
  readonly evidenceId: string;
  /** Bullet text, marker stripped and wrapped lines rejoined. */
  readonly text: string;
  /** Zero-based index of the role this bullet belongs to. */
  readonly roleIndex: number;
  /** Zero-based index of the bullet within its role. */
  readonly bulletIndex: number;
}

function pad(index: number): string {
  return String(index + 1).padStart(2, "0");
}

/** Flatten segmented roles into a flat, evidence-addressed bullet list. */
export function collectRoleBullets(entries: readonly ExperienceEntry[]): readonly RoleBullet[] {
  const bullets: RoleBullet[] = [];
  entries.forEach((entry, roleIndex) => {
    entry.bullets.forEach((text, bulletIndex) => {
      bullets.push({
        evidenceId: `exp_${pad(roleIndex)}_bullet_${pad(bulletIndex)}`,
        text,
        roleIndex,
        bulletIndex,
      });
    });
  });
  return bullets;
}

/** Bullets belonging to the most recent role — the first entry, by convention. */
export function bulletsInMostRecentRole(bullets: readonly RoleBullet[]): readonly RoleBullet[] {
  return bullets.filter((bullet) => bullet.roleIndex === 0);
}
