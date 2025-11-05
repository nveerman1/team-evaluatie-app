"use client";

import { useState, useMemo } from "react";

type Descriptor = {
  level1?: string;
  level2?: string;
  level3?: string;
  level4?: string;
  level5?: string;
};

export type CriterionItem = {
  id?: number | null;
  name: string;
  weight: number;
  category?: string | null;
  order?: number | null;
  descriptors: Descriptor;
};

type RubricEditorProps = {
  scope: "peer" | "project";
  items: CriterionItem[];
  onItemsChange: (items: CriterionItem[]) => void;
};

const PEER_CATEGORIES = [
  { value: "Organiseren", tooltip: "Plannen en organiseren van taken" },
  { value: "Meedoen", tooltip: "Actieve bijdrage aan het team" },
  { value: "Zelfvertrouwen", tooltip: "Zelfvertrouwen tonen in het werk" },
  { value: "Autonomie", tooltip: "Zelfstandig werken en beslissingen nemen" },
];

const PROJECT_CATEGORIES = [
  { value: "Projectproces", tooltip: "Aanpak en proces van het project" },
  { value: "Eindresultaat", tooltip: "Kwaliteit van het eindproduct" },
  { value: "Communicatie", tooltip: "Communicatie tijdens het project" },
];

const EMPTY_DESC: Descriptor = {
  level1: "",
  level2: "",
  level3: "",
  level4: "",
  level5: "",
};

