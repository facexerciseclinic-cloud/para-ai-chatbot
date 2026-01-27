'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Wifi } from 'lucide-react';

export default function ChannelsPage() {
  const [channels, setChannels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    platform: 'line',
    name: '',
    platform_account_id: '',
    access_token: '',
    channel_secret: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchChannels = async () => {
    setIsLoading(true);
    const res = await fetch('/api/channels');
    const json = await res.json();
    if (json.data) setChannels(json.data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
       const res = await fetch('/api/channels', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(formData)
       });
       if (res.ok) {
         setFormData({ platform: 'line', name: '', platform_account_id: '', access_token: '', channel_secret: '' });
         fetchChannels();
       } else {
         const err = await res.json();
         alert('Error: ' + err.error);
       }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Disconnect this channel? Chat will stop working.')) return;
    await fetch(`/api/channels?id=${id}`, { method: 'DELETE' });
    fetchChannels();
  };

  return (
    <div className="flex-1 bg-gray-50 h-full overflow-y-auto p-10 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Wifi className="text-teal-600" /> Channels Connection
        </h1>
        <p className="text-gray-500 mb-8">Manage your LINE OA and Facebook Page connections.</p>

        {/* Form */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
            <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Plus size={16} /> Connect New Channel
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Platform</label>
                    <select 
                        className="w-full p-2 border rounded-lg text-sm bg-gray-50"
                        value={formData.platform}
                        onChange={e => setFormData({...formData, platform: e.target.value})}
                    >
                        <option value="line">LINE Official Account</option>
                        <option value="facebook" disabled>Facebook Page (Coming Soon)</option>
                    </select>
                </div>
                <div className="col-span-2 md:col-span-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Display Name (e.g. Branch Name)</label>
                    <input 
                        type="text" 
                        required
                        className="w-full p-2 border rounded-lg text-sm"
                        placeholder="Para Clinic - Siam"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                </div>
                
                <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                       {formData.platform === 'line' ? 'Destination ID (Bot User ID)' : 'Page ID'}
                    </label>
                    <input 
                        type="text" 
                        required
                        className="w-full p-2 border rounded-lg text-sm font-mono"
                        placeholder={formData.platform === 'line' ? "Uxxxxxxxx..." : "1000..."}
                        value={formData.platform_account_id}
                        onChange={e => setFormData({...formData, platform_account_id: e.target.value})}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Found in LINE Developers specific to channel, or check logs when webhook hits.</p>
                </div>

                <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Channel Access Token</label>
                    <textarea 
                        required
                        rows={2}
                        className="w-full p-2 border rounded-lg text-sm font-mono"
                        placeholder="eyJh..."
                        value={formData.access_token}
                        onChange={e => setFormData({...formData, access_token: e.target.value})}
                    />
                </div>

                <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Channel Secret</label>
                    <input 
                        type="password" 
                        className="w-full p-2 border rounded-lg text-sm font-mono"
                        placeholder="Only required for LINE signature verification"
                        value={formData.channel_secret}
                        onChange={e => setFormData({...formData, channel_secret: e.target.value})}
                    />
                </div>

                <div className="col-span-2 flex justify-end mt-2">
                    <button 
                        disabled={isSubmitting}
                        className="bg-teal-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Connecting...' : 'Connect Channel'}
                    </button>
                </div>
            </form>
        </div>

        {/* List */}
        <h2 className="text-sm font-bold text-gray-700 mb-4">Active Connections ({channels.length})</h2>
        <div className="space-y-3">
            {isLoading ? <div className="text-gray-400 text-center text-sm">Loading...</div> : channels.map(ch => (
                <div key={ch.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white
                            ${ch.platform === 'line' ? 'bg-[#00B900]' : 'bg-[#1877F2]' }
                        `}>
                            {ch.platform === 'line' ? 'L' : 'F'}
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-gray-800">{ch.name}</h3>
                            <p className="text-xs text-gray-500 font-mono">ID: {ch.platform_account_id}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                         <span>Created: {new Date(ch.created_at).toLocaleDateString()}</span>
                         <button 
                            onClick={() => handleDelete(ch.id)}
                            className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-all"
                         >
                            <Trash2 size={16} />
                         </button>
                    </div>
                </div>
            ))}
            {!isLoading && channels.length === 0 && (
                <div className="text-sm text-gray-400 text-center py-8 bg-gray-100 rounded-xl border border-dashed border-gray-300">
                    No channels connected yet.
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
