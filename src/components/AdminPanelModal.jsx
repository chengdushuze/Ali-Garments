import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Shield,
  Users,
  CheckCircle2,
  AlertCircle,
  Lock,
  Trash2,
  Database,
  RefreshCw,
  Clock,
  HardDriveDownload,
  Loader2
} from 'lucide-react';

export default function AdminPanelModal({ isOpen, onClose, currentUser }) {
  const [usersList, setUsersList] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  // Nightly Backup state
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupStatus, setBackupStatus] = useState(null);

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
      setBackupStatus(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  // 1. Create User Handler
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

  // 2. Remove / Delete User Handler
  const handleDeleteUser = async (user) => {
    if (user.id === currentUser?.id) {
      alert('You cannot remove your own active administrator account.');
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to permanently remove user "${user.name}" (${user.email})?`
    );
    if (!confirmDelete) return;

    setDeletingUserId(user.id);
    setStatusMessage({ type: '', text: '' });

    try {
      const res = await fetch(`/api/admin/users?id=${user.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to remove user account.',
        });
        setDeletingUserId(null);
        return;
      }

      setUsersList((prev) => prev.filter((u) => u.id !== user.id));
      setStatusMessage({
        type: 'success',
        text: `User account "${user.name}" was successfully removed.`,
      });
    } catch (err) {
      console.error('Delete user error:', err);
      setStatusMessage({
        type: 'error',
        text: 'Failed to connect. Please try again.',
      });
    } finally {
      setDeletingUserId(null);
    }
  };

  // 3. Trigger Nightly Backup to ali-graments-backup D1
  const handleTriggerBackup = async () => {
    setIsBackingUp(true);
    setBackupStatus(null);

    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setBackupStatus({
          type: 'error',
          text: data.error || 'Backup operation failed.',
        });
      } else {
        setBackupStatus({
          type: 'success',
          text: data.message || 'Nightly backup successfully completed!',
          stats: data.stats,
        });
      }
    } catch (err) {
      console.error('Backup error:', err);
      setBackupStatus({
        type: 'error',
        text: 'Failed to initiate backup. Check your network or D1 binding.',
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Admin Management Portal</h3>
              <p className="text-xs text-slate-400">
                User Creation & Removal • Daily Nightly D1 Backup
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* Status Alert */}
          {statusMessage.text && (
            <div
              className={`p-3.5 rounded-2xl text-xs sm:text-sm flex items-start gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/70 border border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/70 border border-rose-800 text-rose-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
              )}
              <span className="font-medium">{statusMessage.text}</span>
            </div>
          )}

          {/* Section A: Daily Nightly Cloudflare D1 Backup Card */}
          <div className="bg-slate-950/70 border border-emerald-500/30 rounded-2xl p-5 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <span>Daily Nightly D1 Backup</span>
                    <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-emerald-950 text-emerald-400 border border-emerald-700 rounded-full">
                      Automated Cron
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Target: ali-graments-backup (087a12df-88ef-4633-b81f-af6bad7a2098)
                  </p>
                </div>
              </div>

              <button
                onClick={handleTriggerBackup}
                disabled={isBackingUp}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 disabled:opacity-50 text-white font-medium rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                {isBackingUp ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Backing Up...</span>
                  </>
                ) : (
                  <>
                    <HardDriveDownload className="w-3.5 h-3.5" />
                    <span>Run Backup Now</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 font-mono">
              <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Schedule: Every day night at 20:00 UTC (1:00 AM Pakistan PKT)</span>
            </div>

            {backupStatus && (
              <div
                className={`mt-3 p-3 rounded-xl text-xs flex items-start gap-2 ${
                  backupStatus.type === 'success'
                    ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/80 border border-rose-800 text-rose-300'
                }`}
              >
                {backupStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{backupStatus.text}</p>
                  {backupStatus.stats && (
                    <p className="text-[10px] text-emerald-400 font-mono mt-0.5">
                      Backed up: {backupStatus.stats.backedUpCustomers} Customers •{' '}
                      {backupStatus.stats.backedUpChunks} Chunks •{' '}
                      {backupStatus.stats.backedUpUsers} Users
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section B: Create User Form */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4 text-emerald-400 font-semibold text-sm">
              <UserPlus className="w-4 h-4" />
              <span>Create New User Account</span>
            </div>

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
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
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

          {/* Section C: Existing User Accounts (with Remove/Delete Action) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Existing User Accounts ({usersList.length})</span>
              </div>
              <button
                onClick={fetchUsers}
                disabled={isLoadingUsers}
                className="text-xs text-emerald-400 hover:underline cursor-pointer"
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
                  usersList.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    const isDeleting = deletingUserId === u.id;

                    return (
                      <div
                        key={u.id}
                        className="p-3 sm:p-4 flex items-center justify-between hover:bg-slate-900/60 transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-white truncate">
                              {u.name}
                            </span>
                            {isSelf && (
                              <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-md">
                                You
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-full border ${
                                u.role === 'admin'
                                  ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {u.role}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 truncate mt-0.5">{u.email}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                            #{u.id}
                          </span>

                          {/* Remove User Button */}
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={isSelf || isDeleting}
                            title={
                              isSelf
                                ? 'You cannot remove your own active account'
                                : `Remove ${u.name}`
                            }
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent transition-colors cursor-pointer"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
