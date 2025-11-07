"use client";

import { useState, useEffect } from "react";
import { competencyService } from "@/services/competency.service";
import type { ExternalInvite, ExternalInviteCreate } from "@/dtos/competency.dto";

interface ExternalInviteModalProps {
  windowId: number;
  subjectUserId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function ExternalInviteModal({
  windowId,
  subjectUserId,
  onClose,
  onSuccess,
}: ExternalInviteModalProps) {
  const [emails, setEmails] = useState<string[]>([""]);
  const [externalName, setExternalName] = useState("");
  const [externalOrg, setExternalOrg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addEmailField = () => {
    setEmails([...emails, ""]);
  };

  const removeEmailField = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Better email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = emails.filter(
      (email) => email.trim() && emailRegex.test(email.trim())
    );

    if (validEmails.length === 0) {
      setError("Please enter at least one valid email address.");
      return;
    }

    // Check for invalid emails
    const invalidEmails = emails.filter(
      (email) => email.trim() && !emailRegex.test(email.trim())
    );
    if (invalidEmails.length > 0) {
      setError(
        `Invalid email format: ${invalidEmails.join(", ")}. Please correct and try again.`
      );
      return;
    }

    try {
      setSubmitting(true);
      const data: ExternalInviteCreate = {
        window_id: windowId,
        subject_user_id: subjectUserId,
        emails: validEmails,
        external_name: externalName || undefined,
        external_organization: externalOrg || undefined,
      };

      await competencyService.createExternalInvites(data);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Failed to create invites. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Invite External Reviewers
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Privacy Notice:</strong> You are sharing an assessment request
              with an external person. Only invite people you trust. They will
              receive a one-time link to assess your competencies.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Email Addresses */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Addresses *
                </label>
                <div className="space-y-2">
                  {emails.map((email, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => updateEmail(index, e.target.value)}
                        placeholder="reviewer@example.com"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={index === 0}
                      />
                      {emails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEmailField(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {emails.length < 10 && (
                  <button
                    type="button"
                    onClick={addEmailField}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Add another email
                  </button>
                )}
              </div>

              {/* External Name (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name (Optional)
                </label>
                <input
                  type="text"
                  value={externalName}
                  onChange={(e) => setExternalName(e.target.value)}
                  placeholder="Reviewer name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* External Organization (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization (Optional)
                </label>
                <input
                  type="text"
                  value={externalOrg}
                  onChange={(e) => setExternalOrg(e.target.value)}
                  placeholder="Company or organization"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Information Box */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                <h3 className="font-semibold text-blue-900 text-sm mb-2">
                  What happens next?
                </h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Invitations will be sent to the provided email addresses</li>
                  <li>
                    • Each invitation contains a unique, one-time-use link
                  </li>
                  <li>• Links expire after 14 days</li>
                  <li>
                    • External reviewers will see your name and the competencies to
                    assess
                  </li>
                  <li>
                    • You'll only see aggregated scores from external reviewers
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? "Sending..." : "Send Invitations"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

interface ExternalInviteListProps {
  windowId: number;
  subjectUserId: number;
}

export function ExternalInviteList({
  windowId,
  subjectUserId,
}: ExternalInviteListProps) {
  const [invites, setInvites] = useState<ExternalInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInvites();
  }, [windowId, subjectUserId]);

  const loadInvites = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await competencyService.getExternalInvites(
        windowId,
        subjectUserId
      );
      setInvites(data);
    } catch (err: any) {
      setError("Failed to load invites");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (inviteId: number) => {
    if (!confirm("Are you sure you want to revoke this invitation?")) {
      return;
    }

    try {
      await competencyService.revokeExternalInvite(inviteId);
      loadInvites();
    } catch (err: any) {
      alert("Failed to revoke invite");
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      used: "bg-green-100 text-green-800",
      revoked: "bg-red-100 text-red-800",
      expired: "bg-gray-100 text-gray-800",
    };
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded ${
          colors[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {status}
      </span>
    );
  };

  if (loading) {
    return <div className="text-sm text-gray-600">Loading invites...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-600">{error}</div>;
  }

  if (invites.length === 0) {
    return (
      <div className="text-sm text-gray-600">
        No external invitations yet. Click "Invite External" to send invitations.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Email
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Sent
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Expires
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {invites.map((invite) => (
            <tr key={invite.id}>
              <td className="px-4 py-2 text-sm text-gray-900">{invite.email}</td>
              <td className="px-4 py-2">{getStatusBadge(invite.status)}</td>
              <td className="px-4 py-2 text-sm text-gray-600">
                {invite.sent_at
                  ? new Date(invite.sent_at).toLocaleDateString()
                  : "-"}
              </td>
              <td className="px-4 py-2 text-sm text-gray-600">
                {new Date(invite.expires_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-2">
                {invite.status === "pending" && (
                  <button
                    onClick={() => handleRevoke(invite.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Revoke
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
