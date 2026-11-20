import React, { useState } from 'react';
import { Search, UserPlus, Phone, MapPin, ChevronRight, Filter, ArrowDownLeft, ArrowUpRight, CheckCircle2 } from 'lucide-react';

export default function CustomerList({
  customers,
  onSelectCustomer,
  selectedCustomerId,
  onOpenNewCustomer,
  currency = 'Rs.'
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all', 'receivable', 'payable', 'settled'

  // Filter customers
  const filtered = customers.filter(c => {
    const matchSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm)) ||
      (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase()));

    const bal = Number(c.balance || 0);

    if (!matchSearch) return false;
    if (filterTab === 'receivable') return bal > 0;
    if (filterTab === 'payable') return bal < 0;
    if (filterTab === 'settled') return bal === 0;
    return true;
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header & Search */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Customers & Parties
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
              {filtered.length}
            </span>
          </div>
          <button
            onClick={onOpenNewCustomer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>New Party</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, phone or market..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filterTab === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All ({customers.length})
          </button>
          <button
            onClick={() => setFilterTab('receivable')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filterTab === 'receivable'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
          >
            Lene Hain ({customers.filter(c => (c.balance || 0) > 0).length})
          </button>
          <button
            onClick={() => setFilterTab('payable')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filterTab === 'payable'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            Dene Hain ({customers.filter(c => (c.balance || 0) < 0).length})
          </button>
          <button
            onClick={() => setFilterTab('settled')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filterTab === 'settled'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Settled ({customers.filter(c => (c.balance || 0) === 0).length})
          </button>
        </div>
      </div>

      {/* Customer List Container */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto max-h-[600px] flex-1">
        {filtered.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {searchTerm ? 'No parties match your search' : 'No customers yet'}
            </p>
            <button
              onClick={onOpenNewCustomer}
              className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline inline-flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add your first party now</span>
            </button>
          </div>
        ) : (
          filtered.map(customer => {
            const isSelected = selectedCustomerId === customer.id;
            const bal = Number(customer.balance || 0);

            return (
              <div
                key={customer.id}
                onClick={() => onSelectCustomer(customer)}
                className={`p-3.5 sm:p-4 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-l-4 border-emerald-600'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                {/* Left: Avatar + Details */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-slate-700">
                    {customer.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {customer.name}
                      </h3>
                      {customer.category && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-medium capitalize bg-slate-100 dark:bg-slate-800 text-slate-500">
                          {customer.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {customer.phone && (
                        <span className="flex items-center gap-1 truncate">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {customer.phone}
                        </span>
                      )}
                      {customer.lastTransactionAt && (
                        <span className="hidden sm:inline-block text-[11px] text-slate-400">
                          {new Date(customer.lastTransactionAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Balance & Arrow */}
                <div className="flex items-center gap-2 text-right flex-shrink-0">
                  <div>
                    <div
                      className={`text-sm font-bold font-mono tabular-nums ${
                        bal > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : bal < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {currency} {Math.abs(bal).toLocaleString()}
                    </div>
                    <span
                      className={`text-[10px] font-medium block ${
                        bal > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : bal < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {bal > 0 ? "You'll Get" : bal < 0 ? "You'll Give" : 'Settled'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
