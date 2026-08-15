'use client';

import React, { use } from 'react';
import { HostTVDashboard } from '@/components/tv/HostTVDashboard';

interface TVPageProps {
  params: Promise<{ id: string }>;
}

export default function TVPage({ params }: TVPageProps) {
  const { id: roomId } = use(params);

  return (
    <main className="min-h-screen bg-slate-950">
      <HostTVDashboard roomId={roomId} />
    </main>
  );
}
