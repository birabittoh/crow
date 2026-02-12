import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { MediaAsset } from '../api';
import { getMediaUrl } from '../api';

interface SortableMediaGridProps {
  items: MediaAsset[];
  onReorder: (items: MediaAsset[]) => void;
  onRemove: (index: number) => void;
  showSize?: boolean;
}

interface SortableMediaItemProps {
  item: MediaAsset;
  index: number;
  onRemove: (index: number) => void;
  showSize?: boolean;
}

function SortableMediaItem({ item, index, onRemove, showSize }: SortableMediaItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`media-preview-item sortable-media-item ${isDragging ? 'dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      {item.type === 'image' ? (
        <img src={getMediaUrl(item)} alt="" className="media-preview-img" />
      ) : (
        <div className="media-preview-video">
          <span className="media-preview-video-icon">&#9654;</span>
          <span className="media-preview-filename">{item.original_filename || 'video'}</span>
        </div>
      )}
      <button
        type="button"
        className="media-remove-btn"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        &times;
      </button>
      {showSize && (
        <span className="media-preview-size">
          {(item.size_bytes / 1024).toFixed(0)} KB
        </span>
      )}
    </div>
  );
}

function MediaOverlayItem({ item, showSize }: { item: MediaAsset; showSize?: boolean }) {
  return (
    <div className="media-preview-item drag-overlay">
      {item.type === 'image' ? (
        <img src={getMediaUrl(item)} alt="" className="media-preview-img" />
      ) : (
        <div className="media-preview-video">
          <span className="media-preview-video-icon">&#9654;</span>
          <span className="media-preview-filename">{item.original_filename || 'video'}</span>
        </div>
      )}
      {showSize && (
        <span className="media-preview-size">
          {(item.size_bytes / 1024).toFixed(0)} KB
        </span>
      )}
    </div>
  );
}

export default function SortableMediaGrid({ items, onReorder, onRemove, showSize }: SortableMediaGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 150, tolerance: 5 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((m) => m.id === active.id);
      const newIndex = items.findIndex((m) => m.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(arrayMove(items, oldIndex, newIndex));
      }
    }
  };

  const activeItem = activeId ? items.find((m) => m.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((m) => m.id)} strategy={rectSortingStrategy}>
        <div className="media-preview-grid">
          {items.map((m, i) => (
            <SortableMediaItem
              key={m.id}
              item={m}
              index={i}
              onRemove={onRemove}
              showSize={showSize}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeItem ? <MediaOverlayItem item={activeItem} showSize={showSize} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
