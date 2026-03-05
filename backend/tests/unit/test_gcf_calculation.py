"""
Unit tests for GCF (Group Correction Factor) calculation logic.

Covers the two bugs fixed in grades.py:
1. GCF must be computed per team (using User.team_number), not across the
   entire class.  Before the fix team_gid_by_uid was always empty, so all
   students landed in a single virtual "None" team.
2. suggested_grade must be based on the peer score only (no SPR correction,
   no self-score blending) so that its ordering is always consistent with
   the GCF ordering.

Pure-function tests – no DB, no HTTP.
"""

import pytest
from statistics import mean


# ---------------------------------------------------------------------------
# Helpers – extracted / simplified versions of the production formulas
# ---------------------------------------------------------------------------


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def compute_gcf_per_team(
    peer_pct_by_uid: dict,
    teamid_by_uid: dict,
    min_cf: float = 0.85,
    max_cf: float = 1.5,
) -> dict:
    """Replicate the GCF computation from grades.py (after the bug-fix)."""
    by_team: dict = {}
    for uid, pct in peer_pct_by_uid.items():
        by_team.setdefault(teamid_by_uid.get(uid), []).append(pct)
    team_mean_map = {tid: mean(vals) for tid, vals in by_team.items() if vals}
    gcf_by_uid = {}
    for uid, pct in peer_pct_by_uid.items():
        t = teamid_by_uid.get(uid)
        m = team_mean_map.get(t)
        raw = (pct / m) if (m and m > 0) else 1.0
        gcf_by_uid[uid] = clamp(raw, min_cf, max_cf)
    return gcf_by_uid


def peer_pct_to_suggested(peer_pct: float) -> float | None:
    """Replicate the fixed suggested_grade formula from grades.py."""
    if peer_pct <= 0:
        return None
    val = (peer_pct / 100.0) * 9 + 1
    return clamp(round(val, 1), 1.0, 10.0)


# ---------------------------------------------------------------------------
# Tests for Bug 1: per-team GCF grouping
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestGcfPerTeamGrouping:
    """GCF should be relative to the student's own team average."""

    def test_single_team_gcfs_average_to_one(self):
        """Within one team the mean GCF must equal 1.0 (before clamping)."""
        pct = {1: 70.0, 2: 80.0, 3: 90.0}
        tid = {1: 1, 2: 1, 3: 1}
        gcf = compute_gcf_per_team(pct, tid, min_cf=0.0, max_cf=10.0)
        assert abs(mean(gcf.values()) - 1.0) < 1e-9

    def test_two_teams_gcfs_average_to_one_within_each_team(self):
        """Mean GCF per team must equal 1.0 independently (before clamping)."""
        pct = {1: 60.0, 2: 80.0, 3: 40.0, 4: 60.0}
        tid = {1: 1, 2: 1, 3: 2, 4: 2}
        gcf = compute_gcf_per_team(pct, tid, min_cf=0.0, max_cf=10.0)
        team1_mean = mean(gcf[uid] for uid in [1, 2])
        team2_mean = mean(gcf[uid] for uid in [3, 4])
        assert abs(team1_mean - 1.0) < 1e-9
        assert abs(team2_mean - 1.0) < 1e-9

    def test_cross_team_grouping_gives_wrong_all_above_one(self):
        """
        Demonstrate the old bug: when all students are grouped together
        (teamid = None), a high-performing team will have ALL GCFs > 1
        while a low-performing team will have ALL GCFs < 1.
        """
        # Team A averages 80%, Team B averages 40%.
        pct = {1: 75.0, 2: 80.0, 3: 85.0, 4: 35.0, 5: 40.0, 6: 45.0}
        # BUG: everyone in one virtual "None" team
        tid_wrong = {uid: None for uid in pct}
        gcf_wrong = compute_gcf_per_team(pct, tid_wrong, min_cf=0.0, max_cf=10.0)
        # All team-A members get GCF > 1
        assert all(gcf_wrong[uid] > 1.0 for uid in [1, 2, 3])
        # All team-B members get GCF < 1
        assert all(gcf_wrong[uid] < 1.0 for uid in [4, 5, 6])

    def test_correct_per_team_grouping_mixes_above_and_below_one(self):
        """
        After the fix, GCF is per-team so both above-1 and below-1 values
        appear for every team regardless of the team's absolute skill level.
        """
        pct = {1: 75.0, 2: 80.0, 3: 85.0, 4: 35.0, 5: 40.0, 6: 45.0}
        # FIXED: correct team assignment
        tid_fixed = {1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2}
        gcf_fixed = compute_gcf_per_team(pct, tid_fixed, min_cf=0.0, max_cf=10.0)
        team1_gcfs = [gcf_fixed[uid] for uid in [1, 2, 3]]
        team2_gcfs = [gcf_fixed[uid] for uid in [4, 5, 6]]
        # Within each team there must be values above and below 1
        assert any(g > 1.0 for g in team1_gcfs)
        assert any(g < 1.0 for g in team1_gcfs)
        assert any(g > 1.0 for g in team2_gcfs)
        assert any(g < 1.0 for g in team2_gcfs)

    def test_gcf_ordering_matches_peer_pct_ordering_within_team(self):
        """Higher peer pct must yield higher GCF within the same team."""
        pct = {1: 60.0, 2: 70.0, 3: 80.0}
        tid = {1: 1, 2: 1, 3: 1}
        gcf = compute_gcf_per_team(pct, tid)
        assert gcf[1] < gcf[2] < gcf[3]

    def test_clamping_applied_to_raw_gcf(self):
        """GCF must be clamped to [min_cf, max_cf]."""
        pct = {1: 10.0, 2: 90.0}
        tid = {1: 1, 2: 1}
        gcf = compute_gcf_per_team(pct, tid, min_cf=0.9, max_cf=1.1)
        assert gcf[1] == pytest.approx(0.9)
        assert gcf[2] == pytest.approx(1.1)

    def test_reported_scenario_all_gcf_above_one_is_fixed(self):
        """
        Reproduce the exact scenario from the bug report:
        3 members of the same team had GCF 1.32, 1.20, 1.16 (all > 1)
        because they were compared against a weaker cross-team population.

        After the fix (per-team grouping) the three GCFs must average to 1.0.
        """
        # Derive relative peer percentages from the observed GCF ratios
        # (overall mean M cancels out when computing per-team GCF):
        # pct_A = 1.32 * M, pct_B = 1.16 * M, pct_C = 1.20 * M
        M = 60.0  # hypothetical overall mean
        pct = {1: 1.32 * M, 2: 1.16 * M, 3: 1.20 * M}
        tid_fixed = {1: 1, 2: 1, 3: 1}
        gcf = compute_gcf_per_team(pct, tid_fixed, min_cf=0.0, max_cf=10.0)
        assert abs(mean(gcf.values()) - 1.0) < 1e-9
        # At least one must be < 1 and at least one > 1
        assert any(g < 1.0 for g in gcf.values())
        assert any(g > 1.0 for g in gcf.values())


