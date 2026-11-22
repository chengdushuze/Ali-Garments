import React, { useState, useEffect } from 'react';
import { X, ArrowDownLeft, ArrowUpRight, Calendar, Clock, FileText, CreditCard } from 'lucide-react';

export default function TransactionModal({
  isOpen,
  onClose,
  customer,
  initialType = 'give', // 'give' (Debit) or 'get' (Credit)
  onSave,
  currency = 'Rs.'
}) {
  const [type, setType] = useState(initialType);
  const [amount, setAmount] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [description, setDescription] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setType(initialType);
    setAmount('');
    setDescription('');
    setBillNumber('');
    setNotes('');
    setPaymentMethod('Cash');

    // Default to current local date & time: YYYY-MM-DDTHH:mm
    const now = new Date();
    const pad = n => (n < 10 ? '0' + n : n);
    const localIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setDateTime(localIso);
  }, [isOpen, initialType]);

  if (!isOpen || !customer) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    onSave({
      customerId: customer.id,
      type,
      amount: numericAmount,
      dateTime: new Date(dateTime).toISOString(),
      description: description.trim() || (type === 'give' ? 'Garments Supplied' : 'Payment Received'),
      billNumber: billNumber.trim(),
      paymentMethod,
      notes: notes.trim()
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Record Transaction
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Party: <span className="font-semibold text-slate-800 dark:text-slate-200">{customer.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {/* Type Toggle: You Gave vs You Got */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => setType('give')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
                type === 'give'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">You Gave (ادھار دیا)</span>
            </button>

            <button
              type="button"
              onClick={() => setType('get')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
                type === 'get'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">You Got (وصولی ملی)</span>
            </button>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Amount ({currency})
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg font-bold text-slate-400">
                {currency}
              </span>
              <input
                type="number"
                step="any"
                required
                autoFocus
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className={`w-full pl-14 pr-4 py-3 rounded-2xl font-mono text-2xl font-black bg-slate-50 dark:bg-slate-800 border ${
                  type === 'give'
                    ? 'border-rose-300 dark:border-rose-900 text-rose-600 dark:text-rose-400 focus:ring-rose-500/20'
                    : 'border-emerald-300 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500/20'
                } focus:outline-none focus:ring-4 transition-all`}
              />
            </div>
          </div>

          {/* Date & Time Picker */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Date & Exact Time
            </label>
            <input
              type="datetime-local"
              required
              value={dateTime}
              onChange={e => setDateTime(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>

          {/* Description & Garments Details */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Item Details / Description
            </label>
            <input
              type="text"
              placeholder={type === 'give' ? 'e.g., 20 Suiting pieces, Cotton Rolls' : 'e.g., Weekly payment, Advance'}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-4 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Two-Column: Bill Number & Payment Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Bill / Gate Pass #
              </label>
              <input
                type="text"
                placeholder="Optional #1024"
                value={billNumber}
                onChange={e => setBillNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Payment Mode
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Cash">Cash (نقد)</option>
                <option value="Bank">Bank Transfer</option>
                <option value="JazzCash">JazzCash</option>
                <option value="EasyPaisa">EasyPaisa</option>
                <option value="Cheque">Cheque</option>
                <option value="Slip">Slip / Challan</option>
              </select>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className={`w-full py-3.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all active:scale-98 whitespace-nowrap cursor-pointer ${
                type === 'give'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              }`}
            >
              <span className="whitespace-nowrap">Save Entry & Sync ({type === 'give' ? 'ادھار دیا' : 'وصولی محفوظ'})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
