"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { listLearningObjectives } from "@/services/learning-objective.service";
import type { LearningObjectiveDto } from "@/dtos/learning-objective.dto";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  learning_objective_ids?: number[];
};

type RubricEditorProps = {
  scope: "peer" | "project";
  targetLevel?: "onderbouw" | "bovenbouw" | null;
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
  targetLevel,
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
  const [learningObjectives, setLearningObjectives] = useState<
    LearningObjectiveDto[]
  >([]);
  const [isMounted, setIsMounted] = useState(false);

  const categories =
    scope === "peer" ? PEER_CATEGORIES : PROJECT_CATEGORIES;

  // DnD sensors for criteria reordering within categories
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Set mounted state to avoid hydration issues
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch learning objectives (only on client side), filtered by targetLevel
  useEffect(() => {
    if (!isMounted) return;

    async function fetchObjectives() {
      try {
        const response = await listLearningObjectives({
          phase: targetLevel || undefined,
          limit: 100,
        });
        setLearningObjectives(response.items);
      } catch (err) {
        console.error("Error fetching learning objectives:", err);
      }
    }
    fetchObjectives();
  }, [isMounted, targetLevel]);

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

  // Handle drag end for reordering criteria within a category
  const handleDragEnd = useCallback(
    (event: DragEndEvent, categoryValue: string) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      // Find items in this category
      const categoryItems = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.category === categoryValue);

      // Find old and new positions within the category
      const oldCategoryIndex = categoryItems.findIndex(
        ({ index }) => index === active.id
      );
      const newCategoryIndex = categoryItems.findIndex(
        ({ index }) => index === over.id
      );

      if (oldCategoryIndex === -1 || newCategoryIndex === -1) return;

      // Reorder within category
      const reorderedCategoryItems = arrayMove(
        categoryItems,
        oldCategoryIndex,
        newCategoryIndex
      );

      // Create a map of original index to new order within category
      const newOrderMap = new Map<number, number>();
      reorderedCategoryItems.forEach((catItem, newPos) => {
        newOrderMap.set(catItem.index, newPos + 1);
      });

      // Update the items with new order values for the affected category
      const updatedItems = items.map((item, index) => {
        if (newOrderMap.has(index)) {
          return { ...item, order: newOrderMap.get(index)! };
        }
        return item;
      });

      // Create a category order map for efficient sorting
      const categoryOrderMap = new Map<string, number>();
      categories.forEach((cat, idx) => {
        categoryOrderMap.set(cat.value, idx);
      });

      // Sort items by category and then by order within category
      const sortedItems = [...updatedItems].sort((a, b) => {
        const catOrderA = categoryOrderMap.get(a.category || "") ?? 999;
        const catOrderB = categoryOrderMap.get(b.category || "") ?? 999;
        if (catOrderA !== catOrderB) return catOrderA - catOrderB;
        return (a.order ?? 0) - (b.order ?? 0);
      });

      onItemsChange(sortedItems);
    },
    [items, categories, onItemsChange]
  );

  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, Array<CriterionItem & { index: number }>> = {};
    categories.forEach((cat) => {
      grouped[cat.value] = [];
    });
    
    items.forEach((item, index) => {
      const cat = item.category || "";
      // Only add to grouped if category exists in our predefined categories
      if (grouped[cat]) {
        grouped[cat].push({ ...item, index });
      }
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

        return (
          <section
            key={cat.value}
            className="rounded-2xl border border-slate-200 bg-white shadow-sm"
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
                <span className="text-sm font-semibold text-slate-900">{cat.value}</span>
                <span className="text-xs text-slate-500" title={cat.tooltip}>
                  ({cat.tooltip})
                </span>
                <span className="text-xs font-medium text-slate-400 ml-1">
                  ({categoryItems.length})
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

            {/* Panel Content with drag & drop */}
            {isExpanded && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => handleDragEnd(event, cat.value)}
              >
                <SortableContext
                  items={categoryItems.map((item) => item.index)}
                  strategy={verticalListSortingStrategy}
                >
                  <div
                    id={`panel-${cat.value}`}
                    className="divide-y divide-slate-100"
                  >
                    {categoryItems.length === 0 ? (
                      <div className="px-4 py-8 text-center text-gray-500">
                        Geen criteria. Klik op &quot;+ Criterium&quot; om toe te voegen.
                      </div>
                    ) : (
                      categoryItems.map((item) => (
                        <SortableCriterionCard
                          key={item.index}
                          item={item}
                          index={item.index}
                          onUpdate={updateCriterion}
                          onRemove={removeCriterion}
                          learningObjectives={learningObjectives}
                        />
                      ))
                    )}
                  </div>
                </SortableContext>
              </DndContext>
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

type SortableCriterionCardProps = {
  item: CriterionItem;
  index: number;
  onUpdate: (idx: number, updates: Partial<CriterionItem>) => void;
  onRemove: (idx: number) => void;
  learningObjectives: LearningObjectiveDto[];
};

function SortableCriterionCard({
  item,
  index,
  onUpdate,
  onRemove,
  learningObjectives,
}: SortableCriterionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: index });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [showObjectiveDropdown, setShowObjectiveDropdown] = useState(false);

  const handleDescriptorChange = (level: string, value: string) => {
    onUpdate(index, {
      descriptors: {
        ...item.descriptors,
        [level]: value,
      },
    });
  };

  const getCharCount = (text: string) => text.length;

  const selectedObjectives = learningObjectives.filter((lo) =>
    item.learning_objective_ids?.includes(lo.id)
  );

  const toggleObjective = (loId: number) => {
    const current = item.learning_objective_ids || [];
    const updated = current.includes(loId)
      ? current.filter((id) => id !== loId)
      : [...current, loId];
    onUpdate(index, { learning_objective_ids: updated });
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`px-4 py-3 space-y-3 ${
        isDragging ? "bg-sky-50 shadow-lg z-10" : "hover:bg-slate-50"
      }`}
      role="article"
      aria-label={`Criterium: ${item.name}`}
    >
      {/* Top Row: Drag Handle, Title, Learning Objectives Icon, Weight, Actions */}
      <div className="flex items-center gap-3">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-1"
          title="Sleep om te verplaatsen"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </button>
        <input
          type="text"
          className="flex-1 border rounded-lg px-3 py-2"
          value={item.name || ""}
          onChange={(e) => onUpdate(index, { name: e.target.value })}
          placeholder="Criterium naam"
          aria-label="Criterium naam"
        />
        
        {/* Learning Objectives Dropdown */}
        {learningObjectives.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowObjectiveDropdown(!showObjectiveDropdown)}
              className={`p-2 rounded-lg border hover:bg-gray-50 ${
                selectedObjectives.length > 0 ? "bg-blue-50 border-blue-300" : ""
              }`}
              title="Leerdoelen koppelen"
              aria-label="Leerdoelen koppelen"
            >
              🎯
              {selectedObjectives.length > 0 && (
                <span className="ml-1 text-xs font-medium text-blue-600">
                  {selectedObjectives.length}
                </span>
              )}
            </button>
            
            {showObjectiveDropdown && (
              <>
                {/* Backdrop to close dropdown */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowObjectiveDropdown(false)}
                />
                
                {/* Dropdown content */}
                <div className="absolute right-0 mt-2 w-80 bg-white border rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
                  <div className="p-3 border-b bg-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Leerdoelen selecteren</span>
                      <button
                        type="button"
                        onClick={() => setShowObjectiveDropdown(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="p-2">
                    {learningObjectives.map((lo) => {
                      const isSelected = item.learning_objective_ids?.includes(lo.id) ?? false;
                      return (
                        <label
                          key={lo.id}
                          className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleObjective(lo.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 text-sm">
                            <div className="font-medium">
                              {lo.domain}.{lo.order} - {lo.title}
                            </div>
                            {lo.description && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                {lo.description}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Weging:</span>
          <input
            type="number"
            step="0.1"
            min="0"
            className="w-20 border rounded-lg px-2 py-2"
            value={Number.isFinite(item.weight) ? item.weight : 0}
            onChange={(e) => {
              const value = e.target.valueAsNumber;
              onUpdate(index, { weight: Number.isNaN(value) ? 0 : value });
            }}
            aria-label="Weging"
          />
        </label>
        <div className="flex items-center gap-1">
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

      {/* Compact Learning Objectives Badges */}
      {selectedObjectives.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-8">
          {selectedObjectives.map((lo) => (
            <span
              key={lo.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium"
              title={`${lo.title}${lo.description ? ` - ${lo.description}` : ""}`}
            >
              {lo.domain}.{lo.order}
            </span>
          ))}
        </div>
      )}

      {/* Second Row: Level Descriptors */}
      <div className="grid grid-cols-5 gap-3">
        {(["level1", "level2", "level3", "level4", "level5"] as const).map(
          (level, idx) => {
            const text = String(item.descriptors?.[level] ?? "");
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
