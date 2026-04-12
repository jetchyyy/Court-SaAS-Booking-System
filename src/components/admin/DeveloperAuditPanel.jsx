import { ChevronDown, ChevronUp, RefreshCw, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui';
import {
    appendAuditLog,
    clearAuditLogs,
    getAuditLogs,
    isDeveloperModeEnabled,
    refreshAuditLogs,
    setDeveloperModeEnabled,
    subscribeToAuditLogs
} from '../../services/auditLogs';

function toLocalDateTime(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString();
}

function isWithinRange(timestamp, range) {
    if (range === 'all') return true;
    const target = new Date(timestamp).getTime();
    if (Number.isNaN(target)) return false;

    const now = Date.now();
    if (range === '1h') return now - target <= 60 * 60 * 1000;
    if (range === '24h') return now - target <= 24 * 60 * 60 * 1000;
    if (range === '7d') return now - target <= 7 * 24 * 60 * 60 * 1000;

    return true;
}

export function DeveloperAuditPanel() {
    const [isMinimized, setIsMinimized] = useState(false);
    const [enabled, setEnabled] = useState(isDeveloperModeEnabled());
    const [logs, setLogs] = useState(() => getAuditLogs());
    const [search, setSearch] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [userFilter, setUserFilter] = useState('all');
    const [rangeFilter, setRangeFilter] = useState('24h');

    useEffect(() => {
        if (!enabled) return;

        const unsubscribe = subscribeToAuditLogs((nextLogs) => {
            setLogs(nextLogs || []);
        });

        return () => unsubscribe();
    }, [enabled]);

    useEffect(() => {
        const handleActivate = () => {
            setDeveloperModeEnabled(true);
            setEnabled(true);
            setIsMinimized(false);
        };

        window.addEventListener('developer-mode-activate', handleActivate);
        return () => {
            window.removeEventListener('developer-mode-activate', handleActivate);
        };
    }, []);

    const actionOptions = useMemo(() => {
        const set = new Set();
        logs.forEach((log) => {
            if (log?.action) {
                const [group] = String(log.action).split('.');
                if (group) set.add(group);
            }
        });

        return ['all', ...Array.from(set).sort()];
    }, [logs]);

    const userOptions = useMemo(() => {
        const set = new Set();
        logs.forEach((log) => {
            if (log?.userEmail) set.add(String(log.userEmail));
        });

        return ['all', ...Array.from(set).sort()];
    }, [logs]);

    const filteredLogs = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return logs.filter((log) => {
            const actionGroup = String(log.action || '').split('.')[0] || '';
            const actionOk = actionFilter === 'all' || actionGroup === actionFilter;
            const userOk = userFilter === 'all' || String(log.userEmail || '') === userFilter;
            const rangeOk = isWithinRange(log.timestamp, rangeFilter);

            const keywordOk = !keyword ||
                String(log.action || '').toLowerCase().includes(keyword) ||
                String(log.description || '').toLowerCase().includes(keyword) ||
                String(log.userEmail || '').toLowerCase().includes(keyword);

            return actionOk && userOk && rangeOk && keywordOk;
        });
    }, [actionFilter, logs, rangeFilter, search, userFilter]);

    const handleToggleDeveloperMode = () => {
        const next = !enabled;
        setEnabled(next);
        setDeveloperModeEnabled(next);

        if (!next) {
            appendAuditLog({
                action: 'admin.devmode.disabled',
                description: 'Developer mode disabled from audit tray'
            });
        }
    };

    const handleRefresh = async () => {
        setLogs(getAuditLogs({ force: true }));
        await refreshAuditLogs({ force: true });
    };

    if (!enabled) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 z-40 font-mono">
            <div className="border-t border-[#0f3f0f] bg-[#050a05] text-[#7cff7c] shadow-[0_-8px_24px_rgba(0,0,0,0.5)]">
                <div className="px-4 py-2 border-b border-[#0f3f0f] flex items-center justify-between gap-3">
                    <div className="text-xs sm:text-sm tracking-wide">
                        &gt; admin_dev_console.exe - audit tray
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="rounded-md px-2 py-1 text-[#7cff7c] hover:bg-[#0d1a0d]" onClick={() => { void handleRefresh(); }}>
                            <RefreshCw size={13} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-md px-2 py-1 text-[#7cff7c] hover:bg-[#0d1a0d]"
                            onClick={() => { void clearAuditLogs(); }}
                        >
                            <Trash2 size={13} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-md px-2 py-1 text-[#7cff7c] hover:bg-[#0d1a0d]"
                            onClick={() => setIsMinimized(prev => !prev)}
                        >
                            {isMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-md px-2 py-1 text-[#7cff7c] hover:bg-[#0d1a0d]"
                            onClick={handleToggleDeveloperMode}
                        >
                            <X size={14} />
                        </Button>
                    </div>
                </div>

                {!isMinimized && (
                    <>
                        <div className="px-4 py-3 border-b border-[#0f3f0f] grid grid-cols-1 md:grid-cols-4 gap-2">
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="filter: keyword"
                                className="w-full px-3 py-2 text-xs bg-[#020502] text-[#7cff7c] border border-[#196619] rounded-md outline-none"
                            />

                            <select
                                value={actionFilter}
                                onChange={(event) => setActionFilter(event.target.value)}
                                className="w-full px-3 py-2 text-xs bg-[#020502] text-[#7cff7c] border border-[#196619] rounded-md outline-none"
                            >
                                {actionOptions.map((opt) => (
                                    <option key={opt} value={opt}>
                                        {opt === 'all' ? 'action: all' : `action: ${opt}`}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={userFilter}
                                onChange={(event) => setUserFilter(event.target.value)}
                                className="w-full px-3 py-2 text-xs bg-[#020502] text-[#7cff7c] border border-[#196619] rounded-md outline-none"
                            >
                                {userOptions.map((opt) => (
                                    <option key={opt} value={opt}>
                                        {opt === 'all' ? 'user: all' : `user: ${opt}`}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={rangeFilter}
                                onChange={(event) => setRangeFilter(event.target.value)}
                                className="w-full px-3 py-2 text-xs bg-[#020502] text-[#7cff7c] border border-[#196619] rounded-md outline-none"
                            >
                                <option value="1h">time: last 1h</option>
                                <option value="24h">time: last 24h</option>
                                <option value="7d">time: last 7d</option>
                                <option value="all">time: all</option>
                            </select>
                        </div>

                        <div className="max-h-[40vh] overflow-auto text-xs">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-[#050a05] border-b border-[#0f3f0f]">
                                    <tr className="text-[#9adf9a]">
                                        <th className="px-3 py-2 font-semibold">ACTION</th>
                                        <th className="px-3 py-2 font-semibold">DESCRIPTION</th>
                                        <th className="px-3 py-2 font-semibold">USER</th>
                                        <th className="px-3 py-2 font-semibold">TIMESTAMP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLogs.map((log) => (
                                        <tr key={log.id} className="border-b border-[#0d1f0d] hover:bg-[#081208]">
                                            <td className="px-3 py-2 whitespace-nowrap text-[#95ff95]">{log.action}</td>
                                            <td className="px-3 py-2 text-[#7cff7c]">{log.description || '-'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-[#9adf9a]">{log.userEmail || 'unknown'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-[#9adf9a]">{toLocalDateTime(log.timestamp)}</td>
                                        </tr>
                                    ))}
                                    {filteredLogs.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="px-3 py-5 text-center text-[#5aa55a]">
                                                no records match current filters
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
