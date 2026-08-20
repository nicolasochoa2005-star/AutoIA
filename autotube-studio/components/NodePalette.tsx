'use client';

import { listNodeDefs } from '@/lib/nodes/registry';
import { CATEGORY_COLORS, type StudioNodeType } from '@/lib/nodes/types';

export function NodePalette({ onAdd }: { onAdd: (type: StudioNodeType) => void }) {
  const defs = listNodeDefs();
  return (
    <aside
      style={{
        width: 180,
        background: '#0f172a',
        borderRight: '1px solid #1f2937',
        padding: 10,
        overflowY: 'auto',
        fontSize: 12,
        color: '#e5e7eb',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Nodos</div>
      {defs.map((def) => (
        <button
          key={def.type}
          onClick={() => onAdd(def.type)}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            marginBottom: 6,
            padding: '6px 8px',
            background: '#111827',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderLeft: `4px solid ${CATEGORY_COLORS[def.category]}`,
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {def.label}
        </button>
      ))}
    </aside>
  );
}
