"use client";

import { Badge } from "@/components/ui/badge";
import type { MatrixPersona, MatrixStage } from "@/lib/matrix/types";

interface MatrixPreviewProps {
  personas: MatrixPersona[];
  stages: MatrixStage[];
}

export function MatrixPreview({ personas, stages }: MatrixPreviewProps) {
  const activePersonas = personas.filter((p) => p.active);
  const activeStages = stages.filter((s) => s.active);

  if (activePersonas.length === 0 || activeStages.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-sm">No active personas or stages to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="text-2xl font-bold text-gray-900">{activePersonas.length}</div>
          <div className="text-xs text-gray-500">Active Personas</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">{activeStages.length}</div>
          <div className="text-xs text-gray-500">Active Stages</div>
        </div>
      </div>

      {/* Matrix Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* Header row */}
          <div className="flex border-b border-gray-200">
            <div className="w-24 flex-shrink-0"></div>
            {activeStages.map((stage) => (
              <div
                key={stage.id}
                className="flex-1 min-w-[80px] px-2 py-2 text-center text-xs font-medium text-gray-600"
              >
                {stage.label}
              </div>
            ))}
          </div>

          {/* Persona rows */}
          {activePersonas.map((persona) => (
            <div key={persona.id} className="flex border-b border-gray-100 last:border-0">
              {/* Persona label */}
              <div className="w-24 flex-shrink-0 px-2 py-3 flex items-center">
                <span className="text-xs font-medium text-gray-700 truncate" title={persona.label}>
                  {persona.label}
                </span>
              </div>

              {/* Stage cells */}
              {activeStages.map((stage) => (
                <div
                  key={stage.id}
                  className="flex-1 min-w-[80px] px-2 py-3 flex items-center justify-center"
                >
                  <div className="w-full aspect-square rounded border border-gray-200 bg-gray-50 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>Active Cell</span>
          </div>
          <span>•</span>
          <span>Grid will be {activePersonas.length} × {activeStages.length}</span>
        </div>
      </div>

      {/* Stage metrics */}
      {activeStages.some((s) => s.primaryMetric) && (
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Primary Metrics</h4>
          <div className="space-y-1">
            {activeStages
              .filter((s) => s.primaryMetric)
              .map((stage) => (
                <div key={stage.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">{stage.label}</span>
                  <Badge variant="outline" className="text-xs">
                    {stage.primaryMetric?.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Core stages */}
      {activeStages.some((s) => s.coreStage) && (
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Core Stages</h4>
          <div className="flex flex-wrap gap-1">
            {activeStages
              .filter((s) => s.coreStage)
              .map((stage) => (
                <Badge key={stage.id} className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                  {stage.label}
                </Badge>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
