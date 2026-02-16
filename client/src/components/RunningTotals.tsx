interface Props {
  stats: {
    totalParticipants: number;
    totalReports: number;
    perRepeater: { short_name: string; count: number }[];
  };
}

export default function RunningTotals({ stats }: Props) {
  return (
    <div className="bg-white rounded-lg shadow-sm px-2 sm:px-4 py-2 flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm sticky top-0 z-10 border-b">
      <div className="font-medium text-[#1e3a5f]">
        Anwesend: <span className="font-bold">{stats.totalParticipants}</span>
      </div>
      <div className="font-medium text-[#1e3a5f]">
        Rapporte: <span className="font-bold">{stats.totalReports}</span>
      </div>
      <div className="border-l border-gray-300 pl-2 sm:pl-4 flex flex-wrap gap-2 sm:gap-3">
        {stats.perRepeater.map(r => (
          <div key={r.short_name} className="text-gray-600">
            {r.short_name}: <span className="font-semibold text-gray-800">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
