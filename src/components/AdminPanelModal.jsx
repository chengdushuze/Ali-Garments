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
  History,
  Crown,
  Copy,
  Check,
  Globe,
  Smartphone
} from 'lucide-react';
import { apiFetch } from '../services/apiClient';

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

  // Admin Security Gate Unlock state (requires administrator password to view/access panel)
  const [isGateUnlocked, setIsGateUnlocked] = useState(false);
  const [gatePassword, setGatePassword] = useState('');
  const [showGatePassword, setShowGatePassword] = useState(false);
  const [isVerifyingGate, setIsVerifyingGate] = useState(false);
  const [gateError, setGateError] = useState('');

  // Role Change Modal state (Website own popup - Zero Chrome popups!)
  const [roleChangeTarget, setRoleChangeTarget] = useState(null); // { user, targetRole }
  const [roleSuperAdminPassword, setRoleSuperAdminPassword] = useState('');
  const [showRoleSuperAdminPassword, setShowRoleSuperAdminPassword] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [roleError, setRoleError] = useState('');

  // Delete User Modal state (Website own popup - Zero Chrome popups!)
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [deleteUserPassword, setDeleteUserPassword] = useState('');
  const [showDeleteUserPassword, setShowDeleteUserPassword] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState('');

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
  const [suspendDurationDays, setSuspendDurationDays] = useState('7');
  const [suspendReason, setSuspendReason] = useState('We suspected unusual activity on your account.');

  // VPN Policy Toggle State
  const [vpnToggleTarget, setVpnToggleTarget] = useState(null);
  const [vpnAdminPassword, setVpnAdminPassword] = useState('');
  const [vpnError, setVpnError] = useState('');
  const [isUpdatingVpn, setIsUpdatingVpn] = useState(false);

  // Foreign Access Policy Toggle State (Super Admin Only)
  const [foreignToggleTarget, setForeignToggleTarget] = useState(null);
  const [foreignAdminPassword, setForeignAdminPassword] = useState('');
  const [foreignError, setForeignError] = useState('');
  const [isUpdatingForeign, setIsUpdatingForeign] = useState(false);

  // Audit Log State
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');

  // Super Admin Clear Audit Trails State (Website own popup - Zero Chrome popups)
  const [showClearAuditModal, setShowClearAuditModal] = useState(false);
  const [clearAuditPassword, setClearAuditPassword] = useState('');
  const [showClearAuditPassword, setShowClearAuditPassword] = useState(false);
  const [isClearingAudit, setIsClearingAudit] = useState(false);
  const [clearAuditError, setClearAuditError] = useState('');

  // Delete Specific Audit Trail State (Admin / Super Admin, Website own popup - Zero Chrome popups)
  const [selectedTrailToDelete, setSelectedTrailToDelete] = useState(null);
  const [showDeleteTrailModal, setShowDeleteTrailModal] = useState(false);
  const [deleteTrailPassword, setDeleteTrailPassword] = useState('');
  const [showDeleteTrailPassword, setShowDeleteTrailPassword] = useState(false);
  const [isDeletingTrail, setIsDeletingTrail] = useState(false);
  const [deleteTrailError, setDeleteTrailError] = useState('');

  // Nightly Backup state
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupStatus, setBackupStatus] = useState(null);
  const [lastBackupInfo, setLastBackupInfo] = useState({
    time: null,
    details: '',
    isLoading: false,
  });

  // Fetch last backup time from API
  const fetchBackupInfo = async () => {
    setLastBackupInfo(prev => ({ ...prev, isLoading: true }));
    try {
      const res = await apiFetch('/api/admin/backup');
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setLastBackupInfo({
          time: data.lastBackupTime,
          details: data.details || '',
          isLoading: false,
        });
      }
    } catch (e) {
      console.warn('Failed to load backup info:', e);
    } finally {
      setLastBackupInfo(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Fetch users when modal opens and gate is unlocked
  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await apiFetch('/api/admin/users');
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
      const res = await apiFetch('/api/admin/audit');
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

  // Reset lock state whenever modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsGateUnlocked(false);
      setGatePassword('');
      setGateError('');
      setRoleChangeTarget(null);
      setDeleteUserTarget(null);
      setStatusMessage({ type: '', text: '' });
      setBackupStatus(null);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsGateUnlocked(false);
    setGatePassword('');
    setGateError('');
    setRoleChangeTarget(null);
    setDeleteUserTarget(null);
    onClose();
  };

  const handleUnlockAdminGate = async (e) => {
    e.preventDefault();
    if (!gatePassword) {
      setGateError('Please enter your administrator password.');
      return;
    }

    setIsVerifyingGate(true);
    setGateError('');

    try {
      const res = await apiFetch('/api/admin/verify-admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: gatePassword,
          action: 'admin_gate',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setGateError(data.error || 'Incorrect administrator password. Access denied.');
        return;
      }

      setIsGateUnlocked(true);
      setGatePassword('');
      fetchUsers();
      fetchBackupInfo();
    } catch (err) {
      setGateError('Network connection error during verification. Please try again.');
    } finally {
      setIsVerifyingGate(false);
    }
  };

  // Strict Security Guard: Only users with role === 'admin' or 'super_admin' can render the Admin Panel
  if (!isOpen || (currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin')) return null;

  // 1. Create User Handler
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setStatusMessage({ type: '', text: '' });

    if (!name.trim() || !email.trim() || !password) {
      setStatusMessage({ type: 'error', text: 'All fields are required.' });
      return;
    }

    if (role === 'super_admin') {
      setStatusMessage({ type: 'error', text: 'Super Admin is a unique single account and cannot be created here.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/admin/users', {
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

  // 2. Remove / Delete User Handlers (Website own popup - Zero Chrome popups)
  const handleInitiateDeleteUser = (user) => {
    if (user.id === currentUser?.id) {
      setStatusMessage({ type: 'error', text: 'You cannot remove your own active administrator account.' });
      return;
    }

    if (user.role === 'super_admin') {
      setStatusMessage({ type: 'error', text: 'Super Admin account is permanently protected and cannot be deleted.' });
      return;
    }

    setDeleteUserTarget(user);
    setDeleteUserPassword('');
    setDeleteUserError('');
    setShowDeleteUserPassword(false);
  };

  const handleConfirmDeleteUser = async (e) => {
    e.preventDefault();
    if (!deleteUserTarget) return;

    if (!deleteUserPassword) {
      setDeleteUserError('Please enter your administrator password to authorize deletion.');
      return;
    }

    setIsDeletingUser(true);
    setDeleteUserError('');

    try {
      // 1. Verify admin password via backend
      const verifyRes = await apiFetch('/api/admin/verify-admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: deleteUserPassword,
          action: 'admin_gate',
        }),
      });
      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !verifyData.success) {
        setDeleteUserError(verifyData.error || 'Incorrect password. Deletion authorization failed.');
        setIsDeletingUser(false);
        return;
      }

      // 2. Delete user
      const res = await apiFetch(`/api/admin/users?id=${deleteUserTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setDeleteUserError(data.error || 'Failed to remove user account.');
        setIsDeletingUser(false);
        return;
      }

      setUsersList((prev) => prev.filter((u) => u.id !== deleteUserTarget.id));
      setStatusMessage({
        type: 'success',
        text: `User account "${deleteUserTarget.name}" (${deleteUserTarget.email}) was successfully removed.`,
      });
      setDeleteUserTarget(null);
      setDeleteUserPassword('');
    } catch (err) {
      console.error('Delete user error:', err);
      setDeleteUserError('Failed to connect to server. Please try again.');
    } finally {
      setIsDeletingUser(false);
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
      const res = await apiFetch('/api/admin/users', {
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
      const res = await apiFetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: suspendingUser.id,
          status: targetStatus,
          durationDays: targetStatus === 'suspended' ? Number(suspendDurationDays) : null,
          suspensionReason: targetStatus === 'suspended' ? (suspendReason.trim() || 'We suspected unusual activity on your account.') : null,
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
      setSuspendReason('We suspected unusual activity on your account.');
      fetchUsers();
    } catch (err) {
      console.error('Toggle suspend error:', err);
      setSuspendError('Failed to connect to server. Please try again.');
    } finally {
      setIsTogglingSuspend(false);
    }
  };

  // 5. Change User Role Handlers (Website own popup - Zero Chrome popups)
  const handleInitiateRoleChange = (user, targetRole) => {
    setRoleChangeTarget({ user, targetRole });
    setRoleSuperAdminPassword('');
    setRoleError('');
    setShowRoleSuperAdminPassword(false);
  };

  const handleConfirmRoleChange = async (e) => {
    e.preventDefault();
    if (!roleChangeTarget) return;

    if (!roleSuperAdminPassword) {
      setRoleError('Please enter your Super Admin password to authorize role change.');
      return;
    }

    setIsUpdatingRole(true);
    setRoleError('');

    const roleLabel = roleChangeTarget.targetRole === 'admin' ? 'Administrator' : 'Standard User';

    try {
      const res = await apiFetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: roleChangeTarget.user.id,
          role: roleChangeTarget.targetRole,
          adminPassword: roleSuperAdminPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setRoleError(data.error || 'Failed to update user role.');
        return;
      }

      setStatusMessage({
        type: 'success',
        text: `Role for "${roleChangeTarget.user.name}" (${roleChangeTarget.user.email}) successfully changed to ${roleLabel}!`,
      });
      setRoleChangeTarget(null);
      setRoleSuperAdminPassword('');
      fetchUsers();
    } catch (err) {
      console.error('Role update error:', err);
      setRoleError('Network error while updating user role. Please try again.');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // 6. VPN Policy Toggle Handlers
  const handleToggleVpn = (target) => {
    setVpnToggleTarget(target);
    setVpnAdminPassword('');
    setVpnError('');
  };

  const handleConfirmToggleVpn = async (e) => {
    e.preventDefault();
    if (!vpnToggleTarget) return;

    if (!vpnAdminPassword) {
      setVpnError('Admin verification password is required');
      return;
    }

    setIsUpdatingVpn(true);
    setVpnError('');

    try {
      const nextVal = Number(vpnToggleTarget.allow_vpn) === 1 ? 0 : 1;
      const res = await apiFetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: vpnToggleTarget.id,
          allowVpn: nextVal,
          adminPassword: vpnAdminPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setVpnError((data.error || 'Failed to update VPN permission').replace(/\./g, ''));
        return;
      }

      setStatusMessage({
        type: 'success',
        text: `VPN/Proxy access for "${vpnToggleTarget.name}" is now ${nextVal ? 'ALLOWED' : 'BLOCKED'}`,
      });

      setVpnToggleTarget(null);
      setVpnAdminPassword('');
      fetchUsers();
    } catch (err) {
      console.error('VPN policy update error:', err);
      setVpnError('Network error while updating VPN permission Please try again');
    } finally {
      setIsUpdatingVpn(false);
    }
  };

  // 7. Foreign Access Policy Toggle Handlers (Super Admin Only)
  const handleToggleForeign = (target) => {
    setForeignToggleTarget(target);
    setForeignAdminPassword('');
    setForeignError('');
  };

  const handleConfirmToggleForeign = async (e) => {
    e.preventDefault();
    if (!foreignToggleTarget) return;

    if (!foreignAdminPassword) {
      setForeignError('Admin verification password is required');
      return;
    }

    setIsUpdatingForeign(true);
    setForeignError('');

    try {
      const nextVal = Number(foreignToggleTarget.allow_foreign_access) === 1 ? 0 : 1;
      const res = await apiFetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: foreignToggleTarget.id,
          allowForeignAccess: nextVal,
          adminPassword: foreignAdminPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setForeignError((data.error || 'Failed to update foreign access permission').replace(/\./g, ''));
        return;
      }

      setStatusMessage({
        type: 'success',
        text: `Foreign access for "${foreignToggleTarget.name}" is now ${nextVal ? 'ALLOWED' : 'BLOCKED (Pakistan Only)'}`,
      });

      setForeignToggleTarget(null);
      setForeignAdminPassword('');
      fetchUsers();
    } catch (err) {
      console.error('Foreign policy update error:', err);
      setForeignError('Network error while updating foreign access permission Please try again');
    } finally {
      setIsUpdatingForeign(false);
    }
  };

  // 5. Trigger Nightly Backup to ali-graments-backup D1
  const handleTriggerBackup = async () => {
    setIsBackingUp(true);
    setBackupStatus(null);

    try {
      const res = await apiFetch('/api/admin/backup', {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setBackupStatus({
          type: 'error',
          text: (data.error || 'Backup operation failed').replace(/\./g, ''),
        });
      } else {
        setBackupStatus({
          type: 'success',
          text: (data.message || 'Nightly backup successfully completed').replace(/\./g, ''),
          stats: data.stats,
        });
        fetchBackupInfo();
      }
    } catch (err) {
      console.error('Backup error:', err);
      setBackupStatus({
        type: 'error',
        text: 'Failed to initiate backup Check your network or D1 binding',
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  // 7. Super Admin Clear All Audit Trails Handler
  const handleConfirmClearAudit = async (e) => {
    e.preventDefault();
    if (!clearAuditPassword) {
      setClearAuditError('Please enter your Super Admin password to authorize audit purge.');
      return;
    }

    setIsClearingAudit(true);
    setClearAuditError('');

    try {
      const res = await apiFetch('/api/admin/audit', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          superAdminPassword: clearAuditPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setClearAuditError(data.error || 'Failed to clear audit trails.');
        return;
      }

      setStatusMessage({
        type: 'success',
        text: 'All activity audit trails have been permanently purged by Super Admin.',
      });
      setShowClearAuditModal(false);
      setClearAuditPassword('');
      fetchAuditLogs();
    } catch (err) {
      console.error('Purge audit error:', err);
      setClearAuditError('Network error while purging audit logs.');
    } finally {
      setIsClearingAudit(false);
    }
  };

  // Delete specific audit trail record (Admin / Super Admin authorization)
  const handleConfirmDeleteTrail = async (e) => {
    e.preventDefault();
    if (!deleteTrailPassword) {
      setDeleteTrailError('Administrator password is required to delete this audit record.');
      return;
    }
    if (!selectedTrailToDelete) return;

    setIsDeletingTrail(true);
    setDeleteTrailError('');

    try {
      const res = await apiFetch(`/api/admin/audit?id=${selectedTrailToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId: selectedTrailToDelete.id,
          adminPassword: deleteTrailPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setDeleteTrailError(data.error || 'Failed to delete audit record. Please verify password.');
        return;
      }

      const deletedId = selectedTrailToDelete.id;
      setStatusMessage({
        type: 'success',
        text: `Audit record #${deletedId} was successfully removed.`,
      });
      setShowDeleteTrailModal(false);
      setSelectedTrailToDelete(null);
      setDeleteTrailPassword('');
      setAuditLogs(prev => prev.filter(l => l.id !== deletedId));
    } catch (err) {
      console.error('Delete specific audit error:', err);
      setDeleteTrailError('Network error while deleting audit record.');
    } finally {
      setIsDeletingTrail(false);
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
            <div className={`p-2 rounded-xl border ${
              currentUser?.role === 'super_admin'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm shadow-amber-500/20'
                : 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
            }`}>
              {currentUser?.role === 'super_admin' ? (
                <Crown className="w-5 h-5 text-amber-400" />
              ) : (
                <Shield className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white">
                  {currentUser?.role === 'super_admin' ? 'Super Admin Control Center' : 'Admin Management Portal'}
                </h3>
                {currentUser?.role === 'super_admin' && (
                  <span className="hidden sm:inline-block px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 rounded-full shadow-sm">
                    Master Authority
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400">
                {currentUser?.role === 'super_admin'
                  ? 'Role Management • User Passwords • Activity Audit • Cloud Backup'
                  : 'User Access & Security • Activity Audit • Cloud Backup'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ADMIN SECURITY GATE: Prompt password before granting access to Admin Panel */}
        {!isGateUnlocked ? (
          <div className="p-6 sm:p-10 flex flex-col items-center justify-center max-w-md mx-auto my-6 text-center space-y-5 animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-950/50">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-lg font-black text-white">
                Admin Panel Security Gate
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Security verification required. Please enter your Administrator password to unlock user accounts, roles, backups, and audit logs.
              </p>
            </div>

            <div className="w-full p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-left text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></div>
                <span className="text-slate-300 font-semibold truncate">{currentUser?.email}</span>
              </div>
              <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0 font-bold">
                {currentUser?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
              </span>
            </div>

            <form onSubmit={handleUnlockAdminGate} className="w-full space-y-4">
              <div className="text-left">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Administrator Password:
                </label>
                <div className="relative">
                  <input
                    type={showGatePassword ? 'text' : 'password'}
                    value={gatePassword}
                    onChange={e => {
                      setGatePassword(e.target.value);
                      setGateError('');
                    }}
                    placeholder="Enter your account password..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowGatePassword(!showGatePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showGatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {gateError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium text-left">
                  {gateError}
                </div>
              )}

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingGate}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 disabled:opacity-50 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isVerifyingGate ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Unlock Admin Panel</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
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
                        placeholder="user@example.com"
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
                        const isSuper = u.role === 'super_admin';
                        const isDeleting = deletingUserId === u.id;

                        return (
                          <div
                            key={u.id}
                            className="p-4 sm:p-5 flex flex-col gap-3.5 hover:bg-slate-900/40 transition-colors"
                          >
                            {/* Row 1: User Identity + Quick Action Icons */}
                            <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center font-bold text-sm text-emerald-400 shrink-0 shadow-inner">
                                  {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-sm text-white tracking-tight truncate">
                                      {u.name}
                                    </span>
                                    {isSelf && (
                                      <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 rounded-md font-semibold">
                                        You
                                      </span>
                                    )}
                                    {isSuper ? (
                                      <span className="px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-md border bg-amber-500/15 text-amber-300 border-amber-500/40 flex items-center gap-1 font-bold">
                                        <Crown className="w-3 h-3 text-amber-400" />
                                        Super Admin
                                      </span>
                                    ) : (
                                      <span
                                        className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-md border font-semibold ${
                                          u.role === 'admin'
                                            ? 'bg-amber-950/70 text-amber-300 border-amber-800/60'
                                            : 'bg-slate-800 text-slate-300 border-slate-700'
                                        }`}
                                      >
                                        {u.role}
                                      </span>
                                    )}
                                    <span
                                      className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-md border font-semibold ${
                                        u.status === 'suspended'
                                          ? 'bg-rose-950/90 text-rose-300 border-rose-800/80'
                                          : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                                      }`}
                                    >
                                      {u.status === 'suspended'
                                        ? `Suspended${u.suspended_until ? ` (${Math.max(1, Math.ceil((u.suspended_until - Date.now()) / (24 * 3600 * 1000)))}d)` : ''}`
                                        : 'Active'}
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-mono">
                                      #{u.id}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-400 font-mono mt-1 truncate">
                                    {u.email}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Quick Actions Group (Password Key, Suspend/Reactivate, Delete) */}
                              <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center bg-slate-900/60 p-1 rounded-xl border border-slate-800">
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
                                  title={isSelf ? 'Change Your Admin Password' : `Change Password for ${u.name}`}
                                  className={`p-2 rounded-lg transition-all cursor-pointer ${
                                    isSelf
                                      ? 'text-amber-300 hover:bg-amber-950/60'
                                      : 'text-emerald-400 hover:bg-emerald-950/60'
                                  }`}
                                >
                                  <Key className="w-4 h-4" />
                                </button>

                                {/* Suspend / Reactivate Button */}
                                {isSuper ? (
                                  <span title="Super Admin is protected and cannot be suspended" className="p-2 text-amber-500/40 cursor-not-allowed">
                                    <Shield className="w-4 h-4" />
                                  </span>
                                ) : (
                                  !isSelf && (
                                    <button
                                      onClick={() => {
                                        setSuspendingUser(u);
                                        setSuspendAdminPassword('');
                                        setSuspendError('');
                                        setShowSuspendAdminPassword(false);
                                        setSuspendDurationDays('7');
                                        setSuspendReason(u.suspension_reason || 'We suspected unusual activity on your account.');
                                      }}
                                      title={
                                        u.status === 'suspended'
                                          ? `Reactivate account for ${u.name}`
                                          : `Temporarily suspend account for ${u.name}`
                                      }
                                      className={`p-2 rounded-lg transition-all cursor-pointer ${
                                        u.status === 'suspended'
                                          ? 'text-emerald-300 hover:bg-emerald-950/70'
                                          : 'text-amber-400 hover:text-rose-400 hover:bg-rose-950/40'
                                      }`}
                                    >
                                      {u.status === 'suspended' ? (
                                        <UserCheck className="w-4 h-4" />
                                      ) : (
                                        <UserX className="w-4 h-4" />
                                      )}
                                    </button>
                                  )
                                )}

                                {/* Delete User Button */}
                                {!isSelf && !isSuper && (
                                  <button
                                    onClick={() => handleInitiateDeleteUser(u)}
                                    disabled={isDeleting}
                                    title={`Remove ${u.name}`}
                                    className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-all cursor-pointer disabled:opacity-50"
                                  >
                                    {isDeleting ? (
                                      <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Row 2: Connection & Device Metadata Pills */}
                            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 flex-wrap">
                              {u.last_login_ip && (
                                <span className="inline-flex items-center gap-1.5 bg-slate-900/90 text-cyan-400 px-2.5 py-1 rounded-lg border border-cyan-800/40 font-semibold" title={`Last Login IP: ${u.last_login_ip}`}>
                                  <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                  <span className="truncate">{u.last_login_ip}</span>
                                </span>
                              )}
                              {u.last_login_device && (
                                <span className="inline-flex items-center gap-1.5 bg-slate-900/90 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-800" title="Last Login Device">
                                  <Smartphone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{u.last_login_device}</span>
                                </span>
                              )}
                              {u.last_login_at && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono py-1">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  <span>Active: {new Date(u.last_login_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                </span>
                              )}
                            </div>

                            {/* Suspension Reason Alert (if suspended) */}
                            {u.status === 'suspended' && (
                              <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-xl px-3 py-2 flex items-center gap-2 font-sans">
                                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                <span className="font-semibold text-rose-400 font-mono text-[10px] uppercase">Reason:</span>
                                <span className="italic truncate">{u.suspension_reason || 'We suspected unusual activity on your account.'}</span>
                              </div>
                            )}

                            {/* Row 3: Security & Network Access Policies Bar */}
                            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2.5 flex-wrap">
                              <div className="text-[11px] text-slate-400 font-mono uppercase font-semibold flex items-center gap-1.5">
                                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Security Policies</span>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Role Selector Button */}
                                {currentUser?.role === 'super_admin' && !isSuper && (
                                  <button
                                    onClick={() => handleInitiateRoleChange(u, u.role === 'admin' ? 'user' : 'admin')}
                                    title={u.role === 'admin' ? `Demote ${u.name} to Standard User` : `Promote ${u.name} to Administrator`}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border flex items-center gap-1.5 shadow-sm ${
                                      u.role === 'admin'
                                        ? 'bg-amber-950/60 hover:bg-amber-900 text-amber-300 border-amber-700/60'
                                        : 'bg-slate-900 hover:bg-slate-800 text-blue-300 border-blue-800/60'
                                    }`}
                                  >
                                    <span>{u.role === 'admin' ? 'Role: Admin ▾' : 'Role: User ▾'}</span>
                                  </button>
                                )}

                                {/* VPN / Proxy Policy Toggle */}
                                {!isSuper && (
                                  <button
                                    onClick={() => handleToggleVpn(u)}
                                    title={`VPN/Proxy access is currently ${Number(u.allow_vpn) === 1 ? 'ALLOWED' : 'BLOCKED'}. Click to toggle.`}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border flex items-center gap-1.5 shadow-sm ${
                                      Number(u.allow_vpn) === 1
                                        ? 'bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border-emerald-700/60'
                                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-700'
                                    }`}
                                  >
                                    <Globe className={`w-3.5 h-3.5 ${Number(u.allow_vpn) === 1 ? 'text-emerald-400' : 'text-slate-500'}`} />
                                    <span>VPN: {Number(u.allow_vpn) === 1 ? 'Allowed' : 'Blocked'}</span>
                                  </button>
                                )}

                                {/* Foreign Access (Outside Pakistan) Policy Toggle - Super Admin Only */}
                                {currentUser?.role === 'super_admin' && !isSuper && (
                                  <button
                                    onClick={() => handleToggleForeign(u)}
                                    title={`Foreign access (outside Pakistan) is currently ${Number(u.allow_foreign_access) === 1 ? 'ALLOWED' : 'BLOCKED (PK Only)'}. Click to toggle.`}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border flex items-center gap-1.5 shadow-sm ${
                                      Number(u.allow_foreign_access) === 1
                                        ? 'bg-blue-950/70 hover:bg-blue-900 text-blue-300 border-blue-700/60'
                                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-700'
                                    }`}
                                  >
                                    <Globe className={`w-3.5 h-3.5 ${Number(u.allow_foreign_access) === 1 ? 'text-blue-400' : 'text-slate-500'}`} />
                                    <span>Foreign: {Number(u.allow_foreign_access) === 1 ? 'Allowed' : 'PK Only'}</span>
                                  </button>
                                )}
                              </div>
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
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={fetchAuditLogs}
                    disabled={isLoadingAudit}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-emerald-400 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAudit ? 'animate-spin' : ''}`} />
                    <span className="whitespace-nowrap">Refresh Logs</span>
                  </button>

                  {/* Super Admin Only: Clear Audit Trails */}
                  {currentUser?.role === 'super_admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowClearAuditModal(true);
                        setClearAuditPassword('');
                        setClearAuditError('');
                        setShowClearAuditPassword(false);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-xs text-rose-300 border border-rose-800/60 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap font-semibold active:scale-95 shadow-sm"
                      title="Permanently remove all activity audit records (Super Admin Only)"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span className="whitespace-nowrap">Clear Audit Trails</span>
                    </button>
                  )}
                </div>
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
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Login Device IP</th>
                        <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {filteredAuditLogs.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-8 text-center text-slate-500 text-xs">
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
                            <tr key={log.id} className="hover:bg-slate-900/50 transition-colors">
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
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-cyan-400 font-mono text-[11px] font-semibold">
                                  <Globe className="w-3 h-3 text-cyan-400 shrink-0" />
                                  <span>{log.ip_address || '127.0.0.1'}</span>
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedTrailToDelete(log);
                                    setShowDeleteTrailModal(true);
                                    setDeleteTrailPassword('');
                                    setDeleteTrailError('');
                                    setShowDeleteTrailPassword(false);
                                  }}
                                  title={`Delete audit log #${log.id}`}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
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

              {/* Last Backup Time Card */}
              <div className="mt-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Last Cloud Backup Time
                    </span>
                    <span className="text-sm font-bold font-mono text-emerald-400">
                      {lastBackupInfo.time
                        ? new Date(lastBackupInfo.time).toLocaleString('en-US', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })
                        : 'No backup recorded yet'}
                    </span>
                    {lastBackupInfo.details && (
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {lastBackupInfo.details}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={fetchBackupInfo}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 border border-slate-700/80 flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
                  title="Check latest backup timestamp"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${lastBackupInfo.isLoading ? 'animate-spin' : ''}`} />
                  <span>{lastBackupInfo.isLoading ? 'Checking...' : 'Refresh Time'}</span>
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 font-mono">
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
                {/* Duration selector for suspension */}
                {suspendingUser.status !== 'suspended' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                      Suspension Duration
                    </label>
                    <select
                      value={suspendDurationDays}
                      onChange={(e) => setSuspendDurationDays(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                    >
                      <option value="1">1 Day (24 Hours)</option>
                      <option value="3">3 Days</option>
                      <option value="7">7 Days (1 Week)</option>
                      <option value="15">15 Days</option>
                      <option value="30">30 Days (1 Month)</option>
                      <option value="0">Indefinite (Until manually reactivated)</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {suspendDurationDays === '0'
                        ? 'User will remain suspended indefinitely until manually reactivated.'
                        : `User will be suspended and automatically reactivated after ${suspendDurationDays} day(s).`}
                    </p>
                  </div>
                )}

                {/* Reason for suspension */}
                {suspendingUser.status !== 'suspended' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                      Reason for Suspension • معطلی کی وجہ
                    </label>
                    <textarea
                      rows={2}
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      placeholder="We suspected unusual activity on your account."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Reason shown to user upon login or active session termination.
                    </p>
                  </div>
                )}

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

        {/* Website Own Popup: VPN Policy Toggle Modal */}
        {vpnToggleTarget && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-emerald-400" />
                  <h4 className="text-sm font-bold text-white">VPN / Proxy Policy • وی پی این پالیسی</h4>
                </div>
                <button
                  onClick={() => {
                    setVpnToggleTarget(null);
                    setVpnAdminPassword('');
                    setVpnError('');
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                <p className="text-slate-300">
                  Target Status: <strong className={vpnToggleTarget.allow_vpn ? 'text-rose-400' : 'text-emerald-400'}>
                    {vpnToggleTarget.allow_vpn ? 'BLOCK VPN / PROXY ACCESS' : 'ALLOW VPN / PROXY ACCESS'}
                  </strong>
                </p>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  {vpnToggleTarget.allow_vpn
                    ? 'When blocked, this user will be prevented from signing in or accessing the portal from any VPN, proxy, or datacenter network.'
                    : 'When allowed, this user will be authorized to access the portal even while using a VPN or Proxy.'}
                </p>
              </div>

              {vpnError && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{vpnError}</span>
                </div>
              )}

              <form onSubmit={handleConfirmToggleVpn} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Enter Admin Password to Authorize
                  </label>
                  <input
                    type="password"
                    required
                    value={vpnAdminPassword}
                    onChange={(e) => setVpnAdminPassword(e.target.value)}
                    placeholder="Your Administrator Password"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setVpnToggleTarget(null);
                      setVpnAdminPassword('');
                      setVpnError('');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingVpn}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {isUpdatingVpn ? 'Updating...' : 'Confirm VPN Policy'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Website Own Popup: Foreign Access (Outside PK) Policy Toggle Modal (Super Admin only) */}
        {foreignToggleTarget && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-400" />
                  <h4 className="text-sm font-bold text-white">Foreign Access Policy • باہر رسائی</h4>
                </div>
                <button
                  onClick={() => {
                    setForeignToggleTarget(null);
                    setForeignAdminPassword('');
                    setForeignError('');
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                <p className="text-slate-300">
                  Target User: <strong className="text-white">{foreignToggleTarget.name}</strong> ({foreignToggleTarget.email})
                </p>
                <p className="text-slate-300">
                  Policy Change: <strong className={foreignToggleTarget.allow_foreign_access ? 'text-amber-400' : 'text-blue-400'}>
                    {foreignToggleTarget.allow_foreign_access ? 'RESTRICT TO PAKISTAN ONLY (Block Foreign)' : 'ALLOW ACCESS OUTSIDE PAKISTAN'}
                  </strong>
                </p>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  {foreignToggleTarget.allow_foreign_access
                    ? 'When restricted, this user will be blocked if connecting from any IP or location outside Pakistan.'
                    : 'When allowed, this user can securely sign in and access ALI Garments from international locations outside Pakistan.'}
                </p>
              </div>

              {foreignError && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{foreignError}</span>
                </div>
              )}

              <form onSubmit={handleConfirmToggleForeign} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Enter Super Admin Password to Authorize
                  </label>
                  <input
                    type="password"
                    required
                    value={foreignAdminPassword}
                    onChange={(e) => setForeignAdminPassword(e.target.value)}
                    placeholder="Super Admin Password"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setForeignToggleTarget(null);
                      setForeignAdminPassword('');
                      setForeignError('');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingForeign}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {isUpdatingForeign ? 'Updating...' : 'Authorize Policy'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Website Own Popup: Role Change Modal (Zero Chrome popups) */}
        {roleChangeTarget && (
          <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Crown className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">
                      Authorize User Role Change
                    </h4>
                    <p className="text-xs text-slate-400">
                      Super Admin Security Verification
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRoleChangeTarget(null);
                    setRoleSuperAdminPassword('');
                    setRoleError('');
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-500 font-semibold uppercase">Target User:</span>
                  <span className="font-bold text-white">{roleChangeTarget.user.name}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-500 font-semibold uppercase">Email:</span>
                  <span className="font-mono text-slate-400">{roleChangeTarget.user.email}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                  <span className="text-slate-500 font-semibold uppercase">New Role:</span>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                    roleChangeTarget.targetRole === 'admin'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                      : 'bg-blue-950 text-blue-300 border border-blue-800/60'
                  }`}>
                    {roleChangeTarget.targetRole === 'admin' ? 'Administrator' : 'Standard User'}
                  </span>
                </div>
              </div>

              <form onSubmit={handleConfirmRoleChange} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Super Admin Password:
                  </label>
                  <div className="relative">
                    <input
                      type={showRoleSuperAdminPassword ? 'text' : 'password'}
                      value={roleSuperAdminPassword}
                      onChange={e => {
                        setRoleSuperAdminPassword(e.target.value);
                        setRoleError('');
                      }}
                      placeholder="Enter Super Admin password..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500 font-medium"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowRoleSuperAdminPassword(!showRoleSuperAdminPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showRoleSuperAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {roleError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium">
                    {roleError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRoleChangeTarget(null);
                      setRoleSuperAdminPassword('');
                      setRoleError('');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingRole}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 active:scale-95 text-slate-950 text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isUpdatingRole ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                        <span>Updating Role...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5 text-slate-950" />
                        <span>Authorize Role Change</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Website Own Popup: Delete User Modal (Zero Chrome popups) */}
        {deleteUserTarget && (
          <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">
                      Delete User Account
                    </h4>
                    <p className="text-xs text-slate-400">
                      Permanent Removal Verification
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteUserTarget(null);
                    setDeleteUserPassword('');
                    setDeleteUserError('');
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-900/40 text-xs text-rose-300 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  Permanent Removal Warning
                </p>
                <p className="leading-relaxed text-slate-300">
                  Are you sure you want to permanently remove user <strong className="text-white">{deleteUserTarget.name}</strong> ({deleteUserTarget.email})? This user will immediately lose access.
                </p>
              </div>

              <form onSubmit={handleConfirmDeleteUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Enter Administrator Password:
                  </label>
                  <div className="relative">
                    <input
                      type={showDeleteUserPassword ? 'text' : 'password'}
                      value={deleteUserPassword}
                      onChange={e => {
                        setDeleteUserPassword(e.target.value);
                        setDeleteUserError('');
                      }}
                      placeholder="Enter administrator password..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-rose-500 font-medium"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeleteUserPassword(!showDeleteUserPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showDeleteUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {deleteUserError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium">
                    {deleteUserError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteUserTarget(null);
                      setDeleteUserPassword('');
                      setDeleteUserError('');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDeletingUser}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-95 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isDeletingUser ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Confirm & Delete User</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Website Own Popup: Clear Audit Trails Modal (Super Admin Only - Zero Chrome popups) */}
        {showClearAuditModal && (
          <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <Trash2 className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">
                      Purge Activity Audit Trails
                    </h4>
                    <p className="text-xs text-slate-400">
                      Super Admin Authorization Required
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowClearAuditModal(false);
                    setClearAuditPassword('');
                    setClearAuditError('');
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-900/40 text-xs text-rose-300 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  Irreversible Audit Deletion
                </p>
                <p className="leading-relaxed text-slate-300">
                  Are you sure you want to permanently erase all activity audit records from Cloudflare D1? This action cannot be undone.
                </p>
              </div>

              <form onSubmit={handleConfirmClearAudit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Enter Super Admin Password:
                  </label>
                  <div className="relative">
                    <input
                      type={showClearAuditPassword ? 'text' : 'password'}
                      value={clearAuditPassword}
                      onChange={e => {
                        setClearAuditPassword(e.target.value);
                        setClearAuditError('');
                      }}
                      placeholder="Enter Super Admin password..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-rose-500 font-medium"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowClearAuditPassword(!showClearAuditPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showClearAuditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {clearAuditError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium">
                    {clearAuditError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowClearAuditModal(false);
                      setClearAuditPassword('');
                      setClearAuditError('');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isClearingAudit}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-95 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isClearingAudit ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Purging Trails...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Authorize & Clear Audit Logs</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Specific Audit Trail Modal (In-App Dialog - Zero Chrome Popups) */}
        {showDeleteTrailModal && selectedTrailToDelete && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">
                      Delete Specific Audit Trail
                    </h4>
                    <p className="text-xs text-slate-400">
                      Record #{selectedTrailToDelete.id} • Admin Authorization Required
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteTrailModal(false);
                    setSelectedTrailToDelete(null);
                    setDeleteTrailPassword('');
                    setDeleteTrailError('');
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Record Summary Box */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-slate-400">Action:</span>
                  <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {selectedTrailToDelete.action}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">User:</span>
                  <span className="font-mono text-slate-200 font-medium">
                    {selectedTrailToDelete.user_email || `User #${selectedTrailToDelete.user_id}`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Device IP:</span>
                  <span className="font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/50">
                    {selectedTrailToDelete.ip_address || '127.0.0.1'}
                  </span>
                </div>
                <div className="text-slate-300 pt-1 border-t border-slate-800/80 leading-relaxed">
                  <strong className="text-slate-400">Details: </strong>
                  {selectedTrailToDelete.details}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-900/40 text-xs text-amber-300 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span>This specific activity entry will be permanently erased from Cloudflare D1.</span>
              </div>

              <form onSubmit={handleConfirmDeleteTrail} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Enter Admin Password:
                  </label>
                  <div className="relative">
                    <input
                      type={showDeleteTrailPassword ? 'text' : 'password'}
                      value={deleteTrailPassword}
                      onChange={e => {
                        setDeleteTrailPassword(e.target.value);
                        setDeleteTrailError('');
                      }}
                      placeholder="Enter administrator password..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-rose-500 font-medium"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeleteTrailPassword(!showDeleteTrailPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showDeleteTrailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {deleteTrailError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium">
                    {deleteTrailError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteTrailModal(false);
                      setSelectedTrailToDelete(null);
                      setDeleteTrailPassword('');
                      setDeleteTrailError('');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDeletingTrail}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-95 text-white text-xs font-bold shadow-md disabled:opacity-50 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isDeletingTrail ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Deleting Record...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Authorize & Delete</span>
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
            onClick={handleClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </>
    )}
      </div>
    </div>
  );
}
