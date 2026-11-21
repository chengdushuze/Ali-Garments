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
  Loader2,
  Key,
  Eye,
  EyeOff,
  UserX,
  UserCheck,
  ShieldAlert,
  ClipboardList,
  Search,
  Activity,
  History
} from 'lucide-react';

export default function AdminPanelModal({ isOpen, onClose, currentUser }) {
  const [adminTab, setAdminTab] = useState('users'); // 'users', 'audit', 'backup'
  const [usersList, setUsersList] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  // Password reset state for a specific user (or admin) with consent verification
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const [adminVerificationPassword, setAdminVerificationPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Suspend/Reactivate user state with admin consent verification
  const [suspendingUser, setSuspendingUser] = useState(null);
  const [suspendAdminPassword, setSuspendAdminPassword] = useState('');
  const [showSuspendAdminPassword, setShowSuspendAdminPassword] = useState(false);
  const [isTogglingSuspend, setIsTogglingSuspend] = useState(false);
  const [suspendError, setSuspendError] = useState('');

  // Audit Log State
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');

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

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    setIsLoadingAudit(true);
    try {
      const res = await fetch('/api/admin/audit');
      const data = await res.json();
      if (res.ok && data.logs) {
        setAuditLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentUser?.role === 'admin') {
      fetchUsers();
      setStatusMessage({ type: '', text: '' });
      setBackupStatus(null);
    }
  }, [isOpen, currentUser]);

  // Strict Security Guard: Only users with role === 'admin' can render the Admin Panel
  if (!isOpen || currentUser?.role !== 'admin') return null;

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

  // 3. Change User or Admin Password Handler with Admin Password Consent Verification
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (!passwordResetUser) return;

    if (!adminVerificationPassword) {
      setPasswordError('You must enter your current admin password to verify consent.');
      return;
    }

    if (!newPassword) {
      setPasswordError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match. Please re-enter.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: passwordResetUser.id,
          newPassword,
          adminPassword: adminVerificationPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setPasswordError(data.error || 'Failed to update password.');
        setIsUpdatingPassword(false);
        return;
      }

      const isSelf = passwordResetUser.id === currentUser?.id;
      setStatusMessage({
        type: 'success',
        text: isSelf
          ? 'Your administrator password has been updated successfully! Please remember it for future logins.'
          : `Password for "${passwordResetUser.name}" (${passwordResetUser.email}) was successfully changed!`,
      });

      setPasswordResetUser(null);
      setNewPassword('');
      setConfirmNewPassword('');
      setAdminVerificationPassword('');
    } catch (err) {
      console.error('Change password error:', err);
      setPasswordError('Failed to connect to server. Please try again.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // 4. Suspend or Reactivate User Handler with Admin Password Consent Verification
  const handleToggleSuspend = async (e) => {
    e.preventDefault();
    setSuspendError('');

    if (!suspendingUser) return;
    if (!suspendAdminPassword) {
      setSuspendError('You must enter your current admin password to verify consent.');
      return;
    }

    const targetStatus = suspendingUser.status === 'suspended' ? 'active' : 'suspended';
    setIsTogglingSuspend(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: suspendingUser.id,
          status: targetStatus,
          adminPassword: suspendAdminPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setSuspendError(data.error || 'Failed to update user status.');
        setIsTogglingSuspend(false);
        return;
      }

      setStatusMessage({
        type: 'success',
        text: targetStatus === 'suspended'
          ? `User "${suspendingUser.name}" (${suspendingUser.email}) has been temporarily suspended.`
          : `User "${suspendingUser.name}" (${suspendingUser.email}) has been successfully reactivated!`,
      });

      setSuspendingUser(null);
      setSuspendAdminPassword('');
      fetchUsers();
    } catch (err) {
      console.error('Toggle suspend error:', err);
      setSuspendError('Failed to connect to server. Please try again.');
    } finally {
      setIsTogglingSuspend(false);
    }
  };

  // 5. Trigger Nightly Backup to ali-graments-backup D1
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

  // Filter audit logs
  const filteredAuditLogs = auditLogs.filter(log => {
    if (!auditSearch.trim()) return true;
    const q = auditSearch.toLowerCase();
    return (
      (log.action && log.action.toLowerCase().includes(q)) ||
      (log.user_email && log.user_email.toLowerCase().includes(q)) ||
      (log.details && log.details.toLowerCase().includes(q)) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white">Admin Management Portal</h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                User Access & Security • Activity Audit • Cloud Backup
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-4 sm:px-5 pt-2 border-b border-slate-800 bg-slate-950/40 text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setAdminTab('users')}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 font-semibold rounded-t-xl transition-all whitespace-nowrap border-b-2 cursor-pointer ${
              adminTab === 'users'
                ? 'border-emerald-500 text-white bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">User Accounts</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAdminTab('audit');
              fetchAuditLogs();
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 font-semibold rounded-t-xl transition-all whitespace-nowrap border-b-2 cursor-pointer ${
              adminTab === 'audit'
                ? 'border-emerald-500 text-white bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
            <span className="whitespace-nowrap">Audit Trail</span>
          </button>

          <button
            type="button"
            onClick={() => setAdminTab('backup')}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 font-semibold rounded-t-xl transition-all whitespace-nowrap border-b-2 cursor-pointer ${
              adminTab === 'backup'
                ? 'border-emerald-500 text-white bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">D1 Backup</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
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

          {/* TAB 1: USER ACCOUNTS & MANAGEMENT */}
          {adminTab === 'users' && (
            <div className="space-y-6">
              {/* Section B: Create User Form */}
              <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-4 text-emerald-400 font-semibold text-sm">
                  <UserPlus className="w-4 h-4" />
                  <span className="whitespace-nowrap">Create New User Account</span>
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
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 text-white font-medium rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span className="whitespace-nowrap">Creating Encrypted Account...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span className="whitespace-nowrap">Create User</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Section C: Existing User Accounts */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span className="whitespace-nowrap">Existing User Accounts ({usersList.length})</span>
                  </div>
                  <button
                    onClick={fetchUsers}
                    disabled={isLoadingUsers}
                    className="text-xs text-emerald-400 hover:underline cursor-pointer whitespace-nowrap flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                    <span>{isLoadingUsers ? 'Refreshing...' : 'Refresh List'}</span>
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
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-full border ${
                                    u.status === 'suspended'
                                      ? 'bg-rose-950/90 text-rose-300 border-rose-850/80'
                                      : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                                  }`}
                                >
                                  {u.status === 'suspended' ? 'Suspended' : 'Active'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 truncate mt-0.5">{u.email}</p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[11px] text-slate-500 font-mono hidden sm:inline mr-1">
                                #{u.id}
                              </span>

                              {/* Temporary Suspend / Reactivate User Button */}
                              {!isSelf && (
                                <button
                                  onClick={() => {
                                    setSuspendingUser(u);
                                    setSuspendAdminPassword('');
                                    setSuspendError('');
                                    setShowSuspendAdminPassword(false);
                                  }}
                                  title={
                                    u.status === 'suspended'
                                      ? `Reactivate account for ${u.name}`
                                      : `Temporarily suspend account for ${u.name}`
                                  }
                                  className={`p-2 rounded-xl transition-colors cursor-pointer ${
                                    u.status === 'suspended'
                                      ? 'text-emerald-400 bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-800/50'
                                      : 'text-amber-400 hover:text-rose-400 hover:bg-rose-950/40'
                                  }`}
                                >
                                  {u.status === 'suspended' ? (
                                    <UserCheck className="w-4 h-4" />
                                  ) : (
                                    <UserX className="w-4 h-4" />
                                  )}
                                </button>
                              )}

                              {/* Change Password Button */}
                              <button
                                onClick={() => {
                                  setPasswordResetUser(u);
                                  setAdminVerificationPassword('');
                                  setNewPassword('');
                                  setConfirmNewPassword('');
                                  setPasswordError('');
                                  setShowAdminPassword(false);
                                  setShowNewPassword(false);
                                }}
                                title={
                                  isSelf
                                    ? 'Change Your Admin Password'
                                    : `Change Password for ${u.name}`
                                }
                                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                                  isSelf
                                    ? 'text-amber-400 bg-amber-950/30 hover:bg-amber-950/60'
                                    : 'text-slate-400 hover:text-amber-400 hover:bg-amber-950/40'
                                }`}
                              >
                                <Key className="w-4 h-4" />
                              </button>

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
          )}

          {/* TAB 2: AUDIT TRAIL */}
          {adminTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Security & Activity Audit Trail</h4>
                    <p className="text-[11px] text-slate-400">Tracks logins, password changes, account suspensions, and backups</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fetchAuditLogs}
                  disabled={isLoadingAudit}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-emerald-400 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAudit ? 'animate-spin' : ''}`} />
                  <span className="whitespace-nowrap">Refresh Logs</span>
                </button>
              </div>

              {/* Search Filter */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by user email, action (LOGIN, SUSPEND, etc.), or details..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Audit Table */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 sticky top-0 z-10">
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Timestamp</th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Action</th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">User</th>
                        <th className="py-2.5 px-3 font-semibold">Event Details</th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">IP Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {filteredAuditLogs.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-8 text-center text-slate-500 text-xs">
                            {isLoadingAudit ? 'Loading audit trail records...' : 'No activity logs found.'}
                          </td>
                        </tr>
                      ) : (
                        filteredAuditLogs.map((log) => {
                          const actionClass =
                            log.action.includes('SUSPEND') ? 'bg-rose-950 text-rose-300 border-rose-800' :
                            log.action.includes('REACTIVATE') ? 'bg-emerald-950 text-emerald-300 border-emerald-800' :
                            log.action.includes('PASSWORD') ? 'bg-amber-950 text-amber-300 border-amber-800' :
                            log.action.includes('LOGIN') ? 'bg-blue-950 text-blue-300 border-blue-800' :
                            log.action.includes('BACKUP') ? 'bg-teal-950 text-teal-300 border-teal-800' :
                            'bg-slate-800 text-slate-300 border-slate-700';

                          return (
                            <tr key={log.id} className="hover:bg-slate-900/50">
                              <td className="py-2 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                                {log.created_at ? new Date(log.created_at).toLocaleString() : 'Recent'}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${actionClass}`}>
                                  {log.action}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                                {log.user_email || `User #${log.user_id}`}
                              </td>
                              <td className="py-2 px-3 text-slate-300 font-medium">
                                {log.details}
                              </td>
                              <td className="py-2 px-3 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                                {log.ip_address || 'client'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CLOUDFLARE D1 BACKUP */}
          {adminTab === 'backup' && (
            <div className="bg-slate-950/70 border border-emerald-500/30 rounded-2xl p-5 shadow-inner">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white flex items-center gap-2">
                      <span className="whitespace-nowrap">Daily Nightly D1 Backup</span>
                      <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-emerald-950 text-emerald-400 border border-emerald-700 rounded-full">
                        Automated Cron
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Target: Cloud Backup (ali-garments-backup)
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleTriggerBackup}
                  disabled={isBackingUp}
                  className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 disabled:opacity-50 text-white font-medium rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  {isBackingUp ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span className="whitespace-nowrap">Backing Up...</span>
                    </>
                  ) : (
                    <>
                      <HardDriveDownload className="w-3.5 h-3.5" />
                      <span className="whitespace-nowrap">Run Backup Now</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 font-mono">
                <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Schedule: Daily at 20:00 UTC (1:00 AM Pakistan PKT)</span>
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
          )}
        </div>

        {/* Change Password Dialog Overlay with Admin Consent Verification */}
        {passwordResetUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">
                      {passwordResetUser.id === currentUser?.id
                        ? 'Change Your Admin Password'
                        : `Change Password for ${passwordResetUser.name}`}
                    </h4>
                    <p className="text-xs text-slate-400 font-mono truncate max-w-[260px]">
                      {passwordResetUser.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setPasswordResetUser(null);
                    setAdminVerificationPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                    setPasswordError('');
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Security Notice */}
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs flex items-start gap-2">
                <Shield className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span className="leading-relaxed">
                  Security Check: To prevent unauthorized tampering, you must enter your current administrator password to authorize this password change.
                </span>
              </div>

              {passwordError && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{passwordError}</span>
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-3.5">
                {/* 1. Admin Verification Password */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1">
                    Your Current Admin Password (Required)
                  </label>
                  <div className="relative">
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      required
                      autoFocus
                      value={adminVerificationPassword}
                      onChange={(e) => setAdminVerificationPassword(e.target.value)}
                      placeholder="Enter your active admin password"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-amber-500/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 2. New Password */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    New Password (min 6 characters)
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 3. Confirm New Password */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordResetUser(null);
                      setAdminVerificationPassword('');
                      setNewPassword('');
                      setConfirmNewPassword('');
                      setPasswordError('');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:scale-95 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isUpdatingPassword ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying & Updating...</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-3.5 h-3.5" />
                        <span>Confirm & Change Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Suspend / Reactivate Confirmation Dialog with Admin Consent */}
        {suspendingUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2.5 rounded-xl border ${
                    suspendingUser.status === 'suspended'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>
                    {suspendingUser.status === 'suspended' ? (
                      <UserCheck className="w-5 h-5" />
                    ) : (
                      <ShieldAlert className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">
                      {suspendingUser.status === 'suspended'
                        ? `Reactivate ${suspendingUser.name}`
                        : `Suspend ${suspendingUser.name}`}
                    </h4>
                    <p className="text-xs text-slate-400">{suspendingUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSuspendingUser(null);
                    setSuspendAdminPassword('');
                    setSuspendError('');
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {suspendError && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{suspendError}</span>
                </div>
              )}

              <p className="text-xs text-slate-300 leading-relaxed">
                {suspendingUser.status === 'suspended'
                  ? 'Reactivating this account will restore this user\'s access to the portal immediately.'
                  : 'Temporarily suspending this user will immediately revoke their ability to sign in until reactivated.'}
              </p>

              <form onSubmit={handleToggleSuspend} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Verify Admin Password
                  </label>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Enter your administrator password to authorize this action:
                  </p>
                  <div className="relative">
                    <input
                      type={showSuspendAdminPassword ? 'text' : 'password'}
                      required
                      value={suspendAdminPassword}
                      onChange={(e) => setSuspendAdminPassword(e.target.value)}
                      placeholder="Your current admin password"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSuspendAdminPassword(!showSuspendAdminPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {showSuspendAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setSuspendingUser(null);
                      setSuspendAdminPassword('');
                      setSuspendError('');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isTogglingSuspend}
                    className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-2 transition-all cursor-pointer ${
                      suspendingUser.status === 'suspended'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95'
                        : 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-95'
                    }`}
                  >
                    {isTogglingSuspend ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : suspendingUser.status === 'suspended' ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Confirm Reactivation</span>
                      </>
                    ) : (
                      <>
                        <UserX className="w-3.5 h-3.5" />
                        <span>Confirm Suspension</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
