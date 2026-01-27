'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, BookOpen, Settings, Radio } from 'lucide-react';

export default function AppSidebar() {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Inbox', href: '/dashboard', icon: MessageSquare },
    { name: 'AI Brain', href: '/dashboard/knowledge', icon: BookOpen },
    { name: 'Channels', href: '/dashboard/channels', icon: Radio },
  ];

  return (
    <div className="w-[64px] bg-sky-900 flex flex-col items-center py-6 gap-4 z-50 shadow-lg">
      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-4 text-white font-bold">
         P
      </div>
      
      {menuItems.map((item) => {
         const isActive = pathname === item.href;
         return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`p-3 rounded-xl transition-all group relative flex items-center justify-center
                ${isActive ? 'bg-teal-500 text-white shadow-lg' : 'text-sky-200 hover:bg-white/10 hover:text-white'}
              `}
              title={item.name}
            >
              <item.icon size={20} />
            </Link>
         );
      })}
    </div>
  );
}
