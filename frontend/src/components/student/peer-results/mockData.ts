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
