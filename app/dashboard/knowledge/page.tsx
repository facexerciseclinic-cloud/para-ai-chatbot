'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Trash2, BookOpen, Plus } from 'lucide-react';
import Link from 'next/link';

export default function KnowledgePage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ content: '', category: 'Promotion' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Logic
  const fetchItems = async () => {
    setLoading(true);
    const res = await fetch('/api/knowledge');
    const json = await res.json();
    if (json.data) setItems(json.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // Submit Logic
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        setFormData({ ...formData, content: '' }); // Reset Form
        fetchItems(); // Reload List
      } else {
        alert('Failed to add knowledge');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Logic
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    await fetch(`/api/knowledge?id=${id}`, { method: 'DELETE' });
    fetchItems();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 font-sans text-slate-800">
      <div className="w-full max-w-4xl px-4">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center gap-4">
              <Link href="/dashboard" className="p-2 bg-white rounded-full border border-gray-200 hover:bg-gray-50 transition-colors">
                 <ArrowLeft size={20} className="text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <BookOpen className="text-teal-600" /> 
                    Brain Training
                </h1>
                <p className="text-sm text-gray-500">Teach your AI about products, prices, and promotions.</p>
              </div>
           </div>
        </div>

        {/* Input Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Plus size={16} /> Add New Knowledge
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                    <select 
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    >
                        <option value="Price">Price (ราคา)</option>
                        <option value="Procedure">Procedure (หัตถการ/ความรู้)</option>
                        <option value="Promotion">Promotion (โปรโมชั่น)</option>
                        <option value="General">General (ทั่วไป)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Knowledge Content</label>
                    <textarea 
                        rows={4}
                        placeholder="e.g., โปรแกรมรักษาสิว Acne Clear ราคาเริ่มต้น 990 บาท รวมกดสิว ฉีดสิว และมาร์คหน้า..."
                        value={formData.content}
                        onChange={(e) => setFormData({...formData, content: e.target.value})}
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none resize-none"
                    />
                </div>
                <div className="flex justify-end">
                    <button 
                        type="submit" 
                        disabled={isSubmitting || !formData.content}
                        className="bg-teal-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        {isSubmitting ? 'Training AI...' : <><Save size={16} /> Teach AI</>}
                    </button>
                </div>
            </form>
        </div>

        {/* Knowledge List */}
        <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 px-1">Recent Knowledge ({items.length})</h2>
            {loading ? (
                <div className="text-center py-10 text-gray-400 text-sm">Loading knowledge...</div>
            ) : items.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-400 text-sm">Brain is empty. Add some knowledge above.</p>
                </div>
            ) : (
                items.map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-start group hover:border-teal-200 transition-colors">
                        <div>
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide mb-2
                                ${item.category === 'Price' ? 'bg-amber-50 text-amber-700' : 
                                  item.category === 'Promotion' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}
                            `}>
                                {item.category}
                            </span>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.content}</p>
                            <p className="text-[10px] text-gray-400 mt-2">Added: {new Date(item.created_at).toLocaleDateString()}</p>
                        </div>
                        <button 
                            onClick={() => handleDelete(item.id)}
                            className="text-gray-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
}
