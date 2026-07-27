'use client'

import type { ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToParentElement, restrictToVerticalAxis, restrictToHorizontalAxis } from '@dnd-kit/modifiers'

type UseSortableResult = ReturnType<typeof useSortable>

export interface SortableRowRenderProps {
  isDragging: boolean
  attributes: UseSortableResult['attributes']
  listeners: UseSortableResult['listeners']
}

interface SortableRankingListProps {
  /** Item ids in current order, strongest/first-priority first. */
  ids: string[]
  onReorder: (nextIds: string[]) => void
  disabled?: boolean
  ariaLabel?: string
  className?: string
  renderItem: (id: string, index: number, drag: SortableRowRenderProps) => ReactNode
  /**
   * Stable id passed through to DndContext. dnd-kit auto-generates internal
   * ids (used for aria-describedby) from a render-order counter, which can
   * differ between the server and client render pass under SSR and trip a
   * hydration mismatch — pass something stable (e.g. derived from the
   * exercise's step id) to avoid that.
   */
  id?: string
  /** 'vertical' (default) = the original reorder-a-list UX. 'horizontal' = a
   *  left-to-right spectrum (e.g. Module 8's board-sorting puzzle) — same
   *  interaction, restricted to the horizontal axis instead. `className` applies
   *  to the wrapping <ol> either way (e.g. pass `flex gap-2` for horizontal). */
  axis?: 'vertical' | 'horizontal'
}

/**
 * Reusable vertical drag-to-reorder list built on dnd-kit: pointer, touch,
 * and keyboard sensors, window autoscroll near the viewport edges, and
 * automatic reflow of surrounding rows as one is dragged. Visual styling is
 * fully owned by `renderItem` (via the `isDragging` flag) — this component
 * only wires up the interaction — so it can be reused for other "arrange
 * into an order" exercises (board rankings, priority ordering, action
 * ordering, strongest-to-weakest comparisons, range/category grouping, etc.)
 * without re-deriving drag logic each time.
 */
export function SortableRankingList({
  ids,
  onReorder,
  disabled = false,
  ariaLabel,
  className,
  renderItem,
  id,
  axis = 'vertical',
}: SortableRankingListProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    if (disabled) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(ids, oldIndex, newIndex))
  }

  const isHorizontal = axis === 'horizontal'

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[isHorizontal ? restrictToHorizontalAxis : restrictToVerticalAxis, restrictToParentElement]}
    >
      <SortableContext items={ids} strategy={isHorizontal ? horizontalListSortingStrategy : verticalListSortingStrategy}>
        <ol aria-label={ariaLabel} className={className}>
          {ids.map((id, index) => (
            <SortableRow key={id} id={id} index={index} disabled={disabled} renderItem={renderItem} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({
  id,
  index,
  disabled,
  renderItem,
}: {
  id: string
  index: number
  disabled: boolean
  renderItem: SortableRankingListProps['renderItem']
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: 'none' as const,
  }

  return (
    <li ref={setNodeRef} style={style} className={isDragging ? 'relative z-10' : 'relative'}>
      {renderItem(id, index, { isDragging, attributes, listeners })}
    </li>
  )
}
