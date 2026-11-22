import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Phone, MapPin, ChevronRight, X, ArrowDownLeft, ArrowUpRight, Edit3, ChevronDown, Filter } from 'lucide-react';

export default function CustomerList({
  customers,
  onSelectCustomer,
  selectedCustomerId,
  onOpenNewCustomer,
  onOpenEditCustomer,
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

  // Filter customers safely
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const searchLower = String(searchTerm || '').toLowerCase();

  const filtered = safeCustomers.filter(c => {
    if (!c) return false;
    const nameStr = String(c.name || '').toLowerCase();
    const phoneStr = String(c.phone || '');
    const addressStr = String(c.address || '').toLowerCase();

    const matchSearch =
      !searchLower ||
      nameStr.includes(searchLower) ||
      phoneStr.includes(searchLower) ||
      addressStr.includes(searchLower);

    const bal = Number(c.balance || 0);

    if (!matchSearch) return false;
    if (filterTab === 'receivable') return bal > 0;
    if (filterTab === 'payable') return bal < 0;
    if (filterTab === 'settled') return bal === 0;
    return true;
  });

  const receivableCount = safeCustomers.filter(c => c && (Number(c.balance) || 0) > 0).length;
  const payableCount = safeCustomers.filter(c => c && (Number(c.balance) || 0) < 0).length;
  const settledCount = safeCustomers.filter(c => c && (Number(c.balance) || 0) === 0).length;

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

        {/* Mobile Filter Dropdown Picker (sm:hidden) - Zero Side-Scrolling! */}
        <div className="block sm:hidden py-0.5">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 dark:text-slate-400">
              <Filter className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <select
              value={filterTab}
              onChange={e => setFilterTab(e.target.value)}
              className="w-full appearance-none pl-9 pr-9 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
            >
              <option value="all">📋 All Parties & Customers ({customers.length})</option>
              <option value="receivable">🟢 Lene Hain • You'll Receive ({receivableCount})</option>
              <option value="payable">🔴 Dene Hain • You'll Give ({payableCount})</option>
              <option value="settled">⚪ Settled • Zero Balance ({settledCount})</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Desktop / Tablet Segmented Buttons (hidden sm:flex) */}
        <div className="hidden sm:flex items-center gap-1.5 py-0.5 text-xs">
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
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">Add Party Now</span>
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
                className={`p-3 sm:p-3.5 cursor-pointer transition-all flex items-center justify-between gap-3 active:scale-[0.99] border-b border-slate-100 dark:border-slate-800/60 ${
                  isSelected
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-l-4 border-emerald-600'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                {/* Left: Avatar + Full Name + Type */}
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div
                    className={`w-10 h-10 rounded-xl font-black text-xs flex items-center justify-center shrink-0 border shadow-xs ${avatarStyle}`}
                  >
                    {customer.name ? customer.name.slice(0, 2).toUpperCase() : 'AG'}
                  </div>

                  <div className="min-w-0 flex-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white break-words leading-tight">
                      {customer.name}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold capitalize bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0 whitespace-nowrap">
                      {customer.category || 'Wholesale'}
                    </span>
                  </div>
                </div>

                {/* Right: Balance (Rs Amount Only) */}
                <div className="text-right shrink-0 pl-2">
                  <div
                    className={`text-sm sm:text-base font-extrabold font-mono tabular-nums whitespace-nowrap leading-none ${
                      bal > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : bal < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {currency}&nbsp;{Math.abs(bal).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