# ---------------------------------------------------------------------------
# Tests for Bug 2: suggested_grade consistency with GCF
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestSuggestedGradeConsistency:
    """suggested_grade must be monotonically increasing with peer_pct (= GCF direction)."""

    def test_higher_peer_pct_gives_higher_suggested_grade(self):
        """student A (higher peer) must get a higher suggested_grade than B."""
        grade_a = peer_pct_to_suggested(80.0)
        grade_b = peer_pct_to_suggested(70.0)
        assert grade_a is not None and grade_b is not None
        assert grade_a > grade_b

    def test_suggested_grade_consistent_with_reported_scenario(self):
        """
        In the bug report the student with GCF 1.32 had grade 7.6 while
        the student with GCF 1.20 had grade 8.0 – an inversion.

        After the fix (pure-peer suggested_grade) the ordering must match
        the GCF ordering: GCF 1.32 > GCF 1.20 → grade_1 > grade_3.
        """
        M = 60.0
        pct = {1: 1.32 * M, 2: 1.16 * M, 3: 1.20 * M}
        suggested = {uid: peer_pct_to_suggested(p) for uid, p in pct.items()}
        gcf = compute_gcf_per_team(pct, {1: 1, 2: 1, 3: 1}, min_cf=0.0, max_cf=10.0)

        # Rank by GCF descending: uid 1 (1.32) > uid 3 (1.20) > uid 2 (1.16)
        gcf_rank = sorted(gcf, key=lambda u: gcf[u], reverse=True)
        suggested_rank = sorted(suggested, key=lambda u: (suggested[u] or 0), reverse=True)
        assert gcf_rank == suggested_rank, (
            f"GCF rank {gcf_rank} does not match suggested-grade rank {suggested_rank}"
        )

    def test_zero_peer_pct_returns_none(self):
        assert peer_pct_to_suggested(0.0) is None

    def test_full_peer_pct_gives_grade_ten(self):
        assert peer_pct_to_suggested(100.0) == 10.0

    def test_min_peer_pct_gives_grade_one(self):
        # near-minimum (approaching 0 from above) clamps to 1.0
        assert peer_pct_to_suggested(0.001) == 1.0

    def test_sixty_percent_maps_to_approx_6_4(self):
        grade = peer_pct_to_suggested(60.0)
        assert grade is not None
        assert abs(grade - 6.4) < 0.15

    def test_eighty_percent_maps_to_approx_8_2(self):
        grade = peer_pct_to_suggested(80.0)
        assert grade is not None
        assert abs(grade - 8.2) < 0.15
