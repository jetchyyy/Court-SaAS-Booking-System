import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui';
import { changePassword } from '../../services/auth';
import { appendAuditLog, setDeveloperModeEnabled } from '../../services/auditLogs';

// Move PasswordInput component outside to prevent remounting
const PasswordInput = ({
    label,
    value,
    onChange,
    show,
    onToggleShow,
    placeholder,
    autoComplete,
    disabled
}) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
            {label}
        </label>
        <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all"
                placeholder={placeholder}
                required
                disabled={disabled}
                autoComplete={autoComplete}
            />
            <button
                type="button"
                onClick={onToggleShow}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                disabled={disabled}
            >
                {show ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
        </div>
    </div>
);

export function ChangePassword() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [devMessage, setDevMessage] = useState('');
    const keyBufferRef = useRef('');

    useEffect(() => {
        const handleKeydown = (event) => {
            const key = String(event.key || '').toUpperCase();
            if (!/^[A-Z]$/.test(key)) return;

            keyBufferRef.current = `${keyBufferRef.current}${key}`.slice(-3);
            if (keyBufferRef.current === 'ODC') {
                keyBufferRef.current = '';
                setDeveloperModeEnabled(true);
                window.dispatchEvent(new CustomEvent('developer-mode-activate'));
                appendAuditLog({
                    action: 'admin.devmode.enabled',
                    description: 'Developer mode activated via ODC easter egg from Change Password page'
                });

                setDevMessage('Developer mode activated: audit tray unlocked.');
                window.setTimeout(() => {
                    setDevMessage('');
                }, 3000);
            }
        };

        window.addEventListener('keydown', handleKeydown);
        return () => {
            window.removeEventListener('keydown', handleKeydown);
        };
    }, []);

    const validatePassword = (password) => {
        if (password.length < 8) {
            return 'Password must be at least 8 characters long';
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            setError('All fields are required');
            return;
        }

        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            setError(passwordError);
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        if (currentPassword === newPassword) {
            setError('New password must be different from current password');
            return;
        }

        setLoading(true);

        try {
            await changePassword(currentPassword, newPassword);
            setSuccess(true);
            // Clear form
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');

            // Hide success message after 5 seconds
            setTimeout(() => setSuccess(false), 5000);
        } catch (err) {
            console.error('Password change error:', err);
            setError(err.message || 'Failed to change password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl w-full">
            <div className="mb-8">
                <h1 className="text-2xl font-display font-bold text-brand-green-dark mb-2">
                    Change Password
                </h1>
                <p className="text-gray-600">
                    Update your password to keep your account secure
                </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <PasswordInput
                        label="Current Password"
                        value={currentPassword}
                        onChange={setCurrentPassword}
                        show={showCurrentPassword}
                        onToggleShow={() => setShowCurrentPassword(!showCurrentPassword)}
                        placeholder="Enter your current password"
                        autoComplete="current-password"
                        disabled={loading}
                    />

                    <div className="pt-4 border-t border-gray-100">
                        <PasswordInput
                            label="New Password"
                            value={newPassword}
                            onChange={setNewPassword}
                            show={showNewPassword}
                            onToggleShow={() => setShowNewPassword(!showNewPassword)}
                            placeholder="Enter your new password"
                            autoComplete="new-password"
                            disabled={loading}
                        />
                        <p className="mt-2 text-xs text-gray-500">
                            Password must be at least 8 characters long
                        </p>
                    </div>

                    <PasswordInput
                        label="Confirm New Password"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        show={showConfirmPassword}
                        onToggleShow={() => setShowConfirmPassword(!showConfirmPassword)}
                        placeholder="Confirm your new password"
                        autoComplete="new-password"
                        disabled={loading}
                    />

                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2">
                            <CheckCircle size={20} />
                            <span>Password changed successfully!</span>
                        </div>
                    )}

                    {devMessage && (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
                            {devMessage}
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <Button
                            type="submit"
                            className="flex-1 text-white"
                            disabled={loading}
                        >
                            {loading ? 'Changing Password...' : 'Change Password'}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setCurrentPassword('');
                                setNewPassword('');
                                setConfirmPassword('');
                                setError('');
                                setSuccess(false);
                            }}
                            disabled={loading}
                        >
                            Clear
                        </Button>
                    </div>
                </form>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">
                    Password Security Tips
                </h3>
                <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Use a mix of uppercase, lowercase, numbers, and symbols</li>
                    <li>• Avoid using personal information or common words</li>
                    <li>• Don't reuse passwords from other accounts</li>
                    <li>• Consider using a password manager</li>
                </ul>
            </div>
        </div>
    );
}