export default function RubricEditor({
  scope,
  items,
  onItemsChange,
}: RubricEditorProps) {
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(
    new Set(
      scope === "peer"
        ? PEER_CATEGORIES.map((c) => c.value)
        : PROJECT_CATEGORIES.map((c) => c.value)
    )
  );
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

  const categories =
    scope === "peer" ? PEER_CATEGORIES : PROJECT_CATEGORIES;

  const togglePanel = (category: string) => {
    setExpandedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const addCriterion = (category: string) => {
    const maxOrder = items.reduce((m, it) => Math.max(m, it.order ?? 0), 0);
    const newItem: CriterionItem = {
      name: "Nieuw criterium",
      weight: 1.0,
      category,
      order: maxOrder + 1,
      descriptors: { ...EMPTY_DESC },
    };
    onItemsChange([...items, newItem]);
  };

  const removeCriterion = (idx: number) => {
    onItemsChange(items.filter((_, i) => i !== idx));
  };

  const updateCriterion = (
    idx: number,
    updates: Partial<CriterionItem>
  ) => {
    onItemsChange(
      items.map((it, i) =>
        i === idx ? { ...it, ...updates } : it
      )
    );
  };

  const moveCriterion = (idx: number, dir: -1 | 1) => {
    const item = items[idx];
    const category = item.category;
    
    // Get all items in the same category
    const categoryIndices = items
      .map((it, i) => ({ item: it, index: i }))
      .filter(({ item: it }) => it.category === category);
    
    // Find position within category
    const categoryPos = categoryIndices.findIndex(({ index }) => index === idx);
    const targetPos = categoryPos + dir;
    
    if (targetPos < 0 || targetPos >= categoryIndices.length) return;
    
    // Swap within the category
    const newItems = [...items];
    const targetIdx = categoryIndices[targetPos].index;
    [newItems[idx], newItems[targetIdx]] = [newItems[targetIdx], newItems[idx]];
    onItemsChange(newItems.map((it, i) => ({ ...it, order: i + 1 })));
  };

  const handleDragStart = (idx: number) => {
    setDraggedIndex(idx);
  };

  const handleDragOver = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    setDragOverCategory(category);
  };

  const handleDragLeave = () => {
    setDragOverCategory(null);
  };

  const handleDrop = (e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    setDragOverCategory(null);
    
    if (draggedIndex === null) return;
    
    const item = items[draggedIndex];
    if (item.category === targetCategory) return;
    
    // Simple confirmation - could be replaced with a custom modal in the future
    const confirmed = window.confirm(
      `Wil je dit criterium verplaatsen naar "${targetCategory}"?`
    );
    
    if (confirmed) {
      updateCriterion(draggedIndex, { category: targetCategory });
    }
    
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverCategory(null);
  };

  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, Array<CriterionItem & { index: number }>> = {};
    categories.forEach((cat) => {
      grouped[cat.value] = [];
    });
    
    items.forEach((item, index) => {
      const cat = item.category || "";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({ ...item, index });
    });
    
    return grouped;
  }, [items, categories]);

  const weightsByCategory = useMemo(() => {
    const weights: Record<string, number> = {};
    categories.forEach((cat) => {
      weights[cat.value] = itemsByCategory[cat.value]?.reduce(
        (sum, it) => sum + (Number(it.weight) || 0),
        0
      ) || 0;
    });
    return weights;
  }, [itemsByCategory, categories]);

  const totalWeight = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.weight) || 0), 0),
    [items]
  );

  return (
    <div className="space-y-4">
      {categories.map((cat) => {
        const isExpanded = expandedPanels.has(cat.value);
        const categoryItems = itemsByCategory[cat.value] || [];
        const categoryWeight = weightsByCategory[cat.value] || 0;
        const isDragOver = dragOverCategory === cat.value;

        return (
          <section
            key={cat.value}
            className={`bg-white border rounded-2xl overflow-hidden ${
              isDragOver ? "ring-2 ring-blue-500" : ""
            }`}
            onDragOver={(e) => handleDragOver(e, cat.value)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, cat.value)}
            role="region"
            aria-label={`${cat.value} sectie`}
          >
            {/* Panel Header */}
            <header className="flex items-center justify-between gap-4 px-4 py-3 bg-gray-50 border-b">
              <button
                onClick={() => togglePanel(cat.value)}
                className="flex items-center gap-3 flex-1 text-left"
                aria-expanded={isExpanded}
                aria-controls={`panel-${cat.value}`}
              >
                <span className="text-lg font-semibold">{cat.value}</span>
                <span className="text-sm text-gray-600" title={cat.tooltip}>
                  ({cat.tooltip})
                </span>
                <span className="ml-auto text-sm text-gray-500">
                  {isExpanded ? "▼" : "▶"}
                </span>
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  Weging: <strong>{categoryWeight.toFixed(2)}</strong>
                </span>
                <button
                  onClick={() => addCriterion(cat.value)}
                  className="px-3 py-1 rounded-lg bg-black text-white text-sm"
                  aria-label={`Voeg criterium toe aan ${cat.value}`}
                >
                  + Criterium
                </button>
              </div>
            </header>

            {/* Panel Content */}
            {isExpanded && (
              <div
                id={`panel-${cat.value}`}
                className="divide-y"
              >
                {categoryItems.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    Geen criteria. Klik op &quot;+ Criterium&quot; om toe te voegen.
                  </div>
                ) : (
                  categoryItems.map((item) => (
                    <CriterionCard
                      key={item.index}
                      item={item}
                      index={item.index}
                      onUpdate={updateCriterion}
                      onRemove={removeCriterion}
                      onMove={moveCriterion}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                  ))
                )}
              </div>
            )}
          </section>
        );
      })}

      {/* Status Bar */}
      <div className="sticky bottom-0 bg-white border rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="text-sm">
              <span className="text-gray-600">Totale weging: </span>
              <strong className={totalWeight === 1.0 ? "text-green-600" : "text-orange-600"}>
                {totalWeight.toFixed(2)}
              </strong>
              <span className="text-gray-500 ml-2">
                {totalWeight !== 1.0 && "(streef 1.0)"}
              </span>
            </div>
            {categories.map((cat) => (
              <div key={cat.value} className="text-sm">
                <span className="text-gray-600">{cat.value}: </span>
                <strong>{weightsByCategory[cat.value].toFixed(2)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type CriterionCardProps = {
  item: CriterionItem;
  index: number;
  onUpdate: (idx: number, updates: Partial<CriterionItem>) => void;
  onRemove: (idx: number) => void;
  onMove: (idx: number, dir: -1 | 1) => void;
  onDragStart: (idx: number) => void;
  onDragEnd: () => void;
};

function CriterionCard({
  item,
  index,
  onUpdate,
  onRemove,
  onMove,
  onDragStart,
  onDragEnd,
}: CriterionCardProps) {
  const handleDescriptorChange = (level: string, value: string) => {
    onUpdate(index, {
      descriptors: {
        ...item.descriptors,
        [level]: value,
      },
    });
  };

  const getCharCount = (text: string) => text.length;

  return (
    <article
      className="px-4 py-3 space-y-3"
      draggable
      onDragStart={() => onDragStart(index)}
      onDragEnd={onDragEnd}
      role="article"
      aria-label={`Criterium: ${item.name}`}
    >
      {/* Top Row: Title, Weight, Actions */}
      <div className="flex items-center gap-3">
        <span
          className="cursor-move text-gray-400 text-lg"
          aria-label="Sleep om te verplaatsen"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              // Keyboard drag-drop would require complex state management
              // For now, users can use the arrow buttons for keyboard reordering
            }
          }}
        >
          ⋮⋮
        </span>
        <input
          type="text"
          className="flex-1 border rounded-lg px-3 py-2"
          value={item.name}
          onChange={(e) => onUpdate(index, { name: e.target.value })}
          placeholder="Criterium naam"
          aria-label="Criterium naam"
        />
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Weging:</span>
          <input
            type="number"
            step="0.1"
            min="0"
            className="w-20 border rounded-lg px-2 py-2"
            value={Number.isFinite(item.weight) ? item.weight : 0}
            onChange={(e) =>
              onUpdate(index, { weight: e.target.valueAsNumber || 0 })
            }
            aria-label="Weging"
          />
        </label>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMove(index, -1)}
            className="p-2 rounded-lg border hover:bg-gray-50"
            title="Omhoog"
            aria-label="Verplaats omhoog"
          >
            ↑
          </button>
          <button
            onClick={() => onMove(index, 1)}
            className="p-2 rounded-lg border hover:bg-gray-50"
            title="Omlaag"
            aria-label="Verplaats omlaag"
          >
            ↓
          </button>
          <button
            onClick={() => onRemove(index)}
            className="p-2 rounded-lg border text-red-600 hover:bg-red-50"
            title="Verwijder"
            aria-label="Verwijder criterium"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Second Row: Level Descriptors */}
      <div className="grid grid-cols-5 gap-3">
        {(["level1", "level2", "level3", "level4", "level5"] as const).map(
          (level, idx) => {
            const text = (item.descriptors?.[level] ?? "") as string;
            const charCount = getCharCount(text);
            
            return (
              <div key={level} className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">
                  Niveau {idx + 1}
                </label>
                <textarea
                  className="w-full border rounded-lg px-2 py-2 text-sm resize-none"
                  value={text}
                  onChange={(e) => handleDescriptorChange(level, e.target.value)}
                  placeholder={`Beschrijving niveau ${idx + 1}`}
                  rows={3}
                  style={{ maxHeight: "120px" }}
                  aria-label={`Niveau ${idx + 1} beschrijving`}
                />
                <div className="text-xs text-gray-500 text-right">
                  {charCount} tekens
                </div>
              </div>
            );
          }
        )}
      </div>
    </article>
  );
}
