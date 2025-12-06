import { EvaluationResult } from "@/dtos";

export const mockData: EvaluationResult[] = [
  {
    id: "ev-2",
    title: "Tussenreview sprint 2",
    course: "Ontwerpen & Onderzoeken – V2A",
    deadlineISO: "2025-11-05",
    status: "open",
    aiSummary:
      "Je teamgenoten waarderen je betrouwbaarheid en initiatief. Je plant taken goed, maar laat soms anderen te weinig aan het woord. Probeer actief te checken of iedereen mee is, vooral tijdens discussies. Je zelfstandigheid viel positief op. Blijf je reflectie kort en concreet koppelen aan acties.",
    teacherComments:
      "De basis is goed: planning en taakverdeling zijn duidelijk. Let in de volgende sprint extra op het tijdig uitspreken van verwachtingen en het betrekken van alle teamleden in de besluitvorming.",
    teacherGrade: 7.4,
    teacherGradeTrend: "+0,3 t.o.v. vorige sprint",
    teacherOmza: {
      O: 1.5,
      M: 2.6,
      Z: 3.2,
      A: 3.8,
    },
    teamContributionFactor: 1.06,
    teamContributionLabel: "Boven verwachting",
    omzaAverages: [
      { key: "O", label: "Organiseren", value: 4.25, delta: 0.3 },
      { key: "M", label: "Meedoen", value: 3.65, delta: -0.1 },
      { key: "Z", label: "Zelfvertrouwen", value: 3.4, delta: 0.2 },
      { key: "A", label: "Autonomie", value: 4.5, delta: 0.0 },
    ],
    peers: [
      {
        peerLabel: "Teamgenoot A",
        notes:
          "Zorgde voor planning en hield overzicht. Bij meningsverschillen soms wat sturend.",
        scores: {
          organiseren: 4.5,
          meedoen: 3.7,
          zelfvertrouwen: 3.6,
          autonomie: 4.6,
        },
      },
      {
        peerLabel: "Teamgenoot B",
        notes:
          "Heel betrouwbaar. Mag vaker vragen stellen zodat anderen hun idee uitleggen.",
        scores: {
          organiseren: 4.0,
          meedoen: 3.6,
          zelfvertrouwen: 3.2,
          autonomie: 4.4,
        },
      },
    ],
    selfScore: {
      organiseren: 4.2,
      meedoen: 3.8,
      zelfvertrouwen: 3.4,
      autonomie: 4.5,
    },
    trend: {
      organiseren: [3.7, 3.9, 4.1, 4.2],
      meedoen: [3.3, 3.5, 3.7, 3.7],
      zelfvertrouwen: [3.2, 3.5, 3.6, 3.4],
      autonomie: [3.8, 4.1, 4.3, 4.5],
    },
    gcfScore: 76,
  },
  {
    id: "ev-1",
    title: "Kick-off sprint 1",
    course: "Ontwerpen & Onderzoeken – V2A",
    deadlineISO: "2025-10-08",
    status: "closed",
    aiSummary:
      "Je startte de sprint gestructureerd en hielp de planning op te zetten. Je nam initiatief, maar let erop dat je ook taken overdraagt. Je betrokkenheid is goed zichtbaar.",
    teacherComments:
      "Goede start van het project. Je bent betrokken en neemt initiatief. Blijf werken aan je luistervaardigheden.",
    teacherGrade: 7.1,
    teacherGradeTrend: "Eerste beoordeling",
    teacherOmza: {
      O: 1.8,
      M: 2.3,
      Z: 2.9,
      A: 3.4,
    },
    teamContributionFactor: 1.01,
    teamContributionLabel: "Naar verwachting",
    omzaAverages: [
      { key: "O", label: "Organiseren", value: 3.9, delta: 0.0 },
      { key: "M", label: "Meedoen", value: 3.3, delta: 0.0 },
      { key: "Z", label: "Zelfvertrouwen", value: 3.6, delta: 0.0 },
      { key: "A", label: "Autonomie", value: 4.1, delta: 0.0 },
    ],
    peers: [
      {
        peerLabel: "Teamgenoot A",
        scores: {
          organiseren: 3.8,
          meedoen: 3.4,
          zelfvertrouwen: 3.5,
          autonomie: 4.0,
        },
      },
      {
        peerLabel: "Teamgenoot B",
        scores: {
          organiseren: 4.0,
          meedoen: 3.2,
          zelfvertrouwen: 3.7,
          autonomie: 4.2,
        },
      },
    ],
    selfScore: {
      organiseren: 3.9,
      meedoen: 3.5,
      zelfvertrouwen: 3.6,
      autonomie: 4.1,
    },
    trend: {
      organiseren: [3.8, 3.9],
      meedoen: [3.4, 3.5],
      zelfvertrouwen: [3.5, 3.6],
      autonomie: [4.0, 4.1],
    },
    gcfScore: 62,
  },
];
