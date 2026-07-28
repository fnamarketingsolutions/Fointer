// src/components/admin/AnalyticsOverview.jsx
import React from 'react';
import { Users, UsersRound, HardDrive, Activity, Server } from 'lucide-react';

const AnalyticsOverview = () => {
  const stats = [
    { title: 'Total Registered Users', value: '124,890', sub: '+12% this month', icon: Users },
    { title: 'Active Communities', value: '1,420', sub: '+8 created today', icon: UsersRound },
    { title: 'Storage Usage', value: '4.82 TB', sub: 'AWS S3 Bucket', icon: HardDrive },
    { title: 'System Health Status', value: '99.98%', sub: 'Optimal uptime', icon: Activity },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl font-bold text-amber-50 tracking-tight">System Telemetry</h1>
        <p className="text-xs text-stone-400 mt-1">Real-time health indicators and platform usage overview.</p>
      </div>

      {/* Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-[#141210] border border-stone-800/60 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-400 font-medium">{stat.title}</span>
                <Icon className="w-4 h-4 text-amber-500" />
              </div>
              <p className="font-serif text-2xl font-bold text-amber-100">{stat.value}</p>
              <p className="text-[11px] text-stone-500">{stat.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Infrastructure Card */}
      <div className="bg-[#141210] border border-stone-800/60 rounded-xl p-6 space-y-4">
        <h2 className="font-serif text-lg font-bold text-stone-200 flex items-center gap-2">
          <Server className="w-4 h-4 text-amber-500" /> Server Node Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-[#0c0a09] border border-stone-800/40 rounded-lg">
            <span className="text-xs text-stone-400">API Gateway Response</span>
            <p className="font-serif text-lg font-bold text-emerald-400 mt-1">24ms (Healthy)</p>
          </div>
          <div className="p-4 bg-[#0c0a09] border border-stone-800/40 rounded-lg">
            <span className="text-xs text-stone-400">MongoDB Cluster Load</span>
            <p className="font-serif text-lg font-bold text-amber-400 mt-1">42% Utilization</p>
          </div>
          <div className="p-4 bg-[#0c0a09] border border-stone-800/40 rounded-lg">
            <span className="text-xs text-stone-400">Storage Cluster</span>
            <p className="font-serif text-lg font-bold text-emerald-400 mt-1">Connected</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsOverview;