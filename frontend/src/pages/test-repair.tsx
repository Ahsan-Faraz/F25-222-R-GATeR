import React from 'react';
import Head from 'next/head';
import GATRPanel from '@/components/gatr/GATRPanel';

export default function TestRepairPage() {
  return (
    <>
      <Head>
        <title>GATeR — Test Repair</title>
      </Head>
      <div className="p-8 space-y-6 animate-fade-in">
        <GATRPanel />
      </div>
    </>
  );
}
