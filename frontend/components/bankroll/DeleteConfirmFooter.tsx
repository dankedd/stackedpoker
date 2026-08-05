interface DeleteConfirmFooterProps {
  itemLabel: string;
  onConfirm: () => void;
}

/** The "Delete this X? [Yes, delete]" footer shown inline on a card mid-delete. Extracted since SessionRow and GoalCard had this block byte-for-byte identical. */
export function DeleteConfirmFooter({ itemLabel, onConfirm }: DeleteConfirmFooterProps) {
  return (
    <div className="border-t border-red-500/20 mt-3 pt-3">
      <p className="text-xs text-red-400 mb-2">Delete this {itemLabel}? This cannot be undone.</p>
      <button
        type="button"
        onClick={onConfirm}
        className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-all"
      >
        Yes, delete
      </button>
    </div>
  );
}
