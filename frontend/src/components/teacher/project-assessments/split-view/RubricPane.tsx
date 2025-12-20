'use client';

import React from 'react';

interface RubricPaneProps {
  children: React.ReactNode;
}

export function RubricPane({ children }: RubricPaneProps) {
  return (
    <div>
      {children}
    </div>
  );
}
