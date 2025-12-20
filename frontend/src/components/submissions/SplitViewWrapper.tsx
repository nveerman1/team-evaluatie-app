'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { submissionService } from '@/services/submission.service';
import { SubmissionOut } from '@/dtos/submission.dto';
import { DocumentPane } from '@/components/submissions/DocumentPane';

interface SplitViewWrapperProps {
  children: React.ReactNode;
  assessmentId: number;
  teamNumber?: number;
}

const PANE_WIDTH_KEY = 'documentPaneWidth';
const DEFAULT_PANE_WIDTH = 50; // percentage

export function SplitViewWrapper({ children, assessmentId, teamNumber }: SplitViewWrapperProps) {
  const [submissions, setSubmissions] = useState<SubmissionOut[]>([]);
  const [paneWidth, setPaneWidth] = useState(DEFAULT_PANE_WIDTH);
  const [showPane, setShowPane] = useState(true);
  const [isResizing, setIsResizing] = useState(false);

  // Load saved pane width from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(PANE_WIDTH_KEY);
    if (saved) {
      setPaneWidth(parseInt(saved, 10));
    }
  }, []);

  // Save pane width to localStorage
  const savePaneWidth = (width: number) => {
    setPaneWidth(width);
    localStorage.setItem(PANE_WIDTH_KEY, width.toString());
  };

  // Load submissions for the current team
  useEffect(() => {
    if (teamNumber) {
      loadSubmissionsForTeam();
    }
  }, [assessmentId, teamNumber]);

  const loadSubmissionsForTeam = async () => {
    try {
      // Get all submissions for the assessment
      const data = await submissionService.getSubmissionsForAssessment(assessmentId);
      // Filter for current team
      const teamSubmissions = data.items
        .filter(item => item.team_number === teamNumber)
        .map(item => item.submission);
      setSubmissions(teamSubmissions);
    } catch (err) {
      console.error('Failed to load submissions:', err);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const containerWidth = window.innerWidth;
      const newWidth = ((containerWidth - e.clientX) / containerWidth) * 100;
      
      // Constrain between 20% and 70%
      const constrainedWidth = Math.max(20, Math.min(70, newWidth));
      savePaneWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  if (!showPane) {
    return <div className="w-full">{children}</div>;
  }

  const contentWidth = 100 - paneWidth;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Main content area */}
      <div 
        className="overflow-auto"
        style={{ width: `${contentWidth}%` }}
      >
        {children}
      </div>

      {/* Resizable divider */}
      <div
        className={`w-1 bg-gray-200 hover:bg-blue-500 cursor-col-resize ${
          isResizing ? 'bg-blue-500' : ''
        }`}
        onMouseDown={handleMouseDown}
      />

      {/* Document pane */}
      <div 
        className="overflow-hidden"
        style={{ width: `${paneWidth}%` }}
      >
        <DocumentPane
          submissions={submissions}
          teamId={teamNumber}
          assessmentId={assessmentId}
          onClose={() => setShowPane(false)}
        />
      </div>
    </div>
  );
}
