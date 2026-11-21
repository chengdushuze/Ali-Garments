import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Phone, MapPin, ChevronRight, X, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export default function CustomerList({
  customers,
  onSelectCustomer,
  selectedCustomerId,
  onOpenNewCustomer,
  currency = 'Rs.',
  filterTabProp = null
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all', 'receivable', 'payable', 'settled'

  // Sync if parent updates filterTab
  useEffect(() => {
    if (filterTabProp) {
      setFilterTab(filterTabProp);
    }
  }, [filterTabProp]);

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

  const receivableCount = customers.filter(c => (c.balance || 0) > 0).length;
  const payableCount = customers.filter(c => (c.balance || 0) < 0).length;
  const settledCount = customers.filter(c => (c.balance || 0) === 0).length;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden flex flex-col h-full transition-all">
      {/* Header & Search */}
      <div className="p-3.5 sm:p-4 border-b border-slate-200/80 dark:border-slate-800/80 space-y-3 bg-slate-50/50 dark:bg-slate-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Customers & Parties
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono font-bold">
              {filtered.length}
            </span>
          </div>

          <button
            onClick={onOpenNewCustomer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-sm shadow-emerald-600/20 transition-all cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>New Party</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search party by name, phone or market..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 rounded-2xl text-xs sm:text-sm bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all shadow-inner"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Tabs (Segmented Control) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              filterTab === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All ({customers.length})
          </button>
          <button
            onClick={() => setFilterTab('receivable')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              filterTab === 'receivable'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
          >
            Lene Hain ({receivableCount})
          </button>
          <button
            onClick={() => setFilterTab('payable')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              filterTab === 'payable'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            Dene Hain ({payableCount})
          </button>
          <button
            onClick={() => setFilterTab('settled')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              filterTab === 'settled'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Settled ({settledCount})
          </button>
        </div>
      </div>

      {/* Customer List Container */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/80 overflow-y-auto flex-1">
        {filtered.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center font-bold text-lg">
              ?
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {searchTerm ? 'No parties match your search' : 'No party accounts found'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {searchTerm ? 'Try checking for typos or searching by phone' : 'Get started by adding your first customer or supplier.'}
              </p>
            </div>
            <button
              onClick={onOpenNewCustomer}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Party Now</span>
            </button>
          </div>
        ) : (
          filtered.map(customer => {
            const isSelected = selectedCustomerId === customer.id;
            const bal = Number(customer.balance || 0);

            // Dynamic avatar tint based on balance
            const avatarStyle =
              bal > 0
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/80'
                : bal < 0
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/80'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';

            return (
              <div
                key={customer.id}
                onClick={() => onSelectCustomer(customer)}
                className={`p-3.5 sm:p-4 cursor-pointer transition-all flex items-center justify-between gap-3 active:scale-[0.99] ${
                  isSelected
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-l-4 border-emerald-600'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                {/* Left: Avatar + Details */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-2xl font-black text-xs flex items-center justify-center shrink-0 border shadow-xs ${avatarStyle}`}
                  >
                    {customer.name ? customer.name.slice(0, 2).toUpperCase() : 'AG'}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {customer.name}
                      </h3>
                      {customer.category && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md font-semibold capitalize bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                          {customer.category}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {customer.phone && (
                        <a
                          href={`tel:${customer.phone}`}
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 truncate hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                          title="Call Party"
                        >
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-mono text-[11px]">{customer.phone}</span>
                        </a>
                      )}
                      {customer.lastTransactionAt && (
                        <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                          {new Date(customer.lastTransactionAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Balance & Chevron */}
                <div className="flex items-center gap-2 text-right shrink-0">
                  <div>
                    <div
                      className={`text-sm sm:text-base font-extrabold font-mono tabular-nums whitespace-nowrap leading-tight ${
                        bal > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : bal < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-500'
                      }`}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {currency}&nbsp;{Math.abs(bal).toLocaleString()}
                    </div>
                    <span
                      className={`text-[10px] font-bold block mt-0.5 ${
                        bal > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : bal < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {bal > 0 ? "You'll Receive" : bal < 0 ? "You'll Give" : 'Settled (Nil)'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
