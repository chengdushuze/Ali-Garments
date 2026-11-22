import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, AlertCircle, FileText, Loader2 } from 'lucide-react';

export default function UserItemsManager({ currentUser }) {
  const [items, setItems] = useState([]);
  const [newContent, setNewContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/data');
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.items) {
        setItems(data.items);
      }
    } catch (err) {
      console.error('Fetch items error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    setIsAdding(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setMessage({
          type: 'error',
          text: data.error || 'Something went wrong. Please try again.',
        });
        setIsAdding(false);
        return;
      }

      setNewContent('');
      fetchItems();
      setMessage({ type: 'success', text: 'Item saved securely to your private workspace.' });
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    } catch (err) {
      console.error('Add item error:', err);
      setMessage({ type: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteItem = async (id) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/data?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setItems(prev => prev.filter(item => item.id !== id));
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Something went wrong. Please try again.',
        });
      }
    } catch (err) {
      console.error('Delete item error:', err);
      setMessage({ type: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              My Private Items & Memos
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              User-isolated D1 data (WHERE user_id = #{currentUser?.id})
            </p>
          </div>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {message.text && (
        <div
          className={`mb-4 p-3 rounded-xl text-xs sm:text-sm flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Add Item Input Form */}
      <form onSubmit={handleAddItem} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Add private note, fabric reminder, or batch number..."
          className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="submit"
          disabled={isAdding || !newContent.trim()}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white font-medium rounded-xl text-sm shadow-sm transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
        >
          {isAdding ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : (
            <Plus className="w-4 h-4 shrink-0" />
          )}
          <span className="hidden sm:inline whitespace-nowrap">Add Item</span>
        </button>
      </form>

      {/* Items List */}
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="p-4 text-center text-xs text-slate-400">Loading your items...</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            No private items yet. Add your first note or memo above.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
            >
              <div className="min-w-0 pr-3">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 break-words">
                  {item.content}
                </p>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                  {new Date(item.created_at).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => handleDeleteItem(item.id)}
                disabled={deletingId === item.id}
                title="Delete Item"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              >
                {deletingId === item.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
