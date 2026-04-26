// Vision Affichage Volume II §06 — visitor tracking hook.
//
// Mounts at the App root so every page load:
//   1. Bumps the session counter (+ stamps firstVisit on the first ever
//      visit) so downstream surfaces can branch on session number.
//   2. Captures UTM hints from the landing URL — `?utm_source` and
//      `?industry` — into the persisted profile. Meta Ads creatives
//      use `?industry=construction` etc. to tell us what bucket the
//      visitor self-selected before a single PDP view, so the homepage
//      hero copy can lean into that vertical immediately.
//
// Returns the post-mount profile so the consumer can react to it
// without doing its own getProfile() call. The state is reactive to
// re-mounts but not to background updates — surfaces that need to
// re-read after, say, a PDP visit should call getProfile() inline.

import { useEffect, useState } from 'react';
import { bumpSession, getProfile, updateProfile, type VisitorProfile } from '@/lib/visitorProfile';

export function useVisitorTracking(): VisitorProfile {
  // Lazy-initialise from the persisted profile so the first render
  // already has the previous-session tail (lastViewedProduct etc.)
  // available — surfaces like the second-visit banner check this on
  // first paint, not after an effect tick.
  const [profile, setProfile] = useState<VisitorProfile>(() => getProfile());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // 1) Bump session count (+ firstVisit if missing).
    let next = bumpSession();

    // 2) Parse UTM-style hints from the landing URL. We support both
    //    `?utm_source=...` (the GA convention) and `?industry=...`
    //    (the shorter alias we use in Meta Ads creatives — copy
    //    writers don't want to type the prefix every time).
    try {
      const params = new URLSearchParams(window.location.search);
      const utmSource = params.get('utm_source');
      const industry = params.get('industry') ?? params.get('utm_industry');
      const patch: Partial<VisitorProfile> = {};
      if (utmSource) patch.utmSource = utmSource;
      if (industry) patch.utmIndustry = industry;
      if (Object.keys(patch).length > 0) {
        next = updateProfile(patch);
      }
    } catch {
      /* URLSearchParams threw on a malformed query — non-fatal */
    }

    setProfile(next);
  }, []);

  return profile;
}
