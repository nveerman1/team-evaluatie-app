"use client";

import { StudentResult } from "@/dtos";

type ResultsViewProps = {
  result: StudentResult;
};

export function ResultsView({ result }: ResultsViewProps) {
  return (
    <div className="space-y-6">
      {/* Grade Section */}
      <div className="p-6 border rounded-xl bg-white">
        <h3 className="text-xl font-semibold mb-4">Jouw Cijfer</h3>
        
        <div className="grid md:grid-cols-3 gap-4">
          {result.final_grade !== undefined && result.final_grade !== null && (
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-gray-600">Eindcijfer</div>
              <div className="text-3xl font-bold text-green-700">
                {result.final_grade.toFixed(1)}
              </div>
            </div>
          )}
          
          {result.group_grade !== undefined && result.group_grade !== null && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-600">Groepscijfer</div>
              <div className="text-2xl font-bold text-blue-700">
                {result.group_grade.toFixed(1)}
              </div>
            </div>
          )}
          
          {result.gcf !== undefined && result.gcf !== null && (
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-gray-600">GCF</div>
              <div className="text-2xl font-bold text-purple-700">
                {result.gcf.toFixed(2)}
              </div>
            </div>
          )}
        </div>

        {result.teacher_comment && (
          <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
            <div className="text-sm font-medium text-gray-700 mb-1">
              Opmerking docent:
            </div>
            <div className="text-gray-800">{result.teacher_comment}</div>
          </div>
        )}
      </div>

      {/* Received Feedback Section */}
      <div className="p-6 border rounded-xl bg-white">
        <h3 className="text-xl font-semibold mb-4">
          Ontvangen Feedback ({result.peer_feedback.length} peer
          {result.peer_feedback.length !== 1 ? "s" : ""})
        </h3>

        {result.peer_feedback.length === 0 ? (
          <p className="text-gray-500">Nog geen feedback ontvangen.</p>
        ) : (
          <div className="space-y-4">
            {result.peer_feedback.map((feedback, idx) => (
              <div key={idx} className="p-4 border rounded-lg bg-gray-50">
                <div className="font-medium text-gray-700 mb-3">
                  Peer {idx + 1} (anoniem)
                </div>
                
                <div className="space-y-2">
                  {feedback.comments.map((comment) => (
                    <div key={comment.criterion_id} className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700">
                          {comment.criterion_name}:
                        </span>
                        <span className="px-2 py-0.5 bg-gray-200 rounded text-xs font-semibold">
                          {comment.score}/5
                        </span>
                      </div>
                      {comment.text && (
                        <div className="mt-1 text-gray-600 italic">
                          "{comment.text}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Criteria Summary */}
      {result.criteria_summary.length > 0 && (
        <div className="p-6 border rounded-xl bg-white">
          <h3 className="text-xl font-semibold mb-4">Scores per Criterium</h3>
          
          <div className="space-y-3">
            {result.criteria_summary.map((criterion) => (
              <div
                key={criterion.criterion_id}
                className="p-3 border rounded-lg bg-gray-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{criterion.criterion_name}</span>
                  <span className="text-sm text-gray-500">
                    Gewicht: {criterion.weight}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Jouw score: </span>
                    <span className="font-semibold">
                      {criterion.self_score?.toFixed(1) ?? "−"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Peer gemiddelde: </span>
                    <span className="font-semibold">
                      {criterion.peer_avg_score?.toFixed(1) ?? "−"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reflection Section */}
      {result.reflection && (
        <div className="p-6 border rounded-xl bg-white">
          <h3 className="text-xl font-semibold mb-4">Jouw Reflectie</h3>
          
          {result.reflection.submitted_at && (
            <div className="text-sm text-gray-500 mb-3">
              Ingediend op:{" "}
              {new Date(result.reflection.submitted_at).toLocaleDateString("nl-NL")}
            </div>
          )}
          
          <div className="p-4 bg-gray-50 rounded-lg whitespace-pre-wrap">
            {result.reflection.text}
          </div>
          
          {result.reflection.editable && (
            <div className="mt-3 text-sm text-blue-600">
              Je kunt je reflectie nog bewerken via de wizard.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
