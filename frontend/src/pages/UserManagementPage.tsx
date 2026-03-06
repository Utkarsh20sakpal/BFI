import React, { useState, useEffect } from 'react';
import { authApi } from '../api';
import { Users, Trash2, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '../utils/format';

export default function UserManagementPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newUserForm, setNewUserForm] = useState({ username: '', email: '', password: '', role: 'fraud_analyst', firstName: '', lastName: '' });

    const loadUsers = async () => {
        try {
            const res = await authApi.getUsers();
            setUsers(res.data.users);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadUsers(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await authApi.createUser(newUserForm);
            toast.success('User created');
            setNewUserForm({ username: '', email: '', password: '', role: 'fraud_analyst', firstName: '', lastName: '' });
            loadUsers();
        } catch (e: any) {
            toast.error(e.response?.data?.error || 'Failed to create user');
        }
    };

    const handleDelete = async (userId: string) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await authApi.deleteUser(userId);
            toast.success('User deleted');
            loadUsers();
        } catch (e) {
            toast.error('Failed to delete user');
        }
    };

    return (
        <div className="animate-fade-in">
            <h1 className="page-title mb-2">User Management</h1>
            <p className="page-subtitle mb-6">Create and manage access for investigators and admins.</p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-card p-5">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <Users size={16} className="text-teal-400" /> Authorized Personnel
                    </h3>
                    <table className="w-full text-xs text-left">
                        <thead className="border-b border-white/5 text-slate-500">
                            <tr>
                                <th className="py-2">User ID</th>
                                <th className="py-2">Name</th>
                                <th className="py-2">Role</th>
                                <th className="py-2">Last Login</th>
                                <th className="py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan={5} className="py-4 text-center">Loading...</td></tr> :
                                users.map(u => (
                                    <tr key={u.userId} className="border-b border-white/[0.03]">
                                        <td className="py-3 font-mono text-teal-400">{u.userId}</td>
                                        <td className="py-3 text-slate-300 font-medium">
                                            {u.username} <span className="text-slate-500 block text-[10px]">{u.email}</span>
                                        </td>
                                        <td className="py-3 capitalize text-slate-400">{u.role.replace('_', ' ')}</td>
                                        <td className="py-3 text-slate-500">{u.lastLogin ? formatDate(u.lastLogin) : 'Never'}</td>
                                        <td className="py-3 text-right">
                                            <button onClick={() => handleDelete(u.userId)} className="text-red-400 hover:text-red-300 p-1">
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            }
                        </tbody>
                    </table>
                </div>

                <div className="glass-card p-5">
                    <h3 className="text-sm font-semibold text-white mb-4">Create New Account</h3>
                    <form onSubmit={handleCreate} className="space-y-3 text-sm">
                        <input type="text" placeholder="Username" required value={newUserForm.username} onChange={e => setNewUserForm({ ...newUserForm, username: e.target.value })} className="w-full bg-navy-800 border border-white/10 rounded px-3 py-2 text-white" />
                        <input type="email" placeholder="Email" required value={newUserForm.email} onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })} className="w-full bg-navy-800 border border-white/10 rounded px-3 py-2 text-white" />
                        <input type="password" placeholder="Temporary Password" required value={newUserForm.password} onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })} className="w-full bg-navy-800 border border-white/10 rounded px-3 py-2 text-white" />

                        <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="First Name" value={newUserForm.firstName} onChange={e => setNewUserForm({ ...newUserForm, firstName: e.target.value })} className="w-full bg-navy-800 border border-white/10 rounded px-3 py-2 text-white" />
                            <input type="text" placeholder="Last Name" value={newUserForm.lastName} onChange={e => setNewUserForm({ ...newUserForm, lastName: e.target.value })} className="w-full bg-navy-800 border border-white/10 rounded px-3 py-2 text-white" />
                        </div>

                        <select value={newUserForm.role} onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })} className="w-full bg-navy-800 border border-white/10 rounded px-3 py-2 text-white">
                            <option value="fraud_analyst">Fraud Investigator</option>
                            <option value="admin">System Admin</option>
                        </select>

                        <button type="submit" className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded transition-colors mt-2">
                            Provision User
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
