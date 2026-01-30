'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, AlertTriangle } from 'lucide-react';

export default function AISettingsPage() {
  const [settings, setSettings] = useState({
    strict_mode: true,
    require_knowledge: true,
    fallback_message: '',
    min_confidence: 0.5,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings/ai');
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('API Error:', res.status, errorText);
        throw new Error(`API returned ${res.status}`);
      }
      
      const data = await res.json();
      console.log('Loaded settings:', data);
      
      setSettings({
        strict_mode: data.strict_mode ?? true,
        require_knowledge: data.require_knowledge ?? true,
        fallback_message: data.fallback_message ?? '',
        min_confidence: data.min_confidence ?? 0.5,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      alert('❌ ไม่สามารถโหลดการตั้งค่าได้: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      alert('✅ บันทึกการตั้งค่าเรียบร้อยแล้ว');
    } catch (error) {
      alert('❌ เกิดข้อผิดพลาดในการบันทึก');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-8 h-8 text-blue-600" />
        <h1 className="text-3xl font-bold">AI Settings</h1>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-800">
          <strong>คำเตือน:</strong> การเปิด Strict Mode จะทำให้ AI ตอบเฉพาะข้อมูลที่มีในฐานความรู้เท่านั้น 
          หากไม่พบข้อมูล AI จะไม่คิดขึ้นมาเอง
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
        {/* Strict Mode */}
        <div className="flex items-start gap-4">
          <input
            type="checkbox"
            id="strict_mode"
            checked={settings.strict_mode}
            onChange={(e) => setSettings({ ...settings, strict_mode: e.target.checked })}
            className="w-5 h-5 mt-1"
          />
          <div className="flex-1">
            <label htmlFor="strict_mode" className="font-semibold text-lg cursor-pointer">
              🔒 Strict Mode (โหมดเข้มงวด)
            </label>
            <p className="text-gray-600 text-sm mt-1">
              AI จะตอบเฉพาะข้อมูลจากฐานความรู้เท่านั้น ไม่คิดเองหรือใช้ความรู้ทั่วไป
            </p>
          </div>
        </div>

        <hr />

        {/* Require Knowledge */}
        <div className="flex items-start gap-4">
          <input
            type="checkbox"
            id="require_knowledge"
            checked={settings.require_knowledge}
            onChange={(e) => setSettings({ ...settings, require_knowledge: e.target.checked })}
            className="w-5 h-5 mt-1"
          />
          <div className="flex-1">
            <label htmlFor="require_knowledge" className="font-semibold text-lg cursor-pointer">
              📚 Require Knowledge Base
            </label>
            <p className="text-gray-600 text-sm mt-1">
              บังคับให้ต้องพบข้อมูลจากฐานความรู้อย่างน้อย 1 รายการ ไม่เช่นนั้นจะแสดงข้อความสำรอง
            </p>
          </div>
        </div>

        <hr />

        {/* Min Confidence */}
        <div>
          <label htmlFor="min_confidence" className="font-semibold text-lg block mb-2">
            🎯 Minimum Confidence Score
          </label>
          <input
            type="range"
            id="min_confidence"
            min="0"
            max="1"
            step="0.1"
            value={settings.min_confidence}
            onChange={(e) => setSettings({ ...settings, min_confidence: parseFloat(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-gray-600 mt-1">
            <span>ต่ำ (0.0)</span>
            <span className="font-semibold text-blue-600">{settings.min_confidence.toFixed(1)}</span>
            <span>สูง (1.0)</span>
          </div>
          <p className="text-gray-600 text-sm mt-2">
            คะแนนความเกี่ยวข้องขั้นต่ำของข้อมูลจากฐานความรู้ที่จะนำมาใช้
          </p>
        </div>

        <hr />

        {/* Fallback Message */}
        <div>
          <label htmlFor="fallback_message" className="font-semibold text-lg block mb-2">
            💬 Fallback Message (ข้อความสำรอง)
          </label>
          <textarea
            id="fallback_message"
            value={settings.fallback_message}
            onChange={(e) => setSettings({ ...settings, fallback_message: e.target.value })}
            className="w-full border rounded-lg p-3 h-24 resize-none"
            placeholder="ข้อความที่จะแสดงเมื่อไม่พบข้อมูลในฐานความรู้"
          />
          <p className="text-gray-600 text-sm mt-2">
            ข้อความนี้จะแสดงเมื่อ AI ไม่พบข้อมูลที่เกี่ยวข้องในฐานความรู้
          </p>
        </div>

        <hr />

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-5 h-5" />
            {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
          </button>
        </div>
      </div>
    </div>
  );
}
