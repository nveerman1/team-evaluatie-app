from __future__ import annotations
from fastapi import APIRouter, Depends
from typing import Dict

from app.api.v1.deps import get_current_user
from app.api.v1.schemas.flags_explain import FlagsExplainResponse, FlagDefinition

router = APIRouter(prefix="/flags", tags=["flags"])


def _defs() -> Dict[str, FlagDefinition]:
    return {
        "FEW_REVIEWERS": FlagDefinition(
            code="FEW_REVIEWERS",
            label="Te weinig reviewers",
            description="Er zijn (nog) te weinig peer-beoordelingen om een betrouwbare inschatting te maken.",
            typical_causes=[
                "Niet alle toegewezen peers hebben ingeleverd",
                "Groep is (te) klein of ongelijk verdeeld",
            ],
            suggested_actions=[
                "Controleer toewijzingen in Allocations; verhoog peers_per_student",
                "Stuur reminder naar ontbrekende reviewers",
                "Overweeg om self-review tijdelijk uit te sluiten in analyses",
            ],
            notes=[
                "Drempel instelbaar via ?min_reviewers=… op /flags endpoints.",
            ],
        ),
        "MISSING_SELF": FlagDefinition(
            code="MISSING_SELF",
            label="Geen zelfbeoordeling",
            description="De student heeft geen self-review ingediend.",
            typical_causes=[
                "Self-review vergeten of deadline gemist",
                "Self-review was optioneel en niet ingevuld",
            ],
            suggested_actions=[
                "Vraag student de self-review alsnog te completeren",
                "Maak self-review verplicht in instellingen van de evaluatie",
            ],
            notes=[
                "SPR kan niet betrouwbaar worden berekend zonder self-review.",
            ],
        ),
        "HIGH_SPR": FlagDefinition(
            code="HIGH_SPR",
            label="Hoge Self/Peer-ratio",
            description="Self-score ligt substantieel hoger dan de peer-gemiddelden.",
            typical_causes=[
                "Overschatting eigen bijdrage",
                "Peer-scores zijn aan de lage kant (strenge reviewers)",
            ],
            suggested_actions=[
                "Laat student toelichten waarom zij/hij hoger scoort dan peers",
                "Vergelijk per-criterium verschillen in het dashboard (include_breakdown=true)",
                "Plan een korte 1-op-1 of teamcheck",
            ],
            notes=[
                "Drempel instelbaar via ?spr_high=… (standaard 1.30).",
            ],
        ),
        "LOW_SPR": FlagDefinition(
            code="LOW_SPR",
            label="Lage Self/Peer-ratio",
            description="Self-score ligt substantieel lager dan de peer-gemiddelden.",
            typical_causes=[
                "Onderschatting van eigen prestaties",
                "Peers zijn mild geweest of wilden conflicten vermijden",
            ],
            suggested_actions=[
                "Laat student reflecteren op concrete bijdragen",
                "Bespreek met team of de peer-scores onderbouwd zijn",
            ],
            notes=[
                "Drempel instelbaar via ?spr_low=… (standaard 0.70).",
            ],
        ),
        "LOW_GCF": FlagDefinition(
            code="LOW_GCF",
            label="Afwijkend t.o.v. cohort (GCF laag)",
            description="Gemiddelde peer-score ligt ver van het cohortgemiddelde.",
            typical_causes=[
                "Team werkt/communiceert anders dan gemiddelde",
                "Beoordelings-interpretatie door peers wijkt af",
            ],
            suggested_actions=[
                "Check rubric-interpretatie: begrijpen reviewers de descriptors?",
                "Bekijk groepsdynamiek en rolverdeling",
            ],
            notes=[
                "Drempel instelbaar via ?gcf_low=… (standaard 0.70).",
            ],
        ),
        "OUTLIER_ZSCORE": FlagDefinition(
            code="OUTLIER_ZSCORE",
            label="Outlier t.o.v. cohort (z-score)",
            description="Peer-gemiddelde wijkt statistisch sterk af van cohort (|z| ≥ drempel).",
            typical_causes=[
                "Echt uitzonderlijke prestatie (positief of negatief)",
                "Kleine steekproefgrootte en variantie-effecten",
            ],
            suggested_actions=[
                "Controleer reviewers_count; vraag om extra review(s) indien laag",
                "Bekijk per-criterium verschillen om oorzaak te duiden",
            ],
            notes=[
                "Drempel instelbaar via ?zscore_abs=… (standaard 2.0).",
            ],
        ),
    }


@router.get("/explain", response_model=FlagsExplainResponse)
def flags_explain(_=Depends(get_current_user)) -> FlagsExplainResponse:
    # Geen school-specifieke data nodig; auth check blijft wel verplicht.
    return FlagsExplainResponse(codes=_defs())
