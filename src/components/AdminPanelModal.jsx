import React, { useState, useEffect } from 'react';
import { X, UserPlus, Shield, Users, CheckCircle2, AlertCircle, Key, Lock, Terminal } from 'lucide-react';

export default function AdminPanelModal({ isOpen, onClose, currentUser }) {
  const [usersList, setUsersList] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  // Fetch users when modal opens
  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok && data.users) {
        setUsersList(data.users);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentUser?.role === 'admin') {
      fetchUsers();
      setStatusMessage({ type: '', text: '' });
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setStatusMessage({ type: '', text: '' });

    if (!name.trim() || !email.trim() || !password) {
      setStatusMessage({ type: 'error', text: 'All fields are required.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to create user. Please try again.',
        });
        setIsSubmitting(false);
        return;
      }

      setStatusMessage({
        type: 'success',
        text: `User account "${data.user?.name || name}" successfully created!`,
      });

      setName('');
      setEmail('');
      setPassword('');
      setRole('user');
      fetchUsers();
    } catch (err) {
      console.error('Create user error:', err);
      setStatusMessage({
        type: 'error',
        text: 'Network error occurred. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Admin User Management</h3>
              <p className="text-xs text-slate-400">
                Closed Multi-User Administration • Cloudflare D1 Native
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* Security Notice: User table is protected and can only be edited in D1 dashboard */}
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-600/30 text-amber-200 text-xs sm:text-sm flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-amber-300">
                D1 Dashboard-Only Edit Enforcement
              </span>
              <span>
                To prevent privilege escalation and unauthorized changes from the web interface,
                the <code className="bg-amber-900/50 px-1 py-0.5 rounded font-mono">users</code> table can only be edited/updated directly in your <strong>Cloudflare D1 Dashboard Console</strong>. No update or edit route exists in the application API.
              </span>
            </div>
          </div>

          {/* Create User Section */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4 text-emerald-400 font-semibold text-sm">
              <UserPlus className="w-4 h-4" />
              <span>Create New User Account</span>
            </div>

            {statusMessage.text && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs sm:text-sm flex items-center gap-2 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-950/70 border border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/70 border border-rose-800 text-rose-300'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Tariq Mehmood"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tariq@aligarments.com"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    User Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="user">User (Standard Access)</option>
                    <option value="admin">Admin (Full Privilege)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 text-white font-medium rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Creating Encrypted Account...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create User</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Existing Users Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Existing User Accounts ({usersList.length})</span>
              </div>
              <button
                onClick={fetchUsers}
                disabled={isLoadingUsers}
                className="text-xs text-emerald-400 hover:underline"
              >
                {isLoadingUsers ? 'Refreshing...' : 'Refresh List'}
              </button>
            </div>

            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="divide-y divide-slate-800">
                {usersList.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    {isLoadingUsers ? 'Loading accounts...' : 'No users found.'}
                  </div>
                ) : (
                  usersList.map((u) => (
                    <div
                      key={u.id}
                      className="p-3 sm:p-4 flex items-center justify-between hover:bg-slate-900/60 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white truncate">
                            {u.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-full border ${
                              u.role === 'admin'
                                ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                                : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                            }`}
                          >
                            {u.role}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{u.email}</p>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono shrink-0">
                        ID: #{u.id}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